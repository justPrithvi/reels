import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Video, FileText, Sparkles, Play, Trash2, Wand2, Download, Edit2, VideoIcon, Upload, X } from 'lucide-react';
import { fetchProjectById, saveSRTData, replaceProjectVideo } from '@/src/services/apiClient';
import { parseSRT } from '@/src/utils/srtParser';
import { generateSRT } from '@/src/services/geminiService';
import { extractWavFromVideo } from '@/src/utils/audioHelpers';
import { VideoRecorder } from '@/src/components/VideoRecorder';
import { ComponentSelector } from '@/src/components/ComponentSelector';
import { ComponentRegistry } from '@/src/animationComponents/registry';
import '@/src/animationComponents/library/index';
import { SRTItem } from '@/types';
import { APP_CONFIG } from '@/config';

interface ProjectDetailProps {
  projectId: number;
  apiKey: string;
  onBack: () => void;
  onGenerateStart: (srtData: SRTItem[], srtText: string, videoDescription: string, selectedComponentIds: string[], componentSettings: { [key: string]: any }) => void;
  onOpenEditor: () => void;
}

// Memoized Video Player Component
const VideoPlayer = React.memo<{ videoPath: string; videoFilename: string }>(({ videoPath, videoFilename }) => {
  return (
    <div className="flex-1 bg-black rounded-lg overflow-hidden" style={{ minHeight: 0, maxHeight: 'calc(100% - 80px)' }}>
      <video
        key={videoFilename} // Only re-render if video file changes
        src={`http://localhost:3001${videoPath}?t=${Date.now()}`}
        controls
        className="w-full h-full object-contain"
        style={{ 
          maxHeight: '100%',
          transform: 'scaleX(-1)',
          WebkitTransform: 'scaleX(-1)'
        }}
      />
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  projectId,
  apiKey,
  onBack,
  onGenerateStart,
  onOpenEditor,
}) => {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [srtData, setSrtData] = useState<SRTItem[] | null>(null);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [uploadingSRT, setUploadingSRT] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [extractingAudio, setExtractingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [replacingVideo, setReplacingVideo] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]); // User selects from fresh set
  const [componentSettings, setComponentSettings] = useState<{ [key: string]: any }>({});
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [subtitleLanguage, setSubtitleLanguage] = useState<'english' | 'hinglish'>('english');

  // Memoized callbacks to prevent video re-render
  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  }, []);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await fetchProjectById(projectId);
      setProject(data.project);
      setSrtData(data.srtData?.json || null);
      setGeneratedContent(data.generatedContent || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSRTUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingSRT(true);
      setError(null);

      const srtText = await file.text();
      const parsed = parseSRT(srtText);

      // Save to database
      await saveSRTData(projectId, srtText, parsed, 'manual');

      // Update state
      setSrtData(parsed);

      alert('✅ Subtitles uploaded successfully!');
    } catch (err: any) {
      setError(`Failed to upload SRT: ${err.message}`);
    } finally {
      setUploadingSRT(false);
    }
  }, [projectId]);

  const handleGenerateAISubtitles = async () => {
    if (!project) return;
    if (!apiKey) {
      alert('❌ API Key is required to generate subtitles with AI');
      return;
    }

    try {
      setGeneratingAI(true);
      setError(null);

      // Fetch video file from server
      const videoUrl = `http://localhost:3001${project.video_path}`;
      const response = await fetch(videoUrl);
      const videoBlob = await response.blob();
      const videoFile = new File([videoBlob], project.video_filename, { type: videoBlob.type });

      // Generate subtitles using Gemini API
      const srtText = await generateSRT(videoFile, apiKey, subtitleLanguage);
      const parsed = parseSRT(srtText);

      // Save to database
      await saveSRTData(projectId, srtText, parsed, 'gemini');

      // Update state
      setSrtData(parsed);

      alert('✅ Subtitles generated successfully with AI!');
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      setError(`Failed to generate subtitles: ${err.message}`);
      alert(`❌ ${err.message}`);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleExtractAudio = async () => {
    if (!project) return;

    try {
      setExtractingAudio(true);
      setError(null);

      // Fetch video file from server
      const videoUrl = `http://localhost:3001${project.video_path}`;
      const response = await fetch(videoUrl);
      const videoBlob = await response.blob();
      const videoFile = new File([videoBlob], project.video_filename, { type: videoBlob.type });

      // Extract and download audio
      await extractWavFromVideo(videoFile);

      alert('✅ Audio extracted and downloaded!');
    } catch (err: any) {
      console.error('Audio Extraction Error:', err);
      setError(`Failed to extract audio: ${err.message}`);
      alert(`❌ Failed to extract audio: ${err.message}`);
    } finally {
      setExtractingAudio(false);
    }
  };

  const handleDownloadSRT = () => {
    if (!srtData || !project) {
      alert('❌ No subtitles available to download');
      return;
    }

    try {
      // Convert SRT data to SRT format string
      let srtContent = '';
      srtData.forEach((item, index) => {
        const startTime = formatSRTTime(item.startTime);
        const endTime = formatSRTTime(item.endTime);
        srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${item.text}\n\n`;
      });

      // Create blob and download
      const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_subtitles.srt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('✅ Subtitles downloaded successfully!');
    } catch (err: any) {
      console.error('Download SRT Error:', err);
      setError(`Failed to download SRT: ${err.message}`);
      alert(`❌ Failed to download SRT: ${err.message}`);
    }
  };

  // Helper function to format time for SRT format (HH:MM:SS,mmm)
  const formatSRTTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  };

  const handleGenerateClick = useCallback(() => {
    if (!srtData) {
      alert('Please upload subtitles first');
      return;
    }
    // Show inline prompt input
    setShowPromptInput(true);
  }, [srtData]);

  const handleStartGeneration = useCallback(() => {
    if (selectedComponentIds.length === 0) {
      alert('Please select at least one animation component');
      return;
    }
    
    // Pass SRT data to parent to start generation (no description needed)
    const srtText = srtData!.map((item, idx) => 
      `${idx + 1}\n${formatTime(item.startTime)} --> ${formatTime(item.endTime)}\n${item.text}\n`
    ).join('\n');
    
    setShowPromptInput(false);
    setIsGenerating(true);
    // Pass empty string for videoDescription (not needed)
    onGenerateStart(srtData!, srtText, '', selectedComponentIds, componentSettings);
  }, [srtData, selectedComponentIds, componentSettings, onGenerateStart]);

  const handleManualModeClick = useCallback(() => {
    if (!srtData) {
      alert('Please upload subtitles first');
      return;
    }
    
    // Immediately open editor with minimal setup
    onOpenEditor();
  }, [srtData, onOpenEditor]);

  const handleRecordingComplete = async (videoBlob: Blob, videoDuration: number) => {
    try {
      setReplacingVideo(true);
      setError(null);

      // Convert blob to file
      const videoFile = new File([videoBlob], 'recorded-video.webm', { type: 'video/webm' });

      // Upload to server (backend will delete SRT and generated content)
      const updatedProject = await replaceProjectVideo(projectId, videoFile, videoDuration);

      // Update local state and clear SRT/content since backend deleted them
      setProject(updatedProject);
      setSrtData(null);
      setGeneratedContent(null);
      setShowRecorder(false);

      alert('✅ Video recorded and saved successfully! Generate new subtitles to continue.');
    } catch (err: any) {
      console.error('Failed to save recorded video:', err);
      setError(`Failed to save video: ${err.message}`);
      alert(`❌ ${err.message}`);
    } finally {
      setReplacingVideo(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!confirm('Delete this video? This will also remove all subtitles, generated content, and prompt data. You can start fresh with a new video.')) {
      return;
    }

    try {
      setReplacingVideo(true);
      setError(null);

      // Delete video from server by setting video fields to null
      const response = await fetch(`/api/projects/${projectId}/video`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      // Update project state to remove everything
      setProject({
        ...project,
        video_filename: null,
        video_path: null,
        video_duration: 0,
      });
      
      // Clear all associated data
      setSrtData(null);
      setGeneratedContent(null);
      setNotes('');

      alert('✅ Video and all associated data deleted successfully!');
    } catch (err: any) {
      console.error('Failed to delete video:', err);
      setError(`Failed to delete: ${err.message}`);
      alert(`❌ Failed to delete video: ${err.message}`);
    } finally {
      setReplacingVideo(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={onBack} className="px-4 py-2 bg-gray-700 text-white rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden flex flex-col">
      {/* Compact Header */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-sm">Back</span>
            </button>
            <div className="border-l border-gray-700 pl-4">
              <h1 className="text-xl font-bold text-white">{project.name}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area - Fixed Height, No Scroll */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="h-full max-w-7xl mx-auto flex flex-row gap-4">
          
          {/* Video Section - Left (40% width) */}
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-4 overflow-hidden flex flex-col" style={{ flex: '0 0 40%', minHeight: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Video size={20} className="text-blue-500" />
                <h2 className="text-base font-bold text-white">Video File</h2>
              </div>
              {!showRecorder && project.video_filename && (
                <button
                  onClick={handleDeleteVideo}
                  className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-all"
                  title="Delete video"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
            </div>
            
            {showRecorder ? (
              /* Video Recorder */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Container with flex height to show recorder + controls */}
                <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                  <VideoRecorder
                    onRecordingComplete={handleRecordingComplete}
                    onCancel={() => setShowRecorder(false)}
                  />
                </div>
                {replacingVideo && (
                  <div className="text-center text-sm text-gray-400 py-2 flex-shrink-0">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Saving video...
                  </div>
                )}
              </div>
            ) : project.video_filename ? (
              /* Existing Video Display */
              <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                <div className="flex justify-between items-center text-xs flex-shrink-0">
                  <p className="text-gray-400 truncate flex-1">
                    <span className="text-gray-500">File:</span> {project.video_filename}
                  </p>
                  <p className="text-gray-400 ml-2">
                    <span className="text-gray-500">Duration:</span> {project.video_duration?.toFixed(1)}s
                  </p>
                </div>
                <VideoPlayer videoPath={project.video_path} videoFilename={project.video_filename} />
                
                {/* Download Buttons - Only if subtitles exist */}
                {srtData && srtData.length > 0 ? (
                  <div className="flex-shrink-0 bg-gray-800/30 border border-gray-700 rounded-lg p-2">
                    <p className="text-xs text-gray-400 mb-2 font-semibold">Downloads:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleDownloadSRT}
                        className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium inline-flex items-center justify-center gap-2 transition-all"
                      >
                        <FileText size={14} />
                        SRT File
                      </button>

                      <button
                        onClick={handleExtractAudio}
                        disabled={extractingAudio}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium inline-flex items-center justify-center gap-2 transition-all"
                      >
                        <Download size={14} className={extractingAudio ? 'animate-bounce' : ''} />
                        {extractingAudio ? 'Extracting...' : 'Audio File'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* No Subtitles - Show Generate Button */
                  <div className="flex-shrink-0 bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-2">
                    <p className="text-xs text-yellow-200 mb-2 font-semibold">⚠️ Generate subtitles first:</p>
                    
                    {/* Language Selector */}
                    <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-1.5 border border-gray-700 mb-2">
                      <button
                        onClick={() => setSubtitleLanguage('english')}
                        className={`flex-1 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                          subtitleLanguage === 'english' 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        English
                      </button>
                      <button
                        onClick={() => setSubtitleLanguage('hinglish')}
                        className={`flex-1 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                          subtitleLanguage === 'hinglish' 
                            ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' 
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Hinglish
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleGenerateAISubtitles}
                        disabled={generatingAI || uploadingSRT}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium inline-flex items-center justify-center gap-2 transition-all"
                      >
                        <Wand2 size={14} className={generatingAI ? 'animate-spin' : ''} />
                        {generatingAI ? 'Generating...' : 'AI Generate'}
                      </button>
                      
                      <label className="block">
                        <input
                          type="file"
                          accept=".srt"
                          onChange={handleSRTUpload}
                          disabled={uploadingSRT || generatingAI}
                          className="hidden"
                        />
                        <span className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg cursor-pointer inline-flex items-center justify-center gap-2 transition-all text-xs font-medium">
                          <FileText size={14} />
                          {uploadingSRT ? 'Uploading...' : 'Upload SRT'}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Video Actions */}
                <button
                  onClick={() => {
                    if (confirm('Replace existing video with a new recording?')) {
                      setShowRecorder(true);
                    }
                  }}
                  className="flex-shrink-0 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium inline-flex items-center justify-center gap-2 transition-all"
                >
                  <VideoIcon size={14} />
                  Record New Video
                </button>
              </div>
            ) : (
              /* No Video - Show Upload/Record Options */
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                {/* Video Placeholder */}
                <div className="flex-1 bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center p-6" style={{ minHeight: 0, maxHeight: 'calc(100% - 100px)' }}>
                  <Video size={48} className="text-gray-600" />
                  <p className="text-gray-400 text-center mt-3 text-sm">No video uploaded yet</p>
                  <p className="text-gray-500 text-xs text-center mt-1">Upload or record a video to get started</p>
                </div>
                
                {/* Action Buttons - Below the video preview */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <input
                    type="file"
                    accept="video/*,audio/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      try {
                        setReplacingVideo(true);
                        setError(null);
                        
                        // Get video duration
                        const video = document.createElement('video');
                        video.preload = 'metadata';
                        const duration = await new Promise<number>((resolve) => {
                          video.onloadedmetadata = () => resolve(video.duration);
                          video.onerror = () => resolve(0);
                          video.src = URL.createObjectURL(file);
                        });
                        
                        // Upload video (backend will delete SRT and generated content)
                        const updatedProject = await replaceProjectVideo(projectId, file, duration);
                        setProject(updatedProject);
                        
                        // Clear SRT/content since backend deleted them
                        setSrtData(null);
                        setGeneratedContent(null);
                        
                        alert('✅ Video uploaded successfully! Generate new subtitles to continue.');
                      } catch (err: any) {
                        console.error('Failed to upload video:', err);
                        setError(`Failed to upload: ${err.message}`);
                        alert(`❌ ${err.message}`);
                      } finally {
                        setReplacingVideo(false);
                      }
                    }}
                    className="hidden"
                    id="video-upload-detail"
                  />
                  
                  <label
                    htmlFor="video-upload-detail"
                    className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-blue-500 bg-blue-600/10 text-blue-300 hover:bg-blue-600 hover:text-white transition-all font-medium text-sm"
                  >
                    <Upload size={18} /> Upload Video
                  </label>
                  
                  <button
                    onClick={() => setShowRecorder(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-purple-500 bg-purple-600/10 text-purple-300 hover:bg-purple-600 hover:text-white transition-all font-medium text-sm"
                  >
                    <VideoIcon size={18} /> Record Video
                  </button>
                </div>
                
                {replacingVideo && (
                  <div className="text-center text-sm text-gray-400">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Uploading video...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes Section - Middle (35% width) */}
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-4 flex flex-col" style={{ flex: '0 0 35%', minHeight: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-yellow-500" />
                <h2 className="text-lg font-bold text-white">Recording Notes</h2>
              </div>
              <span className="text-xs text-gray-500">{notes.length} chars</span>
            </div>
            <textarea
              value={notes}
              onChange={handleNotesChange}
              placeholder="Add your script or talking points here...&#10;&#10;• Main points to cover&#10;• Key messages&#10;• Call to action&#10;• Important reminders"
              className="flex-1 w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 resize-none text-sm leading-relaxed"
            />
          </div>

          {/* Action Buttons Section - Right (25% width) */}
          <div className="flex flex-col" style={{ flex: '0 0 22%', minHeight: 0 }}>
            {/* Create Reel Card - Full Height */}
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur border border-purple-700/50 rounded-xl flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-purple-700/30 flex items-center gap-2 flex-shrink-0">
                <Sparkles size={18} className="text-purple-400" />
                <h2 className="text-base font-bold text-white">Create Reel</h2>
                </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {generatedContent && !showPromptInput ? (
                /* Reel Ready State - Show result */
                <div className="space-y-3">
                  {/* Success Message */}
                  <div className="bg-green-900/20 p-3 rounded-lg border border-green-700/50">
                    <p className="text-green-200 text-sm mb-1 font-bold flex items-center gap-2">
                      <span className="text-lg">✨</span>
                      Reel Ready!
                    </p>
                    <p className="text-gray-400 text-xs">
                      Your animated reel has been generated successfully.
                    </p>
                  </div>
                  
                  {/* Primary Action */}
                  <button
                    onClick={onOpenEditor}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
                  >
                    <Play size={16} />
                    Open in Editor
                  </button>
                  
                  {/* Divider */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-gradient-to-br from-purple-900/30 to-pink-900/30 text-gray-400 rounded">or</span>
                    </div>
                  </div>
                  
                  {/* Secondary Actions */}
                  <div className="space-y-2">
                  <button
                      onClick={() => setShowPromptInput(true)}
                      className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-lg text-xs font-medium inline-flex items-center justify-center gap-2 transition-all"
                  >
                      <Sparkles size={14} />
                      Regenerate with New Settings
                  </button>
                    
                      <button
                      onClick={handleManualModeClick}
                      className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-lg text-xs font-medium inline-flex items-center justify-center gap-2 transition-all"
                      >
                      <Edit2 size={14} />
                      Manual Mode
                      </button>
                    </div>
                  </div>
              ) : (
                /* Generation Setup - Unified Flow */
                <div className="space-y-3 h-full flex flex-col">
                  {/* Show Open in Editor if content exists */}
                  {generatedContent && (
                    <>
                    <button
                        onClick={onOpenEditor}
                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                        <Play size={16} />
                        Open in Editor
                    </button>
                      
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-3 bg-gradient-to-br from-purple-900/30 to-pink-900/30 text-gray-400 rounded">modify settings</span>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Subtitle Status */}
                  {!srtData ? (
                    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
                      <p className="text-yellow-200 text-sm font-bold mb-1">⚠️ Subtitles Required</p>
                      <p className="text-yellow-300/70 text-xs">Generate subtitles from the video first</p>
                    </div>
                  ) : (
                    <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-2">
                      <p className="text-green-200 text-xs font-semibold">✓ Subtitles Ready ({srtData.length} lines)</p>
                    </div>
                  )}
                  
                  {/* Step 1: Component Selection */}
                  {srtData && (
                    <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-700/50 rounded-lg p-3 flex flex-col">
                      <div className="flex items-center justify-between mb-3 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
                          <p className="text-blue-200 text-sm font-bold">Select Components</p>
                        </div>
                    <button
                          onClick={() => setShowComponentModal(true)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-md"
                    >
                      <Sparkles size={12} />
                          Select
                    </button>
                  </div>
                      
                      {selectedComponentIds.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-xs border border-dashed border-gray-600 rounded-lg">
                          No components selected
                </div>
              ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                          {selectedComponentIds.map(id => {
                            const component = ComponentRegistry.get(id);
                            return component ? (
                              <div
                                key={id}
                                className="px-2.5 py-1 bg-blue-500/20 border border-blue-500/50 rounded-md text-blue-200 text-xs font-medium flex-shrink-0"
                              >
                                {component.name}
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Step 2: Generate Button */}
                  <button
                    onClick={handleStartGeneration}
                    disabled={!srtData || selectedComponentIds.length === 0}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm inline-flex items-center justify-center gap-2 transition-all shadow-lg"
                  >
                    <Sparkles size={16} />
                    {generatedContent ? 'Regenerate Reel' : 'Generate Reel'}
                  </button>
                  
                  {/* Cancel regeneration if already generated */}
                  {generatedContent && showPromptInput && (
                    <button
                      onClick={() => setShowPromptInput(false)}
                      className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-lg text-xs font-medium inline-flex items-center justify-center gap-2 transition-all"
                    >
                      Cancel
                    </button>
                  )}
                  
                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-gradient-to-br from-purple-900/30 to-pink-900/30 text-gray-400 rounded">or</span>
                    </div>
                  </div>
                  
                  {/* Manual Mode */}
                  <button
                    onClick={handleManualModeClick}
                    disabled={!srtData}
                    className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed border border-gray-700 disabled:border-gray-800 text-white rounded-lg text-xs font-medium inline-flex items-center justify-center gap-2 transition-all"
                  >
                    <Edit2 size={14} />
                    Manual Mode
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generating Loader Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <Sparkles className="absolute inset-0 m-auto text-purple-400 animate-pulse" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Generating Your Reel</h3>
            <p className="text-gray-400 text-sm mb-4">AI is creating animations for your content...</p>
            <div className="flex items-center justify-center gap-2 text-purple-400 text-xs">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Component Selection Modal */}
      {showComponentModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Sparkles size={24} className="text-blue-400" />
                <div>
                  <h2 className="text-xl font-bold text-white">Select Animation Components</h2>
                  <p className="text-sm text-gray-400">Choose which animations to use in your reel</p>
                </div>
              </div>
              <button
                onClick={() => setShowComponentModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 p-6 overflow-hidden">
              <ComponentSelector
                selectedComponentIds={selectedComponentIds}
                onSelectionChange={setSelectedComponentIds}
                apiKey={apiKey}
                componentSettings={componentSettings}
                onSettingsChange={setComponentSettings}
                srtText={srtData?.map(item => item.text).join(' ') || ''}
              />
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-gray-700 flex items-center justify-between flex-shrink-0">
              <p className="text-sm text-gray-400">
                {selectedComponentIds.length} component{selectedComponentIds.length !== 1 ? 's' : ''} selected
              </p>
              <button
                onClick={() => setShowComponentModal(false)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
