import React from 'react';
import { ReelPlayer } from './ReelPlayer.tsx';
import { EditorPanel } from './EditorPanel.tsx';
import { GeneratedContent, SRTItem } from '@/types.ts';

interface EditorViewProps {
  projectId?: number;
  videoUrl: string;
  srtData: SRTItem[];
  generatedContent: GeneratedContent;
  isFullScreen: boolean;
  toggleFullScreen: () => void;
  bgMusicUrl?: string;
  bgMusicVolume: number;
  isGenerating: boolean;
  onGenerate: () => void;
  onUpdate: (content: GeneratedContent) => void;
  videoFile: File | null;
  topicContext: string;
  onTopicContextChange: (text: string) => void;
  srtText: string;
  bgMusicName?: string;
  onBgMusicChange: (file: File | null) => void;
  onBgVolumeChange: (vol: number) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  modelName: string;
  setModelName: (name: string) => void;
  onSaveApiKey: () => void;
  subtitleFontSize: number;
  onSubtitleFontSizeChange: (size: number) => void;
  subtitleFontFamily: string;
  onSubtitleFontFamilyChange: (family: string) => void;
  subtitleColor: string;
  onSubtitleColorChange: (color: string) => void;
  subtitleBgColor: string;
  onSubtitleBgColorChange: (color: string) => void;
  subtitleBgOpacity: number;
  onSubtitleBgOpacityChange: (opacity: number) => void;
  subtitlePaddingX: number;
  onSubtitlePaddingXChange: (padding: number) => void;
  subtitlePaddingY: number;
  onSubtitlePaddingYChange: (padding: number) => void;
  subtitleMaxWidth: number;
  onSubtitleMaxWidthChange: (width: number) => void;
  // End Screen Props
  showEndScreen: boolean;
  onShowEndScreenChange: (show: boolean) => void;
  endScreenProfileImage: string;
  onEndScreenProfileImageChange: (url: string) => void;
  endScreenName: string;
  onEndScreenNameChange: (name: string) => void;
  endScreenTagline: string;
  onEndScreenTaglineChange: (tagline: string) => void;
  endScreenInstagram: string;
  onEndScreenInstagramChange: (handle: string) => void;
  endScreenYoutube: string;
  onEndScreenYoutubeChange: (handle: string) => void;
  endScreenTwitter: string;
  onEndScreenTwitterChange: (handle: string) => void;
  showEndScreenSocialIcons: boolean;
  onShowEndScreenSocialIconsChange: (show: boolean) => void;
  endScreenStartTime?: number;
  onEndScreenStartTimeChange: (time: number | undefined) => void;
  endScreenEndTime?: number;
  onEndScreenEndTimeChange: (time: number | undefined) => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
  projectId,
  videoUrl,
  srtData,
  generatedContent,
  isFullScreen,
  toggleFullScreen,
  bgMusicUrl,
  bgMusicVolume,
  isGenerating,
  onGenerate,
  onUpdate,
  videoFile,
  topicContext,
  onTopicContextChange,
  srtText,
  bgMusicName,
  onBgMusicChange,
  onBgVolumeChange,
  apiKey,
  setApiKey,
  modelName,
  setModelName,
  onSaveApiKey,
  subtitleFontSize,
  onSubtitleFontSizeChange,
  subtitleFontFamily,
  onSubtitleFontFamilyChange,
  subtitleColor,
  onSubtitleColorChange,
  subtitleBgColor,
  onSubtitleBgColorChange,
  subtitleBgOpacity,
  onSubtitleBgOpacityChange,
  subtitlePaddingX,
  onSubtitlePaddingXChange,
  subtitlePaddingY,
  onSubtitlePaddingYChange,
  subtitleMaxWidth,
  onSubtitleMaxWidthChange,
  showEndScreen,
  onShowEndScreenChange,
  endScreenProfileImage,
  onEndScreenProfileImageChange,
  endScreenName,
  onEndScreenNameChange,
  endScreenTagline,
  onEndScreenTaglineChange,
  endScreenInstagram,
  onEndScreenInstagramChange,
  endScreenYoutube,
  onEndScreenYoutubeChange,
  endScreenTwitter,
  onEndScreenTwitterChange,
  showEndScreenSocialIcons,
  onShowEndScreenSocialIconsChange,
  endScreenStartTime,
  onEndScreenStartTimeChange,
  endScreenEndTime,
  onEndScreenEndTimeChange
}) => {
  return (
    <div className="flex h-full">
      {/* Left: Player */}
      <div
        className={`w-[40%] flex flex-col items-center justify-center bg-black/20 relative transition-all duration-300 ${isFullScreen ? 'w-full fixed inset-0 z-50 bg-black' : ''}`}
      >
        <ReelPlayer
          videoUrl={videoUrl}
          srtData={srtData}
          htmlContent={generatedContent.html}
          layoutConfig={generatedContent.layoutConfig}
          fullScreenMode={isFullScreen}
          toggleFullScreen={toggleFullScreen}
          bgMusicUrl={bgMusicUrl}
          bgMusicVolume={bgMusicVolume}
          subtitleFontSize={subtitleFontSize}
          subtitleFontFamily={subtitleFontFamily}
          subtitleColor={subtitleColor}
          subtitleBgColor={subtitleBgColor}
          subtitleBgOpacity={subtitleBgOpacity}
          subtitlePaddingX={subtitlePaddingX}
          subtitlePaddingY={subtitlePaddingY}
          subtitleMaxWidth={subtitleMaxWidth}
          showEndScreen={showEndScreen}
          endScreenProfileImage={endScreenProfileImage}
          endScreenName={endScreenName}
          endScreenTagline={endScreenTagline}
          endScreenSocialHandles={{
            instagram: endScreenInstagram,
            youtube: endScreenYoutube,
            twitter: endScreenTwitter
          }}
          showEndScreenSocialIcons={showEndScreenSocialIcons}
          endScreenStartTime={endScreenStartTime}
          endScreenEndTime={endScreenEndTime}
        />
      </div>

      {/* Right: Code/Config Editor (Hidden if fullscreen) */}
      {!isFullScreen && (
        <div className="w-[60%] border-l border-gray-800 bg-gray-900 z-10 shadow-2xl">
          <EditorPanel
            projectId={projectId}
            content={generatedContent}
            isGenerating={isGenerating}
            onGenerate={onGenerate}
            onUpdate={onUpdate}
            videoFile={videoFile}
            topicContext={topicContext}
            onTopicContextChange={onTopicContextChange}
            srtText={srtText}
            srtData={srtData}
            bgMusicName={bgMusicName}
            onBgMusicChange={onBgMusicChange}
            bgMusicVolume={bgMusicVolume}
            onBgVolumeChange={onBgVolumeChange}
            apiKey={apiKey}
            setApiKey={setApiKey}
            modelName={modelName}
            setModelName={setModelName}
            onSaveApiKey={onSaveApiKey}
            subtitleFontSize={subtitleFontSize}
            onSubtitleFontSizeChange={onSubtitleFontSizeChange}
            subtitleFontFamily={subtitleFontFamily}
            onSubtitleFontFamilyChange={onSubtitleFontFamilyChange}
            subtitleColor={subtitleColor}
            onSubtitleColorChange={onSubtitleColorChange}
            subtitleBgColor={subtitleBgColor}
            onSubtitleBgColorChange={onSubtitleBgColorChange}
            subtitleBgOpacity={subtitleBgOpacity}
            onSubtitleBgOpacityChange={onSubtitleBgOpacityChange}
            subtitlePaddingX={subtitlePaddingX}
            onSubtitlePaddingXChange={onSubtitlePaddingXChange}
            subtitlePaddingY={subtitlePaddingY}
            onSubtitlePaddingYChange={onSubtitlePaddingYChange}
            subtitleMaxWidth={subtitleMaxWidth}
            onSubtitleMaxWidthChange={onSubtitleMaxWidthChange}
            showEndScreen={showEndScreen}
            onShowEndScreenChange={onShowEndScreenChange}
            endScreenProfileImage={endScreenProfileImage}
            onEndScreenProfileImageChange={onEndScreenProfileImageChange}
            endScreenName={endScreenName}
            onEndScreenNameChange={onEndScreenNameChange}
            endScreenTagline={endScreenTagline}
            onEndScreenTaglineChange={onEndScreenTaglineChange}
            endScreenInstagram={endScreenInstagram}
            onEndScreenInstagramChange={onEndScreenInstagramChange}
            endScreenYoutube={endScreenYoutube}
            onEndScreenYoutubeChange={onEndScreenYoutubeChange}
            endScreenTwitter={endScreenTwitter}
            onEndScreenTwitterChange={onEndScreenTwitterChange}
            showEndScreenSocialIcons={showEndScreenSocialIcons}
            onShowEndScreenSocialIconsChange={onShowEndScreenSocialIconsChange}
            endScreenStartTime={endScreenStartTime}
            onEndScreenStartTimeChange={onEndScreenStartTimeChange}
            endScreenEndTime={endScreenEndTime}
            onEndScreenEndTimeChange={onEndScreenEndTimeChange}
          />
        </div>
      )}
    </div>
  );
};
