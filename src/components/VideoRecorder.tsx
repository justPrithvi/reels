import React, { useState, useRef, useEffect } from 'react';
import { Video, Circle, Square, RotateCcw, Check, X, Play, Sparkles, Image as ImageIcon } from 'lucide-react';

interface VideoRecorderProps {
  onRecordingComplete: (videoBlob: Blob, videoDuration: number) => void;
  onCancel?: () => void;
}

type FilterType = 'none' | 'warm' | 'cool' | 'vintage' | 'bright' | 'dramatic';
type BackgroundType = 'none' | 'blur' | 'gradient1' | 'gradient2' | 'gradient3';

export const VideoRecorder: React.FC<VideoRecorderProps> = ({
  onRecordingComplete,
  onCancel,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('none');
  const [selectedBackground, setSelectedBackground] = useState<BackgroundType>('none');
  const [showFilters, setShowFilters] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Request camera access on mount
  useEffect(() => {
    requestCameraAccess();
    return () => {
      stopCamera();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Apply filters and backgrounds to canvas
  useEffect(() => {
    if (!stream || !videoRef.current || !canvasRef.current) {
      console.log('⏸️ Canvas rendering paused:', { 
        hasStream: !!stream, 
        hasVideo: !!videoRef.current, 
        hasCanvas: !!canvasRef.current 
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      console.error('❌ Failed to get canvas context');
      return;
    }

    console.log('🎨 Starting canvas rendering');
    let frameCount = 0;

    const processFrame = () => {
      // Wait for video to be ready
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Log first frame
      if (frameCount === 0) {
        console.log('🎬 First frame rendered', {
          videoSize: `${video.videoWidth}x${video.videoHeight}`,
          readyState: video.readyState
        });
      }
      frameCount++;

      // Set canvas size to match video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background first (if selected)
      if (selectedBackground !== 'none') {
        drawBackground(ctx, canvas.width, canvas.height);
      }

      // Apply filter to video
      ctx.filter = getFilterCSS(selectedFilter);
      
      // Draw video (mirrored)
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
      
      // Reset filter
      ctx.filter = 'none';

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    // Start processing frames
    processFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      console.log('🛑 Canvas rendering stopped, rendered', frameCount, 'frames');
    };
  }, [stream, selectedFilter, selectedBackground]);

  const getFilterCSS = (filter: FilterType): string => {
    switch (filter) {
      case 'warm':
        return 'sepia(0.3) saturate(1.3) brightness(1.1)';
      case 'cool':
        return 'hue-rotate(180deg) saturate(1.2)';
      case 'vintage':
        return 'sepia(0.5) contrast(1.1) brightness(0.9)';
      case 'bright':
        return 'brightness(1.3) contrast(1.1) saturate(1.2)';
      case 'dramatic':
        return 'contrast(1.4) saturate(0.8) brightness(0.9)';
      default:
        return 'none';
    }
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Save context before drawing background
    ctx.save();
    
    switch (selectedBackground) {
      case 'blur':
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, width, height);
        break;
      case 'gradient1':
        const grad1 = ctx.createLinearGradient(0, 0, width, height);
        grad1.addColorStop(0, '#667eea');
        grad1.addColorStop(1, '#764ba2');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, width, height);
        break;
      case 'gradient2':
        const grad2 = ctx.createLinearGradient(0, 0, width, height);
        grad2.addColorStop(0, '#f093fb');
        grad2.addColorStop(1, '#f5576c');
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, width, height);
        break;
      case 'gradient3':
        const grad3 = ctx.createLinearGradient(0, 0, width, height);
        grad3.addColorStop(0, '#4facfe');
        grad3.addColorStop(1, '#00f2fe');
        ctx.fillStyle = grad3;
        ctx.fillRect(0, 0, width, height);
        break;
    }
    
    ctx.restore();
  };

  const requestCameraAccess = async () => {
    try {
      console.log('📹 Requesting camera access...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          facingMode: 'user' // Front camera
        },
        audio: true,
      });
      
      console.log('✅ Camera access granted', mediaStream.getVideoTracks()[0].getSettings());
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Ensure video plays
        try {
          await videoRef.current.play();
          console.log('▶️ Video playing');
        } catch (playErr) {
          console.warn('Video autoplay blocked:', playErr);
        }
      }
      setError('');
    } catch (err: any) {
      console.error('❌ Camera access error:', err);
      setError('Failed to access camera. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const startRecording = () => {
    if (!stream || !canvasRef.current) {
      setError('No camera stream available');
      return;
    }

    try {
      chunksRef.current = [];
      
      // Record from canvas to include filters and backgrounds
      const canvasStream = canvasRef.current.captureStream(30); // 30 fps
      
      // Add audio from original stream
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => canvasStream.addTrack(track));
      
      const mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        
        // Calculate duration from recorded chunks
        // We'll get the actual duration when the video loads
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 0.1);
      }, 100);
    } catch (err: any) {
      console.error('Recording error:', err);
      setError('Failed to start recording: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopCamera();
    }
  };

  const resetRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl('');
    setDuration(0);
    setIsRecording(false);
    setIsPaused(false);
    chunksRef.current = [];
    requestCameraAccess();
  };

  const handleConfirm = () => {
    if (recordedBlob) {
      // Get actual duration from video element
      const videoDuration = videoRef.current?.duration || duration;
      onRecordingComplete(recordedBlob, videoDuration);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl border border-gray-700">
      {/* Video Preview - Portrait Mode for Mobile */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden rounded-t-xl">
        {/* Hidden video element for stream - always rendered for canvas to draw from */}
        <video
          ref={videoRef}
          autoPlay
          muted={!recordedUrl}
          playsInline
          className={recordedUrl ? "h-full object-contain" : "absolute opacity-0 pointer-events-none"}
          style={recordedUrl ? { 
            transform: 'scaleX(-1)',
            WebkitTransform: 'scaleX(-1)',
            maxWidth: '100%',
            aspectRatio: '9/16'
          } : {
            width: '1px',
            height: '1px'
          }}
          src={recordedUrl || undefined}
          onLoadedMetadata={(e) => {
            const videoDuration = (e.target as HTMLVideoElement).duration;
            if (videoDuration && !isNaN(videoDuration)) {
              setDuration(videoDuration);
            }
          }}
        />

        {/* Canvas for live preview with filters/backgrounds */}
        {!recordedUrl && (
          <canvas
            ref={canvasRef}
            className="h-full object-contain bg-gray-900"
            style={{ 
              maxWidth: '100%',
              aspectRatio: '9/16',
              minWidth: '200px',
              minHeight: '356px'
            }}
          />
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-red-600 rounded-full text-white text-sm font-bold animate-pulse">
            <Circle size={12} fill="white" />
            REC
          </div>
        )}

        {/* Timer */}
        {(isRecording || recordedBlob) && (
          <div className="absolute top-4 right-4 px-4 py-2 bg-black/70 backdrop-blur rounded-lg text-white text-sm font-mono">
            {formatTime(duration)}
          </div>
        )}

        {/* Filters & Background Controls - Only show when not recording and no recorded video */}
        {!isRecording && !recordedBlob && stream && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-black/70 backdrop-blur hover:bg-black/80 text-white rounded-lg text-xs font-medium flex items-center gap-2 transition-all shadow-lg"
            >
              <Sparkles size={14} />
              {showFilters ? 'Hide' : 'Filters & Backgrounds'}
            </button>

            {showFilters && (
              <div className="bg-black/90 backdrop-blur-lg rounded-lg p-3 shadow-2xl border border-gray-700 max-w-xs">
                {/* Filters */}
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Filters</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['none', 'warm', 'cool', 'vintage', 'bright', 'dramatic'] as FilterType[]).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setSelectedFilter(filter)}
                        className={`px-2 py-1.5 rounded text-xs font-semibold transition-all ${
                          selectedFilter === filter
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {filter === 'none' ? 'None' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Backgrounds */}
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Background</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedBackground('none')}
                      className={`px-2 py-1.5 rounded text-xs font-semibold transition-all ${
                        selectedBackground === 'none'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      None
                    </button>
                    <button
                      onClick={() => setSelectedBackground('blur')}
                      className={`px-2 py-1.5 rounded text-xs font-semibold transition-all ${
                        selectedBackground === 'blur'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Blur
                    </button>
                    {(['gradient1', 'gradient2', 'gradient3'] as BackgroundType[]).map((bg) => (
                      <button
                        key={bg}
                        onClick={() => setSelectedBackground(bg)}
                        className={`px-2 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
                          selectedBackground === bg
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        style={{
                          background: selectedBackground === bg ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : ''
                        }}
                      >
                        <div className={`w-3 h-3 rounded-full ${
                          bg === 'gradient1' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' :
                          bg === 'gradient2' ? 'bg-gradient-to-br from-pink-500 to-rose-600' :
                          'bg-gradient-to-br from-blue-400 to-cyan-500'
                        }`}></div>
                        Gradient
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 p-6">
            <div className="text-center">
              <Video size={48} className="text-red-400 mx-auto mb-4" />
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <button
                onClick={requestCameraAccess}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* No Stream Message */}
        {!error && !stream && !recordedBlob && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400 text-sm">Accessing camera...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls - Always visible at bottom */}
      <div className="shrink-0 p-4 bg-gray-800 border-t border-gray-700">
        {!recordedBlob ? (
          /* Recording Controls */
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <X size={16} />
                Cancel
              </button>
            )}
            
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={!stream || !!error}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center gap-2 transition-all"
              >
                <Circle size={20} fill="white" />
                Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold flex items-center gap-2"
              >
                <Square size={20} />
                Stop Recording
              </button>
            )}
          </div>
        ) : (
          /* Playback Controls */
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={resetRecording}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Re-record
            </button>

            <button
              onClick={() => videoRef.current?.play()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Play size={16} />
              Preview
            </button>

            <button
              onClick={handleConfirm}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold flex items-center gap-2"
            >
              <Check size={20} />
              Use This Recording
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
