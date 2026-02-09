import { AnimationComponent, ComponentParams } from '../types';

/**
 * Emphasis Component
 * Large centered text with glow/pulse effect for highlighting key points
 * Perfect for: important statements, key takeaways, impactful messages
 */
export const EmphasisComponent: AnimationComponent = {
  id: 'emphasis',
  name: 'Emphasis',
  description: 'Large centered text with glow and scale animation to emphasize key points',
  category: 'emphasis',
  
  paramsSchema: {
    text: {
      type: 'string',
      description: 'The key message text to emphasize (extract from segment)',
      required: true,
      default: 'Key Point'
    },
    color: {
      type: 'color',
      description: 'Text color',
      required: false,
      default: '#ffd700'
    },
    glowColor: {
      type: 'color',
      description: 'Glow effect color',
      required: false,
      default: '#ffd700'
    },
    size: {
      type: 'string',
      description: 'Font size (small, medium, large)',
      required: false,
      default: 'large',
      options: ['small', 'medium', 'large']
    }
  },
  
  render(params: ComponentParams, duration: number) {
    const {
      text,
      color = '#ffd700',
      glowColor = '#ffd700',
      size = 'large'
    } = params;
    
    const sizeMap = {
      small: '1.5em',
      medium: '1.8em',
      large: '2.2em'
    };
    
    const fontSize = sizeMap[size as keyof typeof sizeMap] || '2.2em';
    
    const html = `
      <div class="emphasis-wrapper">
        <div class="emphasis-content">
          <h1 class="emphasis-text">${text}</h1>
        </div>
      </div>
    `;
    
    const css = `
      .emphasis-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 5vh 8vw;
      }
      
      .emphasis-content {
        text-align: center;
      }
      
      .emphasis-text {
        font-size: ${fontSize};
        font-weight: 900;
        color: ${color};
        text-transform: uppercase;
        letter-spacing: 0.05em;
        line-height: 1.3;
        margin: 0;
        text-shadow: 0 0 20px ${glowColor}80, 
                     0 0 40px ${glowColor}40,
                     2px 2px 0 rgba(0,0,0,0.8);
      }
    `;
    
    const script = `
      var tl = gsap.timeline({ paused: true });
      
      /* Scale in with bounce */
      tl.from('.emphasis-text', {
        scale: 0,
        opacity: 0,
        duration: 0.6,
        ease: 'back.out(2)'
      }, 0);
      
      /* Pulse effect */
      tl.to('.emphasis-text', {
        scale: 1.1,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut'
      }, 0.6);
      
      /* Subtle continuous glow (if duration is long enough) */
      if (${duration} > 2) {
        tl.to('.emphasis-text', {
          textShadow: '0 0 30px ${glowColor}ff, 0 0 60px ${glowColor}80, 2px 2px 0 rgba(0,0,0,0.8)',
          duration: 0.5,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut'
        }, 1.5);
      }
      
      return tl;
    `;
    
    return { html, css, script };
  }
};
