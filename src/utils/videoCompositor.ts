/**
 * Video Compositor - High-quality video export with original audio
 * Uses display capture to record the player with all animations
 */

export interface ExportOptions {
  videoElement: HTMLVideoElement;
  onProgress?: (progress: number) => void;
  projectName?: string;
}

/**
 * Export video with display capture
 * Captures video + animations + subtitles with original audio
 */
export async function exportCompositeVideo(options: ExportOptions): Promise<void> {
  const { videoElement, onProgress, projectName } = options;
  
  console.log('🎬 Starting video export...');

  try {
    // Get supported MIME type
    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      throw new Error('No supported video format found in your browser');
    }

    console.log('📹 Using codec:', mimeType);

    // Request display capture
    console.log('📺 Requesting screen capture...');
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
        frameRate: 30,
        width: { ideal: 1080 },
        height: { ideal: 1920 },
      } as any,
      audio: false, // We'll add audio separately
      preferCurrentTab: true,
    } as any);

    console.log('✅ Screen capture granted');

    // Capture audio from video element
    let audioContext: AudioContext | null = null;
    let mediaElementSource: MediaElementAudioSourceNode | null = null;

    try {
      audioContext = new AudioContext();
      mediaElementSource = audioContext.createMediaElementSource(videoElement);
      const dest = audioContext.createMediaStreamDestination();
      mediaElementSource.connect(dest);
      mediaElementSource.connect(audioContext.destination); // Keep audio playing

      // Add audio tracks to display stream
      const audioTracks = dest.stream.getAudioTracks();
      audioTracks.forEach(track => {
        displayStream.addTrack(track);
      });
      console.log('✅ Audio captured from video');
    } catch (audioError) {
      console.warn('⚠️ Could not capture audio:', audioError);
      alert('⚠️ Audio may not be included in export. Please check browser permissions.');
    }

    // Create MediaRecorder
    const recorder = new MediaRecorder(displayStream, {
      mimeType,
      videoBitsPerSecond: 10000000, // 10 Mbps for high quality
    });

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    // Start recording
    recorder.start(100);
    console.log('🔴 Recording started');

    // Reset and play video from start
    videoElement.currentTime = 0;
    await videoElement.play();

    // Track progress
    const progressInterval = setInterval(() => {
      if (videoElement.duration > 0 && onProgress) {
        const progress = (videoElement.currentTime / videoElement.duration) * 100;
        onProgress(Math.min(progress, 99));
      }
    }, 100);

    // Wait for video to end
    await new Promise<void>((resolve) => {
      videoElement.onended = () => {
        clearInterval(progressInterval);
        resolve();
      };
    });

    console.log('⏹️ Stopping recording...');

    // Stop recording
    recorder.stop();
    displayStream.getTracks().forEach(track => track.stop());

    // Cleanup audio
    if (mediaElementSource) {
      mediaElementSource.disconnect();
    }
    if (audioContext) {
      await audioContext.close();
    }

    // Wait for final data and download
    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        if (onProgress) onProgress(100);
        
        const blob = new Blob(chunks, { type: mimeType });
        const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
        console.log('📦 Video size:', sizeMB, 'MB');

        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const safeName = projectName 
          ? projectName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
          : 'reel';
        const timestamp = new Date().toISOString().slice(0, 10);
        a.download = `${safeName}-${timestamp}.${ext}`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        console.log('✅ Download complete:', a.download);
        
        resolve();
      };
    });

  } catch (error: any) {
    console.error('❌ Export failed:', error);
    
    if (error.name === 'NotAllowedError') {
      throw new Error('Screen capture was cancelled or denied. Please try again and allow screen sharing.');
    }
    
    throw new Error(`Export failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get supported MIME type for video recording
 */
function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return '';
}
