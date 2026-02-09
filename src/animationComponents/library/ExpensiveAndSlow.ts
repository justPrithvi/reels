import { AnimationComponent } from '../types';

/**
 * Expensive And Slow - That's expensive, that's slow, users leaving
 */
const ExpensiveAndSlow: AnimationComponent = {
  id: 'expensive_and_slow',
  name: 'Expensive And Slow',
  description: 'Problem emphasis - expensive slow users are leaving',
  category: 'visual',
  paramsSchema: {},
  
  render(params, duration) {
    const html = `
      <div class="problem-container">
        <div class="problem-items">
          <div class="problem-item item-1">
            <div class="item-icon">💸</div>
            <div class="item-text">Expensive</div>
          </div>
          
          <div class="problem-item item-2">
            <div class="item-icon">🐌</div>
            <div class="item-text">Slow</div>
          </div>
          
          <div class="problem-item item-3">
            <div class="item-icon">👋</div>
            <div class="item-text">Users Leaving</div>
          </div>
        </div>
      </div>
    `;
    
    const css = `
      .problem-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      
      .problem-items {
        display: flex;
        flex-direction: column;
        gap: 0.64rem;
      }
      
      .problem-item {
        display: flex;
        align-items: center;
        gap: 0.64rem;
        padding: 0.64rem 1.12rem;
        background: rgba(255, 0, 85, 0.1);
        border: 2px solid #ff0055;
        border-radius: 10px;
        box-shadow: 0 0 24px rgba(255, 0, 85, 0.4);
        opacity: 0;
      }
      
      .item-icon {
        font-size: 1.92rem;
      }
      
      .item-text {
        font-size: 0.96rem;
        font-weight: 900;
        color: #ff0055;
        text-transform: uppercase;
        letter-spacing: 0.6px;
      }
    `;
    
    const script = `
      const tl = gsap.timeline();
      
      tl.to('.item-1', {
        opacity: 1,
        x: 8,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 0);
      
      tl.to('.item-2', {
        opacity: 1,
        x: 8,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 0.5);
      
      tl.to('.item-3', {
        opacity: 1,
        x: 8,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 1.0);
      
      // Quick emphasis pulse
      tl.to(['.item-1', '.item-2', '.item-3'], {
        scale: 1.05,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        stagger: 0.1
      }, 1.5);
      
      // Animation completes at 2.0s, holds final position
      
      return tl;
    `;
    
    return { html, css, script };
  }
};

export default ExpensiveAndSlow;
