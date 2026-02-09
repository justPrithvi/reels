import React, {useEffect, useRef, useState} from 'react';
import {FileUpload} from '@/src/components/FileUpload.tsx';
import {WelcomeScreen} from '@/src/components/WelcomeScreen.tsx';
import {MobileBlocker} from '@/src/components/MobileBlocker.tsx';
import {AppHeader} from '@/src/components/AppHeader.tsx';
import {GeneratingScreen} from '@/src/components/GeneratingScreen.tsx';
import {EditorView} from '@/src/views/EditorView.tsx';
import {Snackbar} from '@/src/components/Snackbar.tsx';
import {ReplaceSceneDialog} from '@/src/components/ReplaceSceneDialog.tsx';
import {ProjectsList} from '@/src/components/ProjectsList.tsx';
import {ProjectDetail} from '@/src/components/ProjectDetail.tsx';
import {parseSRT} from '@/src/utils/srtParser.ts';
import {AppState, GeneratedContent, SRTItem} from '../types.ts';
import {generateReelContent, generateHTMLWithComponents, optimizeSegmentsForAnimation} from '@/src/services/geminiService.ts';
import {APP_CONFIG} from '../config.ts';
import {constructPrompt, EXAMPLE_HTML, EXAMPLE_JSON, EXAMPLE_SRT, EXAMPLE_TOPIC} from '@/src/utils/promptTemplates.ts';
import {fetchProjectById, saveSRTData, saveGeneratedContent, saveAnimationSegments, getAnimationSegments} from '@/src/services/apiClient';

