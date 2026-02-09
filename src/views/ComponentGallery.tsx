import React, { useState, useEffect, useRef } from 'react';
import { ComponentRegistry } from '@/src/animationComponents/registry';
import { AnimationComponent } from '@/src/animationComponents/types';
import '@/src/animationComponents/library/index'; // Load all components
import { X, Play } from 'lucide-react';

export const ComponentGallery: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [selectedComponent, setSelectedComponent] = useState<AnimationComponent | null>(null);
  const [params, setParams] = useState<any>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const allComponents = ComponentRegistry.getAll();
  
  // Auto-select first component
  useEffect(() => {
    if (allComponents.length > 0 && !selectedComponent) {
      selectComponent(allComponents[0]);
    }
  }, [allComponents]);
  
  const selectComponent = (component: AnimationComponent) => {
    setSelectedComponent(component);
    
    // Build default params
    const defaultParams: any = {};
    Object.entries(component.paramsSchema).forEach(([key, schema]) => {
      if (schema.default !== undefined) {
        defaultParams[key] = schema.default;
      } else if (schema.required) {
        // Provide sample values for required params
        if (schema.type === 'string') defaultParams[key] = schema.description;
        else if (schema.type === 'number') defaultParams[key] = 1;
        else if (schema.type === 'boolean') defaultParams[key] = true;
        else if (schema.type === 'array') defaultParams[key] = ['Item 1', 'Item 2', 'Item 3'];
        else if (schema.type === 'color') defaultParams[key] = '#00f3ff';
      }
    });
    setParams(defaultParams);
  };
  
  const renderPreview = () => {
    if (!selectedComponent) return;
    
    const { html, css, script } = selectedComponent.render(params, 5); // 5 second duration
    
    const previewHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>
        <script>
          window.addEventListener('load', () => {
            if (window.gsap && window.MotionPathPlugin) {
              gsap.registerPlugin(MotionPathPlugin);
            }
          });
        </script>
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
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
            display: flex;
            align-items: center;
            justify-content: center;
          }
          body > * {
            transform: scale(0.7);
            transform-origin: center center;
            font-size: 100%;
          }
          ${css}
        </style>
      </head>
      <body>
        ${html}
        <script>
          console.log('🎬 Component preview loading...');
          
          /* Wait for GSAP to load */
          function initAnimation() {
            if (typeof gsap === 'undefined') {
              console.log('⏳ Waiting for GSAP...');
              setTimeout(initAnimation, 100);
              return;
            }
            
            console.log('✅ GSAP loaded, starting animation');
            console.log('📦 Elements found:', {
              dataflow: document.querySelectorAll('.dataflow-box').length,
              emphasis: document.querySelectorAll('.emphasis-text').length,
              list: document.querySelectorAll('.list-item').length,
              comparison: document.querySelectorAll('.comparison-box').length,
              kinetic: document.querySelectorAll('.kinetic-word').length
            });
            
            try {
              /* Execute the animation script - this creates and returns a timeline */
              var tl = (function() {
                ${script}
              })();
              
              /* Play the timeline */
              if (tl && typeof tl.play === 'function') {
                console.log('✅ Timeline created, playing...');
                tl.play();
                console.log('▶️ Animation playing, duration:', tl.duration());
              } else {
                console.error('❌ No valid timeline returned:', tl);
                document.body.innerHTML += '<div style="color: red; padding: 20px; text-align: center; font-family: monospace;">Timeline Error: No valid timeline object</div>';
              }
            } catch (err) {
              console.error('❌ Animation error:', err);
              document.body.innerHTML += '<div style="color: red; padding: 20px; text-align: center; font-family: monospace;">Animation Error: ' + err.message + '</div>';
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
    
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      iframe.srcdoc = previewHTML;
    }
  };
  
  useEffect(() => {
    if (selectedComponent) {
      renderPreview();
    }
  }, [selectedComponent, params]);
  
  const updateParam = (key: string, value: any) => {
    setParams({ ...params, [key]: value });
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex">
      {/* Close Button - Top Right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
      >
        <X size={24} />
      </button>
      
      {/* Sidebar - Component List */}
      <div className="w-80 bg-gray-900 border-r border-gray-700 overflow-y-auto">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Component Gallery</h2>
          <p className="text-sm text-gray-400 mt-1">{allComponents.length} components</p>
        </div>
        
        <div className="p-4 space-y-2">
          {allComponents.map((component) => (
            <button
              key={component.id}
              onClick={() => selectComponent(component)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedComponent?.id === component.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="font-bold">{component.name}</div>
              <div className="text-sm opacity-75">{component.category}</div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Main Content */}
      {selectedComponent && (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <h1 className="text-2xl font-bold mb-2">{selectedComponent.name}</h1>
            <p className="text-gray-400">{selectedComponent.description}</p>
            <div className="mt-2">
              <span className="px-2 py-1 bg-blue-600 rounded text-xs font-bold">
                {selectedComponent.category}
              </span>
            </div>
          </div>
          
          <div className="flex-1 flex overflow-hidden">
            {/* Parameters Panel */}
            <div className="w-96 p-6 border-r border-gray-700 overflow-y-auto max-h-full">
              <h3 className="text-lg font-bold mb-4">Parameters</h3>
              
              {Object.entries(selectedComponent.paramsSchema).map(([key, schema]) => (
                <div key={key} className="mb-4">
                  <label className="block text-sm font-bold mb-1">
                    {key}
                    {schema.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <p className="text-xs text-gray-400 mb-2">{schema.description}</p>
                  
                  {schema.type === 'string' && !schema.options && (
                    <input
                      type="text"
                      value={params[key] || ''}
                      onChange={(e) => updateParam(key, e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                      placeholder={schema.default || ''}
                    />
                  )}
                  
                  {schema.type === 'string' && schema.options && (
                    <select
                      value={params[key] || schema.default}
                      onChange={(e) => updateParam(key, e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                    >
                      {schema.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  
                  {schema.type === 'number' && (
                    <input
                      type="number"
                      value={params[key] || 0}
                      onChange={(e) => updateParam(key, parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                    />
                  )}
                  
                  {schema.type === 'color' && (
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={params[key] || schema.default}
                        onChange={(e) => updateParam(key, e.target.value)}
                        className="w-16 h-10 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={params[key] || schema.default}
                        onChange={(e) => updateParam(key, e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white font-mono text-sm"
                      />
                    </div>
                  )}
                  
                  {schema.type === 'boolean' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={params[key] || false}
                        onChange={(e) => updateParam(key, e.target.checked)}
                        className="w-5 h-5"
                      />
                      <span className="text-sm">Enabled</span>
                    </label>
                  )}
                  
                  {schema.type === 'array' && (
                    <textarea
                      value={Array.isArray(params[key]) ? params[key].join('\n') : ''}
                      onChange={(e) => updateParam(key, e.target.value.split('\n').filter(Boolean))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white font-mono text-sm"
                      rows={4}
                      placeholder="One item per line"
                    />
                  )}
                </div>
              ))}
              
              <button
                onClick={renderPreview}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold flex items-center justify-center gap-2 mt-4"
              >
                <Play size={18} />
                Replay Animation
              </button>
            </div>
            
            {/* Preview */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
              <div className="relative bg-black border-2 border-gray-700 rounded-lg overflow-hidden"
                   style={{ width: '405px', height: '432px' }}>
                <iframe
                  ref={iframeRef}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                  title="Component Preview"
                />
                <div className="absolute bottom-2 right-2 text-xs bg-black/80 px-2 py-1 rounded pointer-events-none">
                  405×432px (60% mobile)
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-400">
                Animation plays automatically. Click "Replay" to restart.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
