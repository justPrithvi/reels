import React, { useState, useEffect } from 'react';
import { Sparkles, Loader, X, Code } from 'lucide-react';
import { getAnimationSegments, updateAnimationSegment, saveGeneratedContent } from '@/src/services/apiClient';
import { generateSegmentHTML, mergeSegmentHTMLs } from '@/src/services/geminiService';

interface AnimationSegment {
  id: number;
  segment_index: number;
  start_time: number;
  end_time: number;
  text: string;
  animation_type: string;
  generated_html: string | null;
  prompt_used: string | null;
}

interface SegmentEditorProps {
  projectId: number;
  apiKey: string;
  modelName: string;
  onContentUpdate: (html: string, layoutConfig: any[]) => void;
}

export const SegmentEditor: React.FC<SegmentEditorProps> = ({
  projectId,
  apiKey,
  modelName,
  onContentUpdate
}) => {
  const [segments, setSegments] = useState<AnimationSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<AnimationSegment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  // Load animation segments on mount
  useEffect(() => {
    const fetchSegments = async () => {
      try {
        setLoading(true);
        const data = await getAnimationSegments(projectId);
        setSegments(data);
      } catch (error) {
        console.error('Failed to load animation segments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSegments();
  }, [projectId]);

  const handleOpenModal = (segment: AnimationSegment) => {
    setSelectedSegment(segment);
    setShowModal(true);
    setPrompt(segment.prompt_used || '');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSegment(null);
    setPrompt('');
  };

  const handleRegenerate = async () => {
    if (!selectedSegment || !prompt.trim()) return;

    try {
      setRegenerating(true);
      
      // Generate new HTML for this specific segment
      const result = await generateSegmentHTML(
        {
          startTime: selectedSegment.start_time,
          endTime: selectedSegment.end_time,
          text: selectedSegment.text,
          animationType: selectedSegment.animation_type
        },
        prompt,
        apiKey,
        modelName
      );
      
      // Update segment in database
      await updateAnimationSegment(projectId, selectedSegment.id, {
        generatedHtml: result.html,
        promptUsed: prompt
      });
      
      // Update local state
      const updatedSegments = segments.map(seg => 
        seg.id === selectedSegment.id 
          ? { ...seg, generated_html: result.html, prompt_used: prompt }
          : seg
      );
      setSegments(updatedSegments);
      
      // Update selected segment to show new HTML
      setSelectedSegment(prev => prev ? { ...prev, generated_html: result.html, prompt_used: prompt } : null);
      
      // Merge all segments and update the full content
      const segmentsForMerge = updatedSegments.map((seg, idx) => ({
        id: idx + 1,
        startTime: seg.start_time,
        endTime: seg.end_time,
        html: seg.generated_html || '<div>Loading...</div>',
        layoutMode: 'split' as const,
        splitRatio: 0.6
      }));
      
      const { html: finalHTML, layoutConfig } = mergeSegmentHTMLs(segmentsForMerge);
      
      // Save merged content
      await saveGeneratedContent(projectId, finalHTML, layoutConfig, '');
      
      // Notify parent to update the display
      onContentUpdate(finalHTML, layoutConfig);
      
      alert('✅ Segment regenerated successfully!');
    } catch (error: any) {
      console.error('Regeneration error:', error);
      alert(`❌ ${error.message}`);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader size={24} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Sparkles size={48} className="text-gray-600 mb-4" />
        <p className="text-gray-400 text-sm">No animation segments yet.</p>
        <p className="text-gray-500 text-xs mt-2">Generate content to create segments.</p>
      </div>
    );
  }

  return (
    <>
      {/* Segment List - Compact View */}
    <div className="flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b-2 border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            Animation Segments
          </h3>
          <p className="text-gray-300 text-xs mt-1">
            {segments.length} optimized segments • Click to customize
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {segments.map((segment) => (
          <div
              key={segment.id}
              onClick={() => handleOpenModal(segment)}
              className="p-2.5 rounded-lg border cursor-pointer transition-all bg-gray-800/70 border-gray-600 hover:border-purple-500/50 hover:bg-gray-800/90 hover:shadow-md hover:shadow-purple-500/10"
          >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-gray-400 bg-black/30 px-1.5 py-0.5 rounded">
                  #{segment.segment_index + 1} · {segment.start_time.toFixed(1)}s - {segment.end_time.toFixed(1)}s
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">
                    {segment.animation_type}
                  </span>
                  {segment.generated_html && (
                    <Code size={12} className="text-green-400" />
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-200 leading-snug line-clamp-2">{segment.text}</p>
            </div>
          ))}
          </div>
      </div>

      {/* Right Side Panel */}
      {showModal && selectedSegment && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border-l-2 border-purple-500/40 shadow-2xl w-1/2 h-full flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-purple-500/30 bg-gray-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400">
                  Segment #{selectedSegment.segment_index + 1} · {selectedSegment.start_time.toFixed(1)}s - {selectedSegment.end_time.toFixed(1)}s
                </span>
                <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded">
                  {selectedSegment.animation_type}
                </span>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                <X size={18} className="text-gray-400 hover:text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Segment Text */}
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                <p className="text-sm text-white leading-relaxed">{selectedSegment.text}</p>
      </div>

      {/* Prompt Input */}
              <div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe animation style, effects, or mood..."
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-600 rounded text-white text-sm resize-none focus:outline-none focus:border-purple-400 placeholder:text-gray-500"
                  rows={4}
              disabled={regenerating}
            />
              </div>

              {/* Generated HTML Preview */}
              {selectedSegment.generated_html && (
                <div className="flex-1 bg-gray-950 rounded border border-green-500/30 overflow-hidden flex flex-col min-h-[300px]">
                  <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center gap-2">
                    <Code size={14} className="text-green-400" />
                    <span className="text-xs text-green-300 font-semibold">Generated HTML</span>
                  </div>
                  <div className="flex-1 p-3 overflow-y-auto">
                    <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                      {selectedSegment.generated_html}
                    </pre>
                  </div>
                </div>
              )}
          </div>

            {/* Footer */}
            <div className="p-3 border-t border-purple-500/30 bg-gray-800/50 flex gap-2">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded font-semibold transition-all"
              >
                Cancel
              </button>
          <button
            onClick={handleRegenerate}
            disabled={!prompt.trim() || regenerating}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white text-sm rounded font-bold flex items-center justify-center gap-2 transition-all"
          >
            {regenerating ? (
              <>
                    <Loader size={16} className="animate-spin" />
                    Generating...
              </>
            ) : (
              <>
                    <Sparkles size={16} />
                    Regenerate
              </>
            )}
          </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
