import React, { useEffect, useRef, useState, useMemo } from 'react';
import { LayoutConfigStep, SRTItem } from '@/types.ts';
import { Play, Pause, RefreshCw, Maximize, Minimize, Video, StopCircle, X, AlertTriangle, Monitor } from 'lucide-react';
import { EndScreen } from '@/src/components/EndScreen.tsx';

interface ReelPlayerProps {
  videoUrl: string;
  srtData: SRTItem[];
  htmlContent: string;
  layoutConfig: LayoutConfigStep[];
  onTimeUpdate?: (time: number) => void;
  fullScreenMode: boolean;
  toggleFullScreen: () => void;
  bgMusicUrl?: string;
  bgMusicVolume?: number;
  subtitleFontSize?: number;
  subtitleFontFamily?: string;
  subtitleColor?: string;
  subtitleBgColor?: string;
  subtitleBgOpacity?: number;
  subtitlePaddingX?: number;
  subtitlePaddingY?: number;
  subtitleMaxWidth?: number;
  // End Screen Props
  showEndScreen?: boolean;
  endScreenProfileImage?: string;
  endScreenName?: string;
  endScreenTagline?: string;
  endScreenSocialHandles?: {
    instagram?: string;
    youtube?: string;
    twitter?: string;
  };
  showEndScreenSocialIcons?: boolean;
  endScreenStartTime?: number; // When to start showing end screen (in seconds)
  endScreenEndTime?: number; // When to stop showing end screen (in seconds)
}

