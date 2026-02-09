import { AnimationComponent } from '../types';
import { ComponentRegistry } from '../registry';

/**
 * Simple text display fallback component
 * Used when no specific component fits
 */
const TextDisplay: AnimationComponent = {
  id: 'text_display',
  name: 'Text Display',
  description: 'Simple centered text display (fallback)',
  category: 'text',
  paramsSchema: {
    text: {
      type: 'string',
      description: 'Text to display',
      required: true,
      default: 'Sample Text'
    },
    fontSize: {
      type: 'string',
      description: 'Font size',
      required: false,
      default: '2rem'
    },
    color: {
      type: 'string',
      description: 'Text color',
      required: false,
      default: '#ffffff'
    },
    bgColor: {
      type: 'string',
      description: 'Background color',
      required: false,
      default: '#333333'
    }
  },
  
  render(params, duration) {
    const text = params.text || 'Sample Text';
    const fontSize = params.fontSize || '2rem';
    const color = params.color || '#ffffff';
    const bgColor = params.bgColor || '#333333';
    
    const html = `
      <div class="text-display-container">
        <div class="text-display-content">
          <p class="text-display-text">${text}</p>
        </div>
      </div>
    `;
    
    const css = `
      .text-display-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${bgColor};
        padding: 20px;
        box-sizing: border-box;
      }
      
      .text-display-content {
        max-width: 90%;
        text-align: center;
      }
      
      .text-display-text {
        font-size: ${fontSize};
        color: ${color};
        font-weight: 600;
        line-height: 1.4;
        margin: 0;
        padding: 15px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        opacity: 1;
      }
    `;
    
    const script = `
      var tl = gsap.timeline();
      
      tl.from('.text-display-text', {
        scale: 0.5,
        opacity: 0,
        duration: 0.4,
        ease: 'back.out(1.7)'
      });
      
      tl.to('.text-display-text', {
        scale: 1.05,
        duration: ${duration - 0.8},
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 1
      }, '+=0.2');
      
      return tl;
    `;
    
    return { html, css, script };
  }
};

ComponentRegistry.register(TextDisplay);
export default TextDisplay;