const App: React.FC = () => {
  // Check sessionStorage for active workspace
  const [appState, setAppState] = useState<AppState>(() => {
    const savedWorkspace = sessionStorage.getItem('workspace_active');
    return savedWorkspace === 'true' ? AppState.PROJECTS : AppState.WELCOME;
  });
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [currentSpaceName, setCurrentSpaceName] = useState<string>(() => {
    return sessionStorage.getItem('workspace_name') || '';
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isAudioOnly, setIsAudioOnly] = useState(false); // Track if using dummy video/audio only
  const [srtData, setSrtData] = useState<SRTItem[]>([]);
  const [srtTextRaw, setSrtTextRaw] = useState<string>('');
  const [topicContext, setTopicContext] = useState('');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);

  // Manual Mode & Latency Handling
  const [showManualButton, setShowManualButton] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [pendingContent, setPendingContent] = useState<GeneratedContent | null>(null);
  const isManualModeRef = useRef(false);
  const manualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings State (Session-only, stored in sessionStorage)
  const [apiKey, setApiKey] = useState(() => {
    return sessionStorage.getItem('api_key') || '';
  });
  const [modelName] = useState(APP_CONFIG.DEFAULT_MODEL);

  // Handle project selection - go to project detail page
  const handleSelectProject = async (projectId: number) => {
    try {
      console.log('Loading project:', projectId);
      setCurrentProjectId(projectId);
      
      // Go to project detail page
      setAppState(AppState.PROJECT_DETAIL);
    } catch (error: any) {
      console.error('Failed to load project:', error);
      alert(`Failed to load project: ${error.message}`);
    }
  };

  // Handle starting generation from project detail
  const handleGenerateFromProject = async (srtItems: SRTItem[], srtText: string, videoDescription: string, selectedComponentIds: string[], componentSettings: { [key: string]: any }) => {
    try {
      // Load project video
      const data = await fetchProjectById(currentProjectId!);
      const videoResponse = await fetch(`http://localhost:3001${data.project.video_path}`);
      const videoBlob = await videoResponse.blob();
      const videoFile = new File([videoBlob], data.project.video_filename, { type: videoBlob.type });
      
      setVideoFile(videoFile);
      setIsAudioOnly(false);
      setSrtData(srtItems);
      setSrtTextRaw(srtText);
      setTopicContext(videoDescription);
      
      // Start generation immediately with new segment-based flow
      setIsGenerating(true);
      setError(null);
      
      try {
        console.log('🎬 OPTIMIZED 3-CALL FLOW');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Note: Calls 1-2 happened during component auto-generation');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log('📊 Step 1: Grouping subtitles into logical segments...');
        const optimizedSegments = await optimizeSegmentsForAnimation(
          srtText,
          videoDescription,
          apiKey,
          modelName
        );
        console.log(`   ✓ Grouped ${srtItems.length} subtitle lines → ${optimizedSegments.length} segments`);
        
        // Create grouped SRT text for final HTML generation
        const groupedSRTText = optimizedSegments.map((seg, idx) => 
          `${idx + 1}\n${seg.startTime.toFixed(2)} --> ${seg.endTime.toFixed(2)}\n${seg.text}\n`
        ).join('\n');
        
        console.log('🎨 Step 2: Final LLM Call - Generating HTML...');
        console.log(`   → Using ${selectedComponentIds.length} components: ${selectedComponentIds.join(', ')}`);
        console.log(`   → ${optimizedSegments.length} segments to animate`);
        console.log(`   → Fallback: text_display for any unmatched segments`);
        
        // Generate complete HTML from grouped segments
        const result = await generateHTMLWithComponents(
          groupedSRTText,
          videoDescription,
          selectedComponentIds,
          apiKey,
          modelName
        );
        
        const finalHTML = result.html;
        
        // Auto-set end screen time if closing segment was detected
        if (result.closingSegmentStartTime !== undefined) {
          console.log(`🎯 Auto-setting end screen start time: ${result.closingSegmentStartTime}s`);
          setEndScreenStartTime(result.closingSegmentStartTime);
          setEndScreenEndTime(undefined); // Until video ends
          setShowEndScreen(true); // Ensure end screen is enabled
        } else {
          console.log('⚠️ No closing segment detected - end screen will not auto-show');
        }
        
        console.log('   ✓ HTML generated with perfect timing!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Generation complete!');
        
        // Create layout config from optimized segments (split view for all segments)
        const layoutConfig = optimizedSegments.map(seg => ({
          startTime: seg.startTime,
          endTime: seg.endTime,
          layoutMode: 'split' as 'split',
          splitRatio: 0.6,
          captionPosition: 'center' as 'center'
        }));
        
        const content = {
          html: finalHTML,
          layoutConfig: layoutConfig,
          reasoning: `Component-based generation: ${optimizedSegments.length} optimized segments (from ${srtItems.length} subtitle lines)`
        };
        
        setGeneratedContent(content);
        
        // Save content to database
        try {
          await saveGeneratedContent(currentProjectId!, content.html, content.layoutConfig, videoDescription);
          console.log('✅ Generated content saved to database');
        } catch (saveErr) {
          console.error('Failed to save generated content:', saveErr);
        }
        
        // Save optimized segments as animation metadata
        try {
          const segments = optimizedSegments.map(seg => ({
            id: seg.id,
            startTime: seg.startTime,
            endTime: seg.endTime,
            text: seg.text,
            animationType: seg.animationType || 'component-based'
          }));
          await saveAnimationSegments(currentProjectId!, segments);
          console.log('✅ Segment metadata saved');
        } catch (saveErr) {
          console.error('Failed to save segments:', saveErr);
        }
        
        // Go directly to editor
        setAppState(AppState.EDITOR);
      } catch (err: any) {
        setError(err.message || "Failed to generate content.");
        alert(`❌ Generation failed: ${err.message}`);
      } finally {
        setIsGenerating(false);
      }
    } catch (error: any) {
      console.error('Failed to start generation:', error);
      alert(`Failed: ${error.message}`);
    }
  };

  // Handle opening editor from project detail
  const handleOpenEditorFromProject = async () => {
    try {
      // Load full project data
      const data = await fetchProjectById(currentProjectId!);
      
      // Load video
      const videoResponse = await fetch(`http://localhost:3001${data.project.video_path}`);
      const videoBlob = await videoResponse.blob();
      const videoFile = new File([videoBlob], data.project.video_filename, { type: videoBlob.type });
      setVideoFile(videoFile);
      setIsAudioOnly(false);
      
      // Load SRT
      if (data.srtData) {
        setSrtTextRaw(data.srtData.text);
        setSrtData(data.srtData.json);
        // Auto-detection will happen via useEffect
      }
      
      // Load or create generated content
      if (data.generatedContent) {
        // Generate layoutConfig from SRT if missing or empty
        let layoutConfig = data.generatedContent.layoutConfig;
        if (!layoutConfig || layoutConfig.length === 0) {
          console.log('⚠️ layoutConfig missing or empty, generating from SRT...');
          if (data.srtData?.json && data.srtData.json.length > 0) {
            layoutConfig = data.srtData.json.map((item: SRTItem) => ({
              startTime: item.startTime,
              endTime: item.endTime,
              layoutMode: 'split' as 'split',
              splitRatio: 0.6,
              captionPosition: 'center' as 'center'
            }));
            console.log(`✅ Generated ${layoutConfig.length} layout configs from SRT`);
          } else {
            // Fallback to single default layout
            const totalDuration = data.srtData?.json[data.srtData.json.length - 1]?.endTime || 30;
            layoutConfig = [{
              startTime: 0,
              endTime: totalDuration,
              layoutMode: 'split' as 'split',
              splitRatio: 0.6,
              captionPosition: 'center' as 'center'
            }];
          }
        }
        
        setGeneratedContent({
          html: data.generatedContent.html,
          layoutConfig: layoutConfig,
        });
        setTopicContext(data.generatedContent.topicContext || '');
      } else {
        // Manual mode: Create minimal content (black screen + 50/50 layout)
        const totalDuration = data.srtData?.json[data.srtData.json.length - 1]?.endTime || 30;
        
        // Generate layoutConfig from SRT if available
        let layoutConfig: any[];
        if (data.srtData?.json && data.srtData.json.length > 0) {
          layoutConfig = data.srtData.json.map((item: SRTItem) => ({
            startTime: item.startTime,
            endTime: item.endTime,
            layoutMode: 'split' as 'split',
            splitRatio: 0.6,
            captionPosition: 'center' as 'center'
          }));
          console.log(`✅ Manual mode: Generated ${layoutConfig.length} layout configs from SRT`);
        } else {
          layoutConfig = [{
            startTime: 0,
            endTime: totalDuration,
            layoutMode: 'split' as 'split',
            splitRatio: 0.6,
            captionPosition: 'center' as 'center'
          }];
        }
        
        setGeneratedContent({
          html: `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #000000;
      font-family: 'Inter', sans-serif;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    #manual-canvas {
      color: #444;
      font-size: 16px;
      text-align: center;
    }
  </style>
</head>
<body>
  
  
  <script>
    const tl = gsap.timeline({ paused: true });
    window.addEventListener('message', (e) => {
      if (e.data.type === 'timeupdate') {
        tl.seek(e.data.time);
      }
    });
  </script>
</body>
</html>`,
          layoutConfig: layoutConfig
        });
        setTopicContext('Manual Mode');
      }
      
      // Go to editor
      setAppState(AppState.EDITOR);
    } catch (error: any) {
      console.error('Failed to open editor:', error);
      alert(`Failed: ${error.message}`);
    }
  };

  // Audio State
  const [bgMusicFile, setBgMusicFile] = useState<File | null>(null);
  const [bgMusicUrl, setBgMusicUrl] = useState<string | undefined>(undefined);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.2);

  // Subtitle Style State
  const [subtitleFontSize, setSubtitleFontSize] = useState(18);
  const [subtitleFontFamily, setSubtitleFontFamily] = useState('Inter');
  const [subtitleColor, setSubtitleColor] = useState('#FFFFFF');
  const [subtitleBgColor, setSubtitleBgColor] = useState('rgba(0,0,0,0.8)');
  const [subtitleBgOpacity, setSubtitleBgOpacity] = useState(80); // 0-100 percentage
  const [subtitlePaddingX, setSubtitlePaddingX] = useState(16);
  const [subtitlePaddingY, setSubtitlePaddingY] = useState(8);
  const [subtitleMaxWidth, setSubtitleMaxWidth] = useState(90); // Percentage of screen width

  // End Screen State
  const [showEndScreen, setShowEndScreen] = useState(true);
  const [endScreenProfileImage, setEndScreenProfileImage] = useState<string>('/assets/profile.jpg');
  const [endScreenName, setEndScreenName] = useState('Prithvi Raj');
  const [endScreenTagline, setEndScreenTagline] = useState('Follow for more');
  const [endScreenInstagram, setEndScreenInstagram] = useState('');
  const [endScreenYoutube, setEndScreenYoutube] = useState('');
  const [endScreenTwitter, setEndScreenTwitter] = useState('');
  const [showEndScreenSocialIcons, setShowEndScreenSocialIcons] = useState(true);
  const [endScreenStartTime, setEndScreenStartTime] = useState<number | undefined>(undefined);
  const [endScreenEndTime, setEndScreenEndTime] = useState<number | undefined>(undefined);

  // Auto-set end screen for last 4 seconds when SRT is loaded
  useEffect(() => {
    if (srtData && srtData.length > 0 && appState === AppState.EDITOR) {
      // Get video duration from last SRT item
      const videoDuration = srtData[srtData.length - 1].endTime;
      const endScreenStart = Math.max(0, videoDuration - 4); // Last 4 seconds
      
      setEndScreenStartTime(endScreenStart);
      setEndScreenEndTime(undefined); // Until video ends
      setShowEndScreen(true);
      console.log(`✅ End screen auto-set for last 4 seconds: ${endScreenStart.toFixed(1)}s - ${videoDuration.toFixed(1)}s`);
    }
  }, [srtData, appState]);

  // Manage Video Object URL
  useEffect(() => {
    if (!videoFile) return;
    const newUrl = URL.createObjectURL(videoFile);
    setVideoUrl(newUrl);
    return () => URL.revokeObjectURL(newUrl);
  }, [videoFile]);

  // Manage Audio Object URL
  useEffect(() => {
    if (!bgMusicFile) {
      setBgMusicUrl(undefined);
      return;
    }
    const newUrl = URL.createObjectURL(bgMusicFile);
    setBgMusicUrl(newUrl);
    return () => URL.revokeObjectURL(newUrl);
  }, [bgMusicFile]);

  // Handle workspace entry (stored in sessionStorage)
  const handleWelcomeComplete = (key: string, spaceName: string) => {
      setApiKey(key);
    setCurrentSpaceName(spaceName);

    // Store in sessionStorage (survives refresh, cleared on tab close)
    sessionStorage.setItem('api_key', key);
    sessionStorage.setItem('workspace_name', spaceName);
    sessionStorage.setItem('workspace_active', 'true');
    
    console.log(`✅ Entered workspace: "${spaceName}"`);
    setAppState(AppState.PROJECTS);
  };

  // Exit workspace and return to entry screen
  const handleExitWorkspace = () => {
    setApiKey("");
    setCurrentSpaceName("");
    setCurrentProjectId(null);
    setGeneratedContent(null);
    setVideoFile(null);
    setSrtData([]);
    setSrtTextRaw('');
    setTopicContext('');
    setBgMusicFile(null);
    setPendingContent(null);
    setShowReplaceDialog(false);
    setIsAudioOnly(false);
    
    // Clear sessionStorage
    sessionStorage.removeItem('api_key');
    sessionStorage.removeItem('workspace_name');
    sessionStorage.removeItem('workspace_active');
    
    setAppState(AppState.WELCOME);
  };

  const handleFilesSelected = async (video: File, srt: File, isAudioMode: boolean) => {
    try {
      setVideoFile(video);
      setIsAudioOnly(isAudioMode);
      const srtText = await srt.text();
      setSrtTextRaw(srtText);
      const parsedSrt = parseSRT(srtText);
      setSrtData(parsedSrt);
      
      // Save SRT to database if project is loaded
      if (currentProjectId) {
        try {
          await saveSRTData(currentProjectId, srtText, parsedSrt, 'manual');
          console.log('✅ SRT data saved to database');
        } catch (saveErr) {
          console.error('Failed to save SRT data:', saveErr);
        }
      }
      
      setAppState(AppState.GENERATING);
    } catch (e) {
      setError("Failed to parse files.");
    }
  };

  const handleGenerate = async () => {
    if (!videoFile || srtData.length === 0) return;
    if (!apiKey.trim()) {
      setError("API Key is missing. Auto-generate is disabled. Please add a key in settings or use Manual Mode.");
      return;
    }

    // No need to save to storage anymore (session-only)

    setIsGenerating(true);
    setError(null);
    try {
      // Check if we are REFINING existing content
      const existingHtml = generatedContent?.html;
      const existingLayout = generatedContent?.layoutConfig;

      const content = await generateReelContent(
        srtTextRaw,
        topicContext,
        apiKey,
        modelName,
        existingHtml,
        existingLayout,
        isAudioOnly
      );
      setGeneratedContent(content);
      
      // Save to database if project is loaded
      if (currentProjectId) {
        try {
          await saveGeneratedContent(currentProjectId, content.html, content.layoutConfig, topicContext);
          console.log('✅ Generated content saved to database');
        } catch (saveErr) {
          console.error('Failed to save generated content:', saveErr);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate content.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnterStudio = async () => {
    let currentSrtRaw = srtTextRaw;
    let currentTopic = topicContext;

    if (srtData.length === 0) {
      currentSrtRaw = EXAMPLE_SRT;
      currentTopic = EXAMPLE_TOPIC;
      setSrtTextRaw(currentSrtRaw);
      setSrtData(parseSRT(currentSrtRaw));
      setTopicContext(currentTopic);
    }

    const prompt = constructPrompt(currentTopic, currentSrtRaw);
    navigator.clipboard.writeText(prompt);

    setShowSnackbar(true);
    setTimeout(() => setShowSnackbar(false), 3000);

    // If NO API KEY -> Force Manual Mode
    if (!apiKey.trim()) {
      handleManualModeEnter();
      return;
    }

    // Setup Generation State
    setIsGenerating(true);
    setError(null);
    setShowManualButton(false);
    isManualModeRef.current = false;

    // Start 10s Timer for Manual Mode Option
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    manualTimerRef.current = setTimeout(() => {
      setShowManualButton(true);
    }, 10000); // 10 seconds

    try {
      // Initial Generation - No existing content yet
      const content = await generateReelContent(currentSrtRaw, currentTopic, apiKey, modelName, undefined, undefined, isAudioOnly);

      if (isManualModeRef.current) {
        // User already entered manual mode, ask to replace
        setPendingContent(content);
        setShowReplaceDialog(true);
      } else {
        // Normal flow
        setGeneratedContent(content);
        setAppState(AppState.EDITOR);
      }
    } catch (err: any) {
      console.warn("API Generation failed.", err);

      // If user is already in manual mode, ignore errors (they are editing demo content)
      if (!isManualModeRef.current) {
        // FALLBACK TO PREDEFINED SAMPLE
        // However, if it's a specific API error (like 429), we want to show it.
        if (err.message && (err.message.includes("429") || err.message.includes("API Key") || err.message.includes("Quota"))) {
          setError(err.message);
        } else {
          // Only fallback on generic/unknown errors, or if user prefers fallback flow
          try {
            const fallbackContent: GeneratedContent = {
              html: EXAMPLE_HTML,
              layoutConfig: JSON.parse(EXAMPLE_JSON),
              reasoning: "Fallback to Demo Content (API Error or Quota Exceeded)"
            };
            setGeneratedContent(fallbackContent);
            setAppState(AppState.EDITOR);
          } catch (fallbackErr) {
            console.error("Fallback failed", fallbackErr);
            setError(err.message || "Failed to generate initial content.");
          }
        }
      }
    } finally {
      if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
      setIsGenerating(false);
    }
  };

  const handleManualModeEnter = () => {
    isManualModeRef.current = true;
    // Load demo content immediately so the editor isn't empty
    setGeneratedContent({
      html: EXAMPLE_HTML,
      layoutConfig: JSON.parse(EXAMPLE_JSON),
      reasoning: "Manual Mode Entry"
    });
    setAppState(AppState.EDITOR);
  };

  const handleConfirmReplace = () => {
    if (pendingContent) {
      setGeneratedContent(pendingContent);
    }
    setShowReplaceDialog(false);
    setPendingContent(null);
  };

  const handleCancelReplace = () => {
    setShowReplaceDialog(false);
    setPendingContent(null);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const handleBackToProjects = () => {
    setAppState(AppState.PROJECTS);
    setCurrentProjectId(null);
    setGeneratedContent(null);
    setVideoFile(null);
    setSrtData([]);
    setSrtTextRaw('');
    setTopicContext('');
    setBgMusicFile(null);
    setPendingContent(null);
    setShowReplaceDialog(false);
    setIsAudioOnly(false);
  };

  return (
    <>
      <MobileBlocker/>

      {/* Main App Container - Only rendered on Desktop (md+) */}
      <div className="hidden md:contents">
        {appState === AppState.WELCOME ? (
          <WelcomeScreen onComplete={handleWelcomeComplete}/>
        ) : appState === AppState.PROJECTS ? (
          <ProjectsList
            spaceName={currentSpaceName}
            onSelectProject={handleSelectProject}
            onCreateComplete={() => {}}
            onExitWorkspace={handleExitWorkspace}
          />
        ) : appState === AppState.PROJECT_DETAIL && currentProjectId ? (
          <ProjectDetail
            projectId={currentProjectId}
            apiKey={apiKey}
            onBack={handleBackToProjects}
            onGenerateStart={handleGenerateFromProject}
            onOpenEditor={handleOpenEditorFromProject}
          />
        ) : (
          <div className="w-full h-screen flex flex-col bg-gray-950 text-white overflow-hidden relative">
            {/* Header - Hidden on Upload, Editor, and Generating screens */}
            {!isFullScreen && 
             appState !== AppState.UPLOAD && 
             appState !== AppState.EDITOR && 
             appState !== AppState.GENERATING && (
              <AppHeader
                onResetAuth={handleExitWorkspace}
                onNewProject={handleBackToProjects}
              />
            )}

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative flex flex-col">
              {/* State: Upload */}
              {appState === AppState.UPLOAD && (
                <div className="flex flex-col h-full overflow-y-auto">
                  <div className="flex-1">
                    <FileUpload
                      onFilesSelected={handleFilesSelected}
                      apiKey={apiKey}
                      onBack={handleBackToProjects}
                    />
                  </div>
                </div>
              )}

              {/* State: Generating */}
              {appState === AppState.GENERATING && (
                <GeneratingScreen
                  isAudioOnly={isAudioOnly}
                  topicContext={topicContext}
                  onTopicContextChange={setTopicContext}
                  isGenerating={isGenerating}
                  showManualButton={showManualButton}
                  error={error}
                  onEnterStudio={handleEnterStudio}
                  onManualModeEnter={handleManualModeEnter}
                  onResetAuth={handleBackToProjects}
                  apiKey={apiKey}
                  srtDataLength={srtData.length}
                />
              )}

              {/* State: Editor */}
              {appState === AppState.EDITOR && generatedContent && (
                <EditorView
                  projectId={currentProjectId || undefined}
                  videoUrl={videoUrl}
                  srtData={srtData}
                  generatedContent={generatedContent}
                  isFullScreen={isFullScreen}
                  toggleFullScreen={toggleFullScreen}
                  bgMusicUrl={bgMusicUrl}
                  bgMusicVolume={bgMusicVolume}
                  isGenerating={isGenerating}
                  onGenerate={handleGenerate}
                  onUpdate={setGeneratedContent}
                  videoFile={videoFile}
                  topicContext={topicContext}
                  onTopicContextChange={setTopicContext}
                  srtText={srtTextRaw}
                  bgMusicName={bgMusicFile?.name}
                  onBgMusicChange={setBgMusicFile}
                  onBgVolumeChange={setBgMusicVolume}
                  apiKey={apiKey}
                  setApiKey={setApiKey}
                  modelName={modelName}
                  setModelName={() => {}} // Model is fixed
                  onSaveApiKey={() => {}} // No saving needed
                  subtitleFontSize={subtitleFontSize}
                  onSubtitleFontSizeChange={setSubtitleFontSize}
                  subtitleFontFamily={subtitleFontFamily}
                  onSubtitleFontFamilyChange={setSubtitleFontFamily}
                  subtitleColor={subtitleColor}
                  onSubtitleColorChange={setSubtitleColor}
                  subtitleBgColor={subtitleBgColor}
                  onSubtitleBgColorChange={setSubtitleBgColor}
                  subtitleBgOpacity={subtitleBgOpacity}
                  onSubtitleBgOpacityChange={setSubtitleBgOpacity}
                  subtitlePaddingX={subtitlePaddingX}
                  onSubtitlePaddingXChange={setSubtitlePaddingX}
                  subtitlePaddingY={subtitlePaddingY}
                  onSubtitlePaddingYChange={setSubtitlePaddingY}
                  subtitleMaxWidth={subtitleMaxWidth}
                  onSubtitleMaxWidthChange={setSubtitleMaxWidth}
                  showEndScreen={showEndScreen}
                  onShowEndScreenChange={setShowEndScreen}
                  endScreenProfileImage={endScreenProfileImage}
                  onEndScreenProfileImageChange={setEndScreenProfileImage}
                  endScreenName={endScreenName}
                  onEndScreenNameChange={setEndScreenName}
                  endScreenTagline={endScreenTagline}
                  onEndScreenTaglineChange={setEndScreenTagline}
                  endScreenInstagram={endScreenInstagram}
                  onEndScreenInstagramChange={setEndScreenInstagram}
                  endScreenYoutube={endScreenYoutube}
                  onEndScreenYoutubeChange={setEndScreenYoutube}
                  endScreenTwitter={endScreenTwitter}
                  onEndScreenTwitterChange={setEndScreenTwitter}
                  showEndScreenSocialIcons={showEndScreenSocialIcons}
                  onShowEndScreenSocialIconsChange={setShowEndScreenSocialIcons}
                  endScreenStartTime={endScreenStartTime}
                  onEndScreenStartTimeChange={setEndScreenStartTime}
                  endScreenEndTime={endScreenEndTime}
                  onEndScreenEndTimeChange={setEndScreenEndTime}
                />
              )}
            </main>

            {/* Snackbar */}
            <Snackbar
              show={showSnackbar}
              message="Prompt Copied to Clipboard!"
            />

            {/* Replace Scene Dialog */}
            <ReplaceSceneDialog
              show={showReplaceDialog}
              onConfirm={handleConfirmReplace}
              onCancel={handleCancelReplace}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default App;
