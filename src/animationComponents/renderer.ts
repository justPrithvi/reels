import { ComponentRegistry } from './registry';
import { ComponentSelection } from './types';

interface Segment {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Renders final HTML from component selections
 * Takes LLM's JSON output and builds perfect HTML using pre-made components
 */
export const renderComponentBasedHTML = (
  selections: ComponentSelection[],
  segments: Segment[],
  componentSettings: { [componentId: string]: any } = {}
): string => {
  
  let allHTML = '';
  let allCSS = '';
  let allScripts = '';
  const sceneData: any[] = [];
  
  // Render each segment with its selected component
  selections.forEach((selection) => {
    let component = ComponentRegistry.get(selection.componentId);
    
    // Fallback to text_display if component not found
    if (!component) {
      console.warn(`⚠️ Component not found: ${selection.componentId}, using text_display fallback`);
      component = ComponentRegistry.get('text_display');
      
      if (!component) {
        console.error(`❌ Fatal: text_display fallback not found!`);
        return;
      }
    }
    
    const segment = segments.find(s => s.id === selection.segmentId);
    if (!segment) {
      console.error(`Segment not found: ${selection.segmentId}`);
      return;
    }
    
    const duration = segment.endTime - segment.startTime;
    
    // Merge custom settings with LLM params (custom settings for sizing/colors, LLM params for text content)
    const customSettings = componentSettings[component.id] || {};
    const mergedParams = { 
      ...customSettings, 
      ...selection.params,
      // If using fallback, ensure text is set
      ...(selection.componentId !== component.id ? { text: segment.text } : {})
    };
    
    const { html, css, script } = component.render(mergedParams, duration);
    
    // Build scene HTML
    allHTML += `
    <!-- ========================================
         SEGMENT ${segment.id}: ${segment.startTime.toFixed(1)}s - ${segment.endTime.toFixed(1)}s
         "${segment.text}"
         Component: ${component.name}
         ======================================== -->
    <div id="s${segment.id}" class="scene" data-start="${segment.startTime}" data-end="${segment.endTime}">
      ${html}
    </div>
    `;
    
    // Namespace CSS for this scene
    allCSS += `
    /* Segment ${segment.id} - ${component.name} */
    #s${segment.id} {
      ${css}
    }
    `;
    
    // Wrap script in animation function
    allScripts += `
    /* Animation for Segment ${segment.id} */
    function animateS${segment.id}() {
      ${script}
    }
    `;
    
    // Store scene metadata
    sceneData.push({
      id: `s${segment.id}`,
      start: segment.startTime,
      end: segment.endTime
    });
  });
  
  // Build final HTML document
  const finalHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component-Based Animation</title>
  
  <!-- GSAP Core + Plugins -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/DrawSVGPlugin.min.js"></script>
  <script>
    gsap.registerPlugin(MotionPathPlugin);
  </script>
  
  <!-- Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg-deep: #050505;
      --primary: #00f3ff;
      --success: #00ff9d;
      --warning: #ffd700;
      --danger: #ff0055;
      --white: #ffffff;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--bg-deep);
      color: var(--white);
      font-family: 'Oswald', sans-serif;
    }
    
    * {
      box-sizing: border-box;
    }
    
    #scene-container {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    
    .scene {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: none;
      opacity: 0;
    }
    
    .scene.active {
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 1;
    }
    
    .scene.active > * {
      transform: scale(0.7);
      transform-origin: center center;
    }
    
    ${allCSS}
  </style>
</head>
<body>
  <div id="scene-container">
    ${allHTML}
  </div>
  
  <script>
    console.log('🎬 Component-based animation system initialized');
    
    /* Scene configuration */
    const scenes = ${JSON.stringify(sceneData, null, 2)};
    console.log('📋 Scenes:', scenes);
    
    let currentScene = null;
    const sceneTimelines = {};
    
    ${allScripts}
    
    /* Initialize all timelines */
    try {
      ${selections.map(s => {
        const segment = segments.find(seg => seg.id === s.segmentId);
        return segment ? `sceneTimelines.s${segment.id} = animateS${segment.id}();` : '';
      }).join('\n      ')}
      console.log('✅ Timelines initialized:', Object.keys(sceneTimelines));
    } catch (err) {
      console.error('❌ Timeline initialization error:', err);
    }
    
    /* Show/hide scene based on time */
    function showScene(sceneId) {
      if (currentScene === sceneId) return;
      
      /* Hide all scenes */
      document.querySelectorAll('.scene').forEach(el => {
        el.style.display = 'none';
        el.style.opacity = '0';
        el.classList.remove('active');
      });
      
      /* Show target scene */
      const sceneEl = document.getElementById(sceneId);
      if (sceneEl) {
        sceneEl.style.display = 'block';
        sceneEl.style.opacity = '1';
        sceneEl.classList.add('active');
        currentScene = sceneId;
        console.log('👁️ Showing scene:', sceneId);
      } else {
        console.error('❌ Scene not found:', sceneId);
      }
    }
    
    /* Time update listener - sync with video */
    window.addEventListener('message', (e) => {
      if (e.data.type === 'timeupdate') {
        const time = e.data.time;
        
        /* Find active scene */
        for (const scene of scenes) {
          if (time >= scene.start && time < scene.end) {
            showScene(scene.id);
            
            /* Seek timeline to correct position */
            const timeline = sceneTimelines[scene.id];
            if (timeline) {
              const relativeTime = time - scene.start;
              timeline.seek(relativeTime);
            }
            break;
          }
        }
      }
    });
    
    /* Fallback: show first scene after 1 second */
    setTimeout(() => {
      if (!currentScene && scenes.length > 0) {
        showScene(scenes[0].id);
        console.log('⏰ Fallback: showing first scene');
      }
    }, 1000);
    
    console.log('✅ Scene manager ready');
  </script>
</body>
</html>`;
  
  return finalHTML;
};
