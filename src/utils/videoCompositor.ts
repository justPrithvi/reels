/**
 * Video Compositor - Automated screen recording with better quality
 * Captures the exact rendered output (video + HTML animations + subtitles)
 */

export interface ExportOptions {
  containerElement: HTMLElement;
  videoElement: HTMLVideoElement;
  onProgress?: (progress: number) => void;
}

/**
 * Export video using automated screen recording
 * This captures EXACTLY what you see on screen
 */
export async function exportCompositeVideo(
  videoElement: HTMLVideoElement,
  overlayElement: HTMLIFrameElement,
  onProgress?: (progress: number) => void
): Promise<void> {
  console.log('🎬 Starting automated video export...');

  // Find the container element (parent of video)
  const container = videoElement.closest('.relative') as HTMLElement;
  if (!container) {
    throw new Error('Could not find player container');
  }

  try {
    // Get supported MIME type
    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      throw new Error('No supported video format found in your browser');
    }

    console.log('📹 Using codec:', mimeType);

    // Request screen/tab capture
    console.log('📺 Requesting screen capture...');
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
        frameRate: 30,
        width: 1080,
        height: 1920,
      } as any,
      audio: true,
      preferCurrentTab: true,
    } as any);

    console.log('✅ Screen capture granted');

    // Get audio from video element
    let audioContext: AudioContext | null = null;
    let mediaElementSource: MediaElementAudioSourceNode | null = null;

    try {
      audioContext = new AudioContext();
      mediaElementSource = audioContext.createMediaElementSource(videoElement);
      const dest = audioContext.createMediaStreamDestination();
      mediaElementSource.connect(dest);
      mediaElementSource.connect(audioContext.destination); // Keep playing audio

      // Add audio tracks to display stream
      dest.stream.getAudioTracks().forEach(track => {
        displayStream.addTrack(track);
      });
    } catch (audioError) {
      console.warn('⚠️ Could not capture audio from video:', audioError);
    }

    // Create MediaRecorder
    const recorder = new MediaRecorder(displayStream, {
      mimeType,
      videoBitsPerSecond: 8000000, // 8 Mbps for high quality
    });

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    // Start recording
    recorder.start(100); // Collect data every 100ms
    console.log('🔴 Recording started');

    // Reset and play video from start
    videoElement.currentTime = 0;
    await videoElement.play();

    // Track progress
    const progressInterval = setInterval(() => {
      if (videoElement.duration > 0 && onProgress) {
        const progress = (videoElement.currentTime / videoElement.duration) * 100;
        onProgress(Math.min(progress, 99)); // Never show 100% until actually done
      }
    }, 100);

    // Wait for video to end
    await new Promise<void>((resolve) => {
      videoElement.onended = () => {
        clearInterval(progressInterval);
        resolve();
      };
    });

    console.log('⏹️ Video playback ended, stopping recording...');

    // Stop recording
    recorder.stop();
    displayStream.getTracks().forEach(track => track.stop());

    // Cleanup audio
    if (mediaElementSource) {
      mediaElementSource.disconnect();
    }
    if (audioContext) {
      audioContext.close();
    }

    // Wait for final data and download
    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        if (onProgress) onProgress(100);
        
        const blob = new Blob(chunks, { type: mimeType });
        console.log('📦 Video size:', (blob.size / 1024 / 1024).toFixed(2), 'MB');

        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        a.download = `reel-composer-${timestamp}.${ext}`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
        console.log('✅ Download complete:', a.download);
        
        resolve();
      };
    });

  } catch (error: any) {
    console.error('❌ Export failed:', error);
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