export const ReelPlayer: React.FC<ReelPlayerProps> = ({
  videoUrl,
  srtData,
  htmlContent,
  layoutConfig,
  onTimeUpdate,
  fullScreenMode,
  toggleFullScreen,
  bgMusicUrl,
  bgMusicVolume = 0.2,
  subtitleFontSize = 32,
  subtitleFontFamily = 'Inter',
  subtitleColor = '#FFFFFF',
  subtitleBgColor = 'rgba(0,0,0,0.8)',
  subtitleBgOpacity = 80,
  subtitlePaddingX = 16,
  subtitlePaddingY = 8,
  subtitleMaxWidth = 90,
  // End Screen Props
  showEndScreen = true,
  endScreenProfileImage,
  endScreenName = "Your Name",
  endScreenTagline = "Follow for more",
  endScreenSocialHandles,
  showEndScreenSocialIcons = true,
  endScreenStartTime,
  endScreenEndTime
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showExportInfo, setShowExportInfo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);

  // Key to force re-render iframe on restart
  const [iframeKey, setIframeKey] = useState(0);

  // Check if we should show end screen based on current time
  const shouldShowEndScreen = useMemo(() => {
    if (!showEndScreen) {
      console.log('🚫 End screen disabled');
      return false;
    }
    
    // Only show during specified time range (no fallback after video ends)
    if (endScreenStartTime !== undefined) {
      const endTime = endScreenEndTime ?? duration;
      const shouldShow = currentTime >= endScreenStartTime && currentTime <= endTime;
      
      if (shouldShow) {
        console.log(`✅ Showing end screen: time=${currentTime.toFixed(2)}s, start=${endScreenStartTime}s, end=${endTime.toFixed(2)}s`);
      }
      
      return shouldShow;
    }
    
    // If no time range set, don't show end screen at all
    console.log('⚠️ End screen time not set');
    return false;
  }, [showEndScreen, currentTime, endScreenStartTime, endScreenEndTime, duration]);

  // --- Computed State based on Time ---
  const currentLayout = useMemo(() => {
    // 1. Try to find the specific layout step for the current time
    const match = layoutConfig.find(step => currentTime >= step.startTime && currentTime < step.endTime);
    if (match) return match;

    // 2. If no match, check if we are past the last step (keep the final state)
    if (layoutConfig.length > 0) {
      const lastStep = layoutConfig[layoutConfig.length - 1];
      if (currentTime >= lastStep.endTime) {
        return lastStep;
      }
    }

    // 3. Fallback default
    return layoutConfig[0] || {
      layoutMode: 'split',
      splitRatio: 0.5,
      captionPosition: 'center',
      startTime: 0,
      endTime: 9999
    };
  }, [currentTime, layoutConfig]);

  const currentCaption = useMemo(() => {
    return srtData.find(item => currentTime >= item.startTime && currentTime <= item.endTime);
  }, [currentTime, srtData]);

  // --- Styles calculation ---
  const getLayoutStyles = () => {
    // Handle both 'mode' and 'layoutMode' for backwards compatibility
    const layoutMode = (currentLayout as any).layoutMode || (currentLayout as any).mode || 'split';
    const { splitRatio = 0.5 } = currentLayout;

    let htmlHeight = '50%';
    let videoHeight = '50%';
    let htmlZIndex = 10;
    let videoZIndex = 10;

    if (layoutMode === 'full-video') {
      htmlHeight = '0%';
      videoHeight = '100%';
      htmlZIndex = 0;
    } else if (layoutMode === 'full-html') {
      htmlHeight = '100%';
      videoHeight = '0%';
      videoZIndex = 0;
    } else if (layoutMode === 'split') {
      htmlHeight = `${splitRatio * 100}%`;
      videoHeight = `${(1 - splitRatio) * 100}%`;
    }

    // Smooth transition style
    const transition = 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)';

    return {
      htmlContainer: { height: htmlHeight, transition, zIndex: htmlZIndex },
      videoContainer: { height: videoHeight, transition, zIndex: videoZIndex },
    };
  };

  const getCaptionStyle = () => {
    // Handle both 'mode' and 'layoutMode' for backwards compatibility
    const layoutMode = (currentLayout as any).layoutMode || (currentLayout as any).mode || 'split';
    const { splitRatio = 0.5, captionPosition } = currentLayout;

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '90%',
      display: 'flex',
      justifyContent: 'center',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: 50, // Ensure high Z-index
      transition: 'top 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    };

    if (captionPosition === 'hidden') {
      return { ...baseStyle, display: 'none' };
    }

    if (layoutMode === 'split') {
      // In split mode, position the caption exactly on the dividing line
      return { ...baseStyle, top: `${splitRatio * 100}%` };
    }

    // Full screen modes fallback
    switch (captionPosition) {
      case 'top': return { ...baseStyle, top: '15%' };
      case 'center': return { ...baseStyle, top: '50%' };
      case 'bottom': return { ...baseStyle, top: '80%' };
      case 'full': return { ...baseStyle, top: '50%', width: '95%', fontSize: '1.2em' };
      default: return { ...baseStyle, top: '80%' };
    }
  };

  const layoutStyles = getLayoutStyles();
  const captionStyle = getCaptionStyle();
  // Handle both 'mode' and 'layoutMode' for backwards compatibility
  const layoutMode = (currentLayout as any).layoutMode || (currentLayout as any).mode || 'split';
  const isFullHtml = layoutMode === 'full-html';

  // Helper to apply opacity to background color
  const getBackgroundColorWithOpacity = () => {
    const opacity = subtitleBgOpacity / 100;
    
    // If already rgba, replace the alpha value
    if (subtitleBgColor.startsWith('rgba')) {
      return subtitleBgColor.replace(/[\d.]+\)$/g, `${opacity})`);
    }
    
    // If rgb, convert to rgba
    if (subtitleBgColor.startsWith('rgb')) {
      return subtitleBgColor.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
    }
    
    // If hex color, convert to rgba
    if (subtitleBgColor.startsWith('#')) {
      const hex = subtitleBgColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    // Fallback
    return subtitleBgColor;
  };

  // --- Word-by-Word Animation Logic (With Chunking) ---
  const renderAnimatedCaption = () => {
    if (!currentCaption) return null;

    const WORDS_PER_VIEW = 5; // Max words to show at once

    // Split full text into words
    const allWords = currentCaption.text.split(' ');

    // Calculate progress through the current segment (0 to 1)
    const duration = currentCaption.endTime - currentCaption.startTime;
    const elapsed = currentTime - currentCaption.startTime;
    const progress = Math.max(0, Math.min(1, elapsed / duration));

    // Determine which word is currently being spoken (Global Index)
    const globalActiveIndex = Math.floor(progress * allWords.length);

    // Determine which "Page" (Chunk) of words we are on
    const currentChunkIndex = Math.floor(globalActiveIndex / WORDS_PER_VIEW);

    // Slice the array to get only the current chunk
    const startWordIndex = currentChunkIndex * WORDS_PER_VIEW;
    const endWordIndex = startWordIndex + WORDS_PER_VIEW;
    const visibleWords = allWords.slice(startWordIndex, endWordIndex);

    return (
      <div
        className={`flex flex-wrap justify-center items-center gap-x-1.5 gap-y-1 rounded-2xl transition-all duration-300 ${isFullHtml ? 'backdrop-blur-md border border-white/10 shadow-2xl' : ''}`}
        style={{
          minHeight: '60px',
          maxWidth: `${subtitleMaxWidth}%`,
          backgroundColor: getBackgroundColorWithOpacity(),
          fontFamily: subtitleFontFamily,
          paddingLeft: `${subtitlePaddingX}px`,
          paddingRight: `${subtitlePaddingX}px`,
          paddingTop: `${subtitlePaddingY}px`,
          paddingBottom: `${subtitlePaddingY}px`
        }}
      >
        {visibleWords.map((word, index) => {
          // Calculate the true index of this word in the original full sentence
          const trueIndex = startWordIndex + index;

          const isActive = trueIndex === globalActiveIndex;
          const isPast = trueIndex < globalActiveIndex;

          return (
            <span
              key={`${currentCaption.id}-${trueIndex}`}
              className={`
                transition-all duration-150 inline-block font-black tracking-wide leading-tight
                ${isActive ? 'scale-110' : ''}
              `}
              style={{
                fontSize: `${subtitleFontSize}px`,
                color: isActive ? '#fbbf24' : (isPast ? subtitleColor : `${subtitleColor}66`),
                textShadow: isActive
                    ? '0 0 30px rgba(250, 204, 21, 0.6), 2px 2px 0px rgba(0,0,0,1)'
                    : '2px 2px 0px rgba(0,0,0,0.8)',
                fontFamily: subtitleFontFamily
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  };

  // --- Messaging Helper ---
  const postMessageToIframe = (message: any) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, '*');
    }
  };

  // --- Iframe Load Handler ---
  const handleIframeLoad = () => {
    if (videoRef.current) {
      postMessageToIframe({
        type: 'timeupdate',
        time: videoRef.current.currentTime
      });

      if (!videoRef.current.paused) {
         postMessageToIframe({ type: 'play' });
      }
    }
  };

  // --- Background Music Management ---

  // 1. Handle Volume Changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = bgMusicVolume;
    }
  }, [bgMusicVolume]);

  // 2. Handle Source Changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      if (bgMusicUrl) {
        // Load new source
        audio.src = bgMusicUrl;
        audio.load();
        audio.volume = bgMusicVolume; // Ensure volume is set immediately

        // Sync to video immediately
        if (videoRef.current) {
          audio.currentTime = videoRef.current.currentTime;
          if (!videoRef.current.paused) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                console.warn("Auto-play prevented (Audio):", error);
              });
            }
          }
        }
      } else {
        // Clear source if removed
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    }
  }, [bgMusicUrl]);


  // --- Sync Logic (High Frequency Loop) ---
  useEffect(() => {
    let animationFrameId: number;

    const syncLoop = () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        const time = video.currentTime;
        setCurrentTime(time);

        postMessageToIframe({ type: 'timeupdate', time });

        // Sync Audio logic
        if (audioRef.current && bgMusicUrl && !audioRef.current.paused) {
          const drift = Math.abs(audioRef.current.currentTime - time);
          // Tighten drift tolerance and sync
          if (drift > 0.2) {
            audioRef.current.currentTime = time;
          }
        }
        // Force play if video is playing but audio isn't (and audio exists)
        else if (audioRef.current && bgMusicUrl && audioRef.current.paused && video.readyState >= 3) {
             audioRef.current.currentTime = time;
             audioRef.current.play().catch(() => {});
        }

        if (onTimeUpdate) {
           onTimeUpdate(time);
        }
      }
      animationFrameId = requestAnimationFrame(syncLoop);
    };

    animationFrameId = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [onTimeUpdate, bgMusicUrl]);

  // --- Event Listeners for State ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      postMessageToIframe({ type: 'play' });
      const audio = audioRef.current;
      if (audio && audio.src) audio.play().catch(() => {});
    };

    const handlePause = () => {
      setIsPlaying(false);
      postMessageToIframe({ type: 'pause' });
      const audio = audioRef.current;
      if (audio) audio.pause();
    };

    const handleLoadedMetadata = () => {
      console.log('📹 Video metadata loaded, duration:', video.duration);
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
      setDuration(video.duration);
      } else if (!isFinite(video.duration)) {
        console.warn('⚠️ Video duration is Infinity, will use SRT duration estimate');
      }
      postMessageToIframe({ type: 'timeupdate', time: video.currentTime });
    };

    const handleCanPlay = () => {
      console.log('📹 Video can play, duration:', video.duration);
      if (video.duration && isFinite(video.duration) && video.duration > 0 && duration === 0) {
        setDuration(video.duration);
      }
    };

    const handleDurationChange = () => {
      console.log('📹 Video duration changed:', video.duration);
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setVideoEnded(true);
      postMessageToIframe({ type: 'pause' });
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    };

    const handleTimeUpdate = () => {
        if (video.paused) {
            setCurrentTime(video.currentTime);
            postMessageToIframe({ type: 'timeupdate', time: video.currentTime });
            const audio = audioRef.current;
            if (audio) audio.currentTime = video.currentTime;
        }
    };

    const handleSeeked = () => {
      const audio = audioRef.current;
      setCurrentTime(video.currentTime);
      postMessageToIframe({ type: 'timeupdate', time: video.currentTime });
      if (audio) audio.currentTime = video.currentTime;
    }

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeked', handleSeeked);

    // Check immediately if duration is already available
    if (video.duration && isFinite(video.duration)) {
      console.log('📹 Duration already available:', video.duration);
      setDuration(video.duration);
    }

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, []);

  // Fallback: If video duration is Infinity or NaN, estimate from SRT data
  useEffect(() => {
    if (srtData && srtData.length > 0 && (!duration || !isFinite(duration) || duration === 0)) {
      const maxEndTime = Math.max(...srtData.map(item => item.endTime));
      if (maxEndTime > 0 && isFinite(maxEndTime)) {
        console.log('📹 Using SRT duration estimate:', maxEndTime);
        setDuration(maxEndTime);
      }
    }
  }, [srtData, duration]);

  // Aggressive duration polling - check every 100ms until we get it
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) {
      return;
    }
    
    let attempts = 0;
    const maxAttempts = 20; // 2 seconds max (reduced since we have SRT fallback)
    
    const interval = setInterval(() => {
      attempts++;
      const currentDuration = video.duration;
      
      if (currentDuration && isFinite(currentDuration) && currentDuration > 0) {
        console.log('✅ GOT VALID DURATION from video:', currentDuration);
        setDuration(currentDuration);
        clearInterval(interval);
      } else if (!isFinite(currentDuration)) {
        console.warn('⚠️ Video duration is Infinity/NaN, stopping polling. Will use SRT estimate.');
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        console.warn('⚠️ Could not get video duration after', maxAttempts, 'attempts. Will use SRT estimate.');
        clearInterval(interval);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [videoUrl]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        setVideoEnded(false);
        videoRef.current.play().catch(e => console.warn("Play failed:", e));
      } else {
        videoRef.current.pause();
      }
    }
  };

  const restart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setVideoEnded(false);

      // Force Iframe Reload
      setIframeKey(prev => prev + 1);

      // Reset Audio
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  // --- Recording Logic ---
  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
  };

  const startRecording = async () => {
    try {
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        alert("Your browser does not support valid video recording formats.");
        return;
      }

      if (!fullScreenMode) {
        toggleFullScreen();
        await new Promise(r => setTimeout(r, 500));
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        preferCurrentTab: true,
      } as any);

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `reel-export-${Date.now()}.${ext}`;
        a.click();

        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.warn("Auto-play blocked", e));
        setIframeKey(prev => prev + 1); // Also reset iframe on recording start
      }

    } catch (err) {
      console.error("Recording failed", err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (videoRef.current) videoRef.current.pause();
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center ${fullScreenMode ? 'fixed inset-0 z-50 bg-black' : 'h-full'}`}>

      {/* Mobile Phone Preview Container - 405px × 720px (9:16 aspect ratio) */}
      {/* Matches real phone dimensions (iPhone/Android) for accurate preview */}
      <div
        className="relative bg-black overflow-hidden shadow-2xl border border-gray-800"
        style={{
          width: fullScreenMode ? '100vh' : '405px',
          height: fullScreenMode ? '100vh' : '720px',
          aspectRatio: '9/16',
          maxWidth: fullScreenMode ? '100vw' : '100%',
          cursor: isRecording ? 'none' : 'default'
        }}
      >
        {/* HTML Animation Container - Hidden when end screen is active */}
        <div
          className="absolute top-0 left-0 w-full overflow-hidden bg-gray-900 transition-opacity duration-500"
          style={{
            ...layoutStyles.htmlContainer,
            opacity: shouldShowEndScreen ? 0 : 1,
            pointerEvents: shouldShowEndScreen ? 'none' : 'auto'
          }}
        >
          <iframe
            key={iframeKey} // Force Re-render on key change
            ref={iframeRef}
            srcDoc={htmlContent}
            onLoad={handleIframeLoad}
            title="Generated Animation"
            className="w-full h-full border-0 pointer-events-none select-none"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        {/* Video Container - Hidden when end screen is active */}
        <div
          className="absolute bottom-0 left-0 w-full overflow-hidden bg-black transition-opacity duration-500"
          style={{
            ...layoutStyles.videoContainer,
            opacity: shouldShowEndScreen ? 0 : 1
          }}
        >
          {/* Main Video */}
          <video
            key={videoUrl}
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover"
            style={{ 
              transform: 'scaleX(-1)',
              WebkitTransform: 'scaleX(-1)'
            }}
            playsInline
            muted={false}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const vid = e.currentTarget;
              console.log('📹 onLoadedMetadata inline handler, duration:', vid.duration);
              if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
                setDuration(vid.duration);
              } else if (!isFinite(vid.duration)) {
                console.warn('⚠️ Duration is Infinity, will estimate from SRT data');
              }
            }}
          />
          {/* Background Music - Hidden */}
          <audio
            ref={audioRef}
            loop
          />
        </div>

        {/* Only show captions when end screen is NOT active */}
        {currentCaption && !shouldShowEndScreen && (
          <div style={captionStyle}>
            <div className="relative group max-w-[95%]">
              {renderAnimatedCaption()}
            </div>
          </div>
        )}

        {/* End Screen - Full overlay, hides everything else */}
        {/* Audio continues playing in background */}
        {shouldShowEndScreen && (
          <div className="absolute inset-0 z-50 animate-fade-in">
            <EndScreen
              profileImage={endScreenProfileImage}
              name={endScreenName}
              tagline={endScreenTagline}
              socialHandles={endScreenSocialHandles}
              showSocialIcons={showEndScreenSocialIcons}
            />
          </div>
        )}

        {!fullScreenMode && !isRecording && (
          <div className="absolute bottom-4 left-0 w-full px-4 flex items-center justify-between z-50 opacity-0 hover:opacity-100 transition-opacity">
            <button onClick={togglePlay} className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur rounded-full text-white">
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <span className="text-xs font-mono text-white/80 bg-black/40 px-2 py-1 rounded" title={`Duration state: ${duration} (finite: ${isFinite(duration)}, >0: ${duration > 0})`}>
              {currentTime.toFixed(1)}s / {duration > 0 && isFinite(duration) ? duration.toFixed(1) : '...'}{duration > 0 && !isFinite(duration) ? '(∞)' : ''}s
            </span>
            <button onClick={restart} className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur rounded-full text-white" title="Restart & Reload HTML">
              <RefreshCw size={20} />
            </button>
          </div>
        )}
      </div>

      {!isRecording && (
        <div className="mt-4 flex gap-4">
           <button
            onClick={togglePlay}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={toggleFullScreen}
            className="flex items-center gap-2 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            {fullScreenMode ? <Minimize size={18} /> : <Maximize size={18} />}
            {fullScreenMode ? 'Exit Fullscreen' : 'Fullscreen Preview'}
          </button>

          <button
            onClick={() => setShowExportInfo(true)}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors shadow-lg shadow-red-900/20"
          >
            <Video size={18} />
            Rec & Export
          </button>
        </div>
      )}

      {/* Export Information Modal */}
      {showExportInfo && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
              <button
                onClick={() => setShowExportInfo(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4 text-amber-500">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-white">Export Unavailable</h3>
              </div>

              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                Server-side FFmpeg recording is currently <strong>disabled</strong> for the Public Preview.
              </p>

              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-6 text-xs text-red-200 font-mono">
                 "Running video rendering for everyone for free would melt my servers! 🔥"
              </div>

              <div className="bg-black/40 p-4 rounded-lg border border-gray-800 mb-6">
                <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                   <Monitor size={14} className="text-purple-400"/> Recommendation:
                </h4>
                <p className="text-xs text-gray-400">
                  Use <strong>OBS Studio</strong> or your system's screen recorder to capture the playback in high quality.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                 <button
                   onClick={() => setShowExportInfo(false)}
                   className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm"
                 >
                   Got it, I'll use OBS
                 </button>

                 <button
                   onClick={() => {
                     setShowExportInfo(false);
                     startRecording();
                   }}
                   className="text-[10px] text-gray-500 hover:text-gray-300 underline"
                 >
                   Try Browser Recorder (Experimental/Client-Side)
                 </button>
              </div>
           </div>
        </div>
      )}

      {isRecording && (
        <div className="fixed top-4 right-4 z-[100]">
           <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold shadow-2xl animate-pulse"
          >
            <StopCircle size={20} />
            Stop Recording
          </button>
        </div>
      )}

       <div className="mt-2 text-gray-500 text-sm">
         {!isRecording && fullScreenMode && "Press ESC to exit fullscreen"}
         {isRecording && "Recording in progress... content will auto-download on finish."}
       </div>
    </div>
  );
};
