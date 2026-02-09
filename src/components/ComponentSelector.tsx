import React, { useState, useRef, useEffect } from 'react';
import { ComponentRegistry } from '@/src/animationComponents/registry';
import { AnimationComponent } from '@/src/animationComponents/types';
import { generateAnimationComponent, autoGenerateComponentsForVideo } from '@/src/services/geminiService';
import '@/src/animationComponents/library/index';
import { Sparkles, Check, Play, Save, Loader2, X, AlertCircle, Settings } from 'lucide-react';
import { APP_CONFIG } from '@/config';

interface ComponentSelectorProps {
  selectedComponentIds: string[];
  onSelectionChange: (ids: string[]) => void;
  apiKey: string;
  componentSettings?: { [componentId: string]: any };
  onSettingsChange?: (settings: { [componentId: string]: any }) => void;
  srtText?: string;
}

export const ComponentSelector: React.FC<ComponentSelectorProps> = ({
  selectedComponentIds,
  onSelectionChange,
  apiKey,
  componentSettings = {},
  onSettingsChange,
  videoDescription = '',
  srtText = ''
}) => {
  const [showGenerator, setShowGenerator] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [componentDescription, setComponentDescription] = useState('');
  const [exampleUsage, setExampleUsage] = useState('');
  const [previewComponent, setPreviewComponent] = useState<AnimationComponent | null>(null);
  const [error, setError] = useState<string>('');
  const [previewingComponent, setPreviewingComponent] = useState<AnimationComponent | null>(null);
  const [editingComponent, setEditingComponent] = useState<AnimationComponent | null>(null);
  const [editingParams, setEditingParams] = useState<any>({});
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render when components change
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const editingIframeRef = useRef<HTMLIFrameElement>(null);
  
  const allComponents = ComponentRegistry.getAll();
  
  const toggleComponent = (id: string) => {
    const component = ComponentRegistry.get(id);
    
    if (selectedComponentIds.includes(id)) {
      onSelectionChange(selectedComponentIds.filter(cid => cid !== id));
      // If we're removing the previewed component, clear or show another
      if (previewingComponent?.id === id) {
        const remaining = selectedComponentIds.filter(cid => cid !== id);
        if (remaining.length > 0) {
          const lastComponent = ComponentRegistry.get(remaining[remaining.length - 1]);
          setPreviewingComponent(lastComponent || null);
        } else {
          setPreviewingComponent(null);
        }
      }
    } else {
      onSelectionChange([...selectedComponentIds, id]);
      // Show preview of newly selected component
      setPreviewingComponent(component || null);
    }
  };
  
  // Update preview when component changes - Using same mechanism as Component Gallery
  useEffect(() => {
    if (!previewingComponent) return;
    
    // Start with custom settings if they exist
    const customSettings = componentSettings[previewingComponent.id] || {};
    
    // Build params: custom settings + defaults
    const defaultParams: any = { ...customSettings };
    Object.entries(previewingComponent.paramsSchema).forEach(([key, schema]) => {
      // Skip if custom setting already exists
      if (defaultParams[key] !== undefined) return;
      
      if (schema.default !== undefined) {
        defaultParams[key] = schema.default;
      } else if (schema.required || true) { // Always provide defaults
        if (schema.type === 'string') defaultParams[key] = schema.description || key;
        else if (schema.type === 'number') defaultParams[key] = 1;
        else if (schema.type === 'boolean') defaultParams[key] = true;
        else if (schema.type === 'array') defaultParams[key] = ['Item 1', 'Item 2', 'Item 3'];
        else if (schema.type === 'color') defaultParams[key] = '#00f3ff';
      }
    });
    
    const { html, css, script } = previewingComponent.render(defaultParams, 5); // 5 second duration like Gallery
    
    const previewHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          * {
            box-sizing: border-box;
          }
          body, html {
            margin: 0;
            padding: 0;
            background: #050505;
            color: white;
            font-family: 'Oswald', sans-serif;
            overflow: hidden;
            width: 100%;
            height: 100%;
          }
          ${css}
        </style>
      </head>
      <body>
        ${html}
        <script>
          /* Wait for GSAP to load - Same as Component Gallery */
          function initAnimation() {
            if (typeof gsap === 'undefined') {
              setTimeout(initAnimation, 100);
              return;
            }
            
            try {
              /* Execute the animation script - this creates and returns a timeline */
              var tl = (function() {
                ${script}
              })();
              
              /* Play the timeline */
              if (tl && typeof tl.play === 'function') {
                tl.play();
              }
            } catch (err) {
              console.error('Animation error:', err);
            }
          }
          
          /* Start when DOM is ready */
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAnimation);
          } else {
            initAnimation();
          }
        </script>
      </body>
      </html>
    `;
    
    if (previewIframeRef.current) {
      previewIframeRef.current.srcdoc = previewHTML;
    }
  }, [previewingComponent, componentSettings]);
  
  const selectAll = () => {
    onSelectionChange(allComponents.map(c => c.id));
  };
  
  const deselectAll = () => {
    onSelectionChange([]);
    setPreviewingComponent(null);
  };
  
  const openSettingsEditor = (componentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling selection
    const component = ComponentRegistry.get(componentId);
    if (!component) return;
    
    // Load existing settings or defaults - SAME AS MAIN PREVIEW
    const currentSettings = componentSettings[componentId] || {};
    const params: any = {};
    
    Object.entries(component.paramsSchema).forEach(([key, schema]) => {
      if (currentSettings[key] !== undefined) {
        params[key] = currentSettings[key];
      } else if (schema.default !== undefined) {
        params[key] = schema.default;
      } else if (schema.required || true) { // Always provide defaults for preview
        // Better defaults that make components visible
        if (schema.type === 'string') params[key] = schema.description || key;
        else if (schema.type === 'number') params[key] = 1;
        else if (schema.type === 'boolean') params[key] = true;
        else if (schema.type === 'array') params[key] = ['Item 1', 'Item 2', 'Item 3'];
        else if (schema.type === 'color') params[key] = '#00f3ff';
      }
    });
    
    setEditingComponent(component);
    setEditingParams(params);
  };
  
  const applySettings = () => {
    if (!editingComponent || !onSettingsChange) return;
    
    const newSettings = {
      ...componentSettings,
      [editingComponent.id]: { ...editingParams }
    };
    
    onSettingsChange(newSettings);
    
    // Update preview if this component is being previewed
    if (previewingComponent?.id === editingComponent.id) {
      setPreviewingComponent(editingComponent);
    }
    
    setEditingComponent(null);
    setEditingParams({});
  };
  
  const updateEditingParam = (key: string, value: any) => {
    setEditingParams({ ...editingParams, [key]: value });
  };
  
  // Update preview when editing params change
  useEffect(() => {
    if (!editingComponent) return;
    
    // Small delay to ensure iframe is mounted
    const timer = setTimeout(() => {
      if (!editingIframeRef.current) {
        console.warn('⚠️ Editing iframe ref not ready');
        return;
      }
      
      try {
        // Verify we have the necessary params
        const hasRequiredParams = Object.keys(editingParams).length > 0;
        if (!hasRequiredParams) return;
        
        const { html, css, script } = editingComponent.render(editingParams, 5);
      
      const previewHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
          <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            * {
              box-sizing: border-box;
            }
            body, html {
              margin: 0;
              padding: 0;
              background: #050505;
              color: white;
              font-family: 'Oswald', sans-serif;
              overflow: hidden;
              width: 100%;
              height: 100%;
            }
            ${css}
          </style>
        </head>
        <body>
          ${html}
          <script>
            /* Wait for GSAP to load */
            function initAnimation() {
              if (typeof gsap === 'undefined') {
                setTimeout(initAnimation, 100);
                return;
              }
              
              try {
                /* Execute the animation script */
                var tl = (function() {
                  ${script}
                })();
                
                /* Play the timeline */
                if (tl && typeof tl.play === 'function') {
                  tl.play();
                }
              } catch (err) {
                console.error('Animation error:', err);
              }
            }
            
            /* Start when DOM is ready */
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initAnimation);
            } else {
              initAnimation();
            }
          </script>
        </body>
        </html>
      `;
      
        editingIframeRef.current.srcdoc = previewHTML;
      } catch (err) {
        console.error('Preview error:', err);
      }
    }, 100); // Small delay for iframe mount
    
    return () => clearTimeout(timer);
  }, [editingComponent, editingParams]);
  
  const generateNewComponent = async () => {
    if (!componentDescription.trim()) {
      setError('Please describe the component');
      return;
    }
    
    if (!apiKey) {
      setError('API key is required');
      return;
    }
    
    setGenerating(true);
    setError('');
    
    try {
      const component = await generateAnimationComponent(
        componentDescription,
        exampleUsage,
        apiKey,
        APP_CONFIG.DEFAULT_MODEL
      );
      
      setPreviewComponent(component);
      
      // Preview the component
      const defaultParams: any = {};
      Object.keys(component.paramsSchema).forEach(key => {
        defaultParams[key] = component.paramsSchema[key].default || '';
      });
      
      const { html, css, script } = component.render(defaultParams, 3);
      
      const previewHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
          <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
          <style>
            :root {
              --bg-deep: #050505;
              --primary: #00f3ff;
              --success: #00ff9d;
              --warning: #ffd700;
              --danger: #ff0055;
              --white: #ffffff;
            }
            body {
              margin: 0;
              padding: 0;
              background: var(--bg-deep);
              color: var(--white);
              font-family: 'Oswald', sans-serif;
              overflow: hidden;
              width: 100%;
              height: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            ${css}
          </style>
        </head>
        <body>
          ${html}
          <script>
            (function() {
              function waitForGSAP() {
                if (typeof gsap !== 'undefined') {
                  try {
                    ${script}
                    if (typeof tl !== 'undefined') {
                      tl.play();
                    }
                  } catch (e) {
                    console.error('Animation error:', e);
                  }
                } else {
                  setTimeout(waitForGSAP, 50);
                }
              }
              waitForGSAP();
            })();
          </script>
        </body>
        </html>
      `;
      
      if (iframeRef.current) {
        iframeRef.current.srcdoc = previewHTML;
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to generate component');
      console.error('Component generation error:', err);
    } finally {
      setGenerating(false);
    }
  };
  
  const autoGenerateComponents = async () => {
    if (!srtText) {
      setError('Video script is required for auto-generation');
      return;
    }
    
    if (!apiKey) {
      setError('API key is required');
      return;
    }
    
    setAutoGenerating(true);
    setError('');
    
    try {
      // Generate description from srtText
      const description = `Video about: ${srtText.substring(0, Math.min(srtText.length, 200))}...`;
      
      console.log('🎬 Starting auto-generation...');
      console.log('   📝 Script length:', srtText.length, 'chars');
      console.log('   📄 Description:', description.substring(0, 100) + '...');
      
      const newComponents = await autoGenerateComponentsForVideo(
        description,
        srtText,
        apiKey,
        APP_CONFIG.DEFAULT_MODEL
      );
      
      // Register all new components
      console.log(`📦 Registering ${newComponents.length} new components...`);
      newComponents.forEach(comp => {
        console.log(`  → Registering: ${comp.id} (${comp.name})`);
        ComponentRegistry.register(comp);
      });
      
      console.log(`✅ All components registered. Total components: ${ComponentRegistry.getAll().length}`);
      
      // Force component list refresh
      setRefreshKey(prev => prev + 1);
      
      // Auto-select them
      const newIds = newComponents.map(c => c.id);
      console.log(`🎯 Auto-selecting new components:`, newIds);
      onSelectionChange([...selectedComponentIds, ...newIds]);
      
      // Preview the first generated component
      if (newComponents.length > 0) {
        setTimeout(() => {
          setPreviewingComponent(newComponents[0]);
        }, 100);
      }
      
      // Show success message briefly
      setError(`✅ Generated ${newComponents.length} components!`);
      setTimeout(() => setError(''), 3000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to auto-generate components');
      console.error('Auto-generation error:', err);
    } finally {
      setAutoGenerating(false);
    }
  };
  
  const saveComponent = () => {
    if (!previewComponent) return;
    
    // Register the component
    ComponentRegistry.register(previewComponent);
    
    // Auto-select it
    onSelectionChange([...selectedComponentIds, previewComponent.id]);
    
    // Close modal
    setShowGenerator(false);
    setPreviewComponent(null);
    setComponentDescription('');
    setExampleUsage('');
    setError('');
  };
  
  return (
    <div className="flex h-full gap-6">
      {/* Left Side - Component Selection */}
      <div className="flex flex-col" style={{ flex: '0 0 520px' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-bold text-white">Select Components</h4>
            <p className="text-xs text-gray-400">
              {selectedComponentIds.length} of {allComponents.length} selected
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
            >
              All
            </button>
            <button
              onClick={deselectAll}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
            >
              None
            </button>
          </div>
        </div>
        
        {/* Component Grid */}
        <div key={refreshKey} className="grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar flex-1">
          {allComponents.map((component) => {
            const isSelected = selectedComponentIds.includes(component.id);
            const isPreviewing = previewingComponent?.id === component.id;
            const hasCustomSettings = componentSettings[component.id] && Object.keys(componentSettings[component.id]).length > 0;
            return (
              <div key={component.id} className="relative">
                <button
                  onClick={() => toggleComponent(component.id)}
                  className={`w-full p-2.5 rounded-lg border transition-all text-left ${
                    isPreviewing
                      ? 'border-purple-500 bg-purple-500/20 ring-2 ring-purple-500/50'
                      : isSelected
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check size={9} className="text-white" />
                    </div>
                  )}
                  <div className="text-xs font-bold text-white mb-0.5 truncate pr-6">{component.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{component.category}</div>
                  
                  {/* Custom settings indicator */}
                  {hasCustomSettings && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-green-500 rounded text-[8px] font-bold text-black">
                      CUSTOM
                    </div>
                  )}
                </button>
                
                {/* Settings button for selected components */}
                {isSelected && (
                  <button
                    onClick={(e) => openSettingsEditor(component.id, e)}
                    className={`absolute bottom-1.5 right-1.5 p-1 rounded transition-colors ${
                      hasCustomSettings 
                        ? 'bg-green-600 hover:bg-green-500' 
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    title={hasCustomSettings ? 'Edit custom settings' : 'Customize settings'}
                  >
                    <Settings size={10} className="text-white" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Auto-Generate Button - PRIMARY */}
        <div className="mt-3 space-y-2">
          <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-2 border-cyan-500 rounded-lg p-3">
            <div className="text-xs text-cyan-300 mb-2 text-center font-semibold">
              🎯 RECOMMENDED
            </div>
            <button
              onClick={autoGenerateComponents}
              disabled={autoGenerating || !srtText}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg text-white font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {autoGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating Components...
                </>
              ) : (
                <>
                  <Sparkles size={18} className="animate-pulse" />
                  ✨ Generate 5-6 Components from Script
                </>
              )}
            </button>
            {!srtText ? (
              <div className="text-xs text-yellow-400 mt-2 text-center">
                ⚠️ Upload subtitles to enable auto-generation
              </div>
            ) : (
              <div className="text-xs text-gray-400 mt-2 text-center">
                Analyzes your video script and creates matching animations
              </div>
            )}
          </div>
        </div>
        
        {/* Manual Generate Button */}
        <button
          onClick={() => setShowGenerator(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-semibold transition-colors shadow-md text-sm"
        >
          <Sparkles size={16} />
          Generate Single Custom Component
        </button>
      </div>
      
      {/* Right Side - Preview */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-4">
          <h4 className="text-lg font-bold text-white mb-1">Preview</h4>
          <p className="text-sm text-gray-400">
            {previewingComponent ? previewingComponent.name : 'Click a component to preview'}
          </p>
        </div>
        
        {/* Preview Container - Exact phone dimensions */}
        <div className="border-2 border-gray-700 rounded-lg overflow-hidden bg-black shadow-2xl" style={{ width: '405px', height: '432px' }}>
          {previewingComponent ? (
            <iframe
              ref={previewIframeRef}
              className="w-full h-full"
              sandbox="allow-scripts"
              title="Component Preview"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
              Select a component to see preview
            </div>
          )}
        </div>
        
        {previewingComponent && (
          <div className="mt-4 text-xs text-gray-400 text-center max-w-md">
            This is how it will appear in the final reel (top 60% of phone screen)
          </div>
        )}
      </div>
      
      {/* Generator Modal */}
      {showGenerator && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles size={24} className="text-purple-400" />
                <div>
                  <h2 className="text-xl font-bold text-white">Generate Custom Component</h2>
                  <p className="text-sm text-gray-400">AI will create a new animation component for you</p>
                </div>
              </div>
              <button
                onClick={() => setShowGenerator(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Left: Input */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-white mb-2">
                      What should this component do?
                    </label>
                    <textarea
                      value={componentDescription}
                      onChange={(e) => setComponentDescription(e.target.value)}
                      className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none focus:border-blue-500 focus:outline-none"
                      placeholder="Example: Show a CDN with edge servers distributing content to users around the world"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-white mb-2">
                      Example text it will visualize (optional)
                    </label>
                    <textarea
                      value={exampleUsage}
                      onChange={(e) => setExampleUsage(e.target.value)}
                      className="w-full h-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none focus:border-blue-500 focus:outline-none"
                      placeholder="Example: Content is cached at edge locations and served to millions of users"
                    />
                  </div>
                  
                  <button
                    onClick={generateNewComponent}
                    disabled={generating || !apiKey}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white font-bold transition-colors"
                  >
                    {generating ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} />
                        Generate Component
                      </>
                    )}
                  </button>
                  
                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-700 rounded-lg">
                      <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}
                  
                  {!apiKey && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                      <AlertCircle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-400">
                        API key required for component generation
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Right: Preview */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-white mb-2">
                      Preview
                    </label>
                    <div className="bg-black border border-gray-700 rounded-lg overflow-hidden"
                         style={{ width: '405px', height: '432px' }}>
                      {previewComponent ? (
                        <iframe
                          ref={iframeRef}
                          className="w-full h-full"
                          sandbox="allow-scripts allow-same-origin"
                          title="Component Preview"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          Generate a component to preview
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {previewComponent && (
                    <div className="flex gap-3">
                      <button
                        onClick={saveComponent}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-white font-bold"
                      >
                        <Save size={18} />
                        Save to Library
                      </button>
                      <button
                        onClick={generateNewComponent}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-bold"
                      >
                        <Sparkles size={18} />
                        Regenerate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Settings Editor Modal */}
      {editingComponent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-h-[90vh] overflow-hidden flex flex-col" style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-white">Customize {editingComponent.name}</h3>
                <p className="text-sm text-gray-400">Adjust settings and preview in real-time</p>
              </div>
              <button
                onClick={() => setEditingComponent(null)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            
            {/* Content: Side by Side */}
            <div className="flex-1 overflow-hidden flex gap-4 p-4">
              {/* Left: Parameters */}
              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
              {Object.entries(editingComponent.paramsSchema).map(([key, schema]) => (
                <div key={key} className="space-y-1">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    {key}
                    {schema.required && <span className="text-red-400">*</span>}
                  </label>
                  <p className="text-xs text-gray-500 mb-1">{schema.description}</p>
                  
                  {schema.type === 'string' && schema.options ? (
                    <select
                      value={editingParams[key] || ''}
                      onChange={(e) => updateEditingParam(key, e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      {schema.options.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : schema.type === 'string' ? (
                    <input
                      type="text"
                      value={editingParams[key] || ''}
                      onChange={(e) => updateEditingParam(key, e.target.value)}
                      placeholder={schema.default as string}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  ) : schema.type === 'number' ? (
                    <input
                      type="number"
                      value={editingParams[key] || 0}
                      onChange={(e) => updateEditingParam(key, parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  ) : schema.type === 'boolean' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingParams[key] || false}
                        onChange={(e) => updateEditingParam(key, e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-300">
                        {editingParams[key] ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  ) : schema.type === 'color' ? (
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingParams[key] || '#00f3ff'}
                        onChange={(e) => updateEditingParam(key, e.target.value)}
                        className="w-16 h-10 border border-gray-600 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editingParams[key] || '#00f3ff'}
                        onChange={(e) => updateEditingParam(key, e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ) : schema.type === 'array' ? (
                    <textarea
                      value={Array.isArray(editingParams[key]) ? editingParams[key].join('\n') : ''}
                      onChange={(e) => updateEditingParam(key, e.target.value.split('\n').filter(Boolean))}
                      placeholder="One item per line"
                      rows={4}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(editingParams[key] || '')}
                      onChange={(e) => updateEditingParam(key, e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              ))}
              </div>
              
              {/* Right: Live Preview */}
              <div className="flex-shrink-0" style={{ width: '420px' }}>
                <div className="sticky top-0">
                  <h4 className="text-sm font-bold text-white mb-2">Live Preview</h4>
                  <div className="border-2 border-gray-700 rounded-lg overflow-hidden bg-black" style={{ width: '405px', height: '432px' }}>
                    <iframe
                      ref={editingIframeRef}
                      className="w-full h-full"
                      sandbox="allow-scripts"
                      title="Settings Preview"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Changes update automatically</p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => setEditingComponent(null)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applySettings}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
