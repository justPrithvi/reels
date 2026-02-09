import { AnimationComponent } from '../types';

/**
 * Slow App Hook - Your app is slow, every page load hits database
 */
const SlowAppHook: AnimationComponent = {
  id: 'slow_app_hook',
  name: 'Slow App Hook',
  description: 'Opening hook - your app is slow every page load hits the database',
  category: 'visual',
  paramsSchema: {},
  
  render(params, duration) {
    const html = `
      <div class="hook-container">
        <div class="app-box">
          <div class="app-icon">📱</div>
          <div class="app-status">Your App</div>
          <div class="slow-badge">🐌 SLOW</div>
        </div>
        
        <div class="flow-arrows">
          <div class="flow-arrow a1">↓</div>
          <div class="flow-arrow a2">↓</div>
          <div class="flow-arrow a3">↓</div>
        </div>
        
        <div class="db-box">
          <div class="db-icon">🗄️</div>
          <div class="db-label">Database</div>
          <div class="query-counter">Query #<span class="count">287</span></div>
        </div>
        
        <div class="message">Every. Single. Time.</div>
      </div>
    `;
    
    const css = `
      .hook-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.48rem;
      }
      
      .app-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.24rem;
        padding: 0.64rem 1.04rem;
        background: rgba(255, 0, 85, 0.1);
        border: 2px solid #ff0055;
        border-radius: 10px;
        box-shadow: 0 0 24px rgba(255, 0, 85, 0.4);
        opacity: 0;
      }
      
      .app-icon {
        font-size: 2rem;
      }
      
      .app-status {
        font-size: 0.72rem;
        font-weight: 800;
        color: #fff;
        text-transform: uppercase;
      }
      
      .slow-badge {
        font-size: 0.64rem;
        font-weight: 900;
        color: #ff0055;
        padding: 0.24rem 0.56rem;
        background: rgba(255, 0, 85, 0.2);
        border-radius: 6px;
        text-transform: uppercase;
      }
      
      .flow-arrows {
        display: flex;
        flex-direction: column;
        gap: 0.16rem;
        opacity: 0;
      }
      
      .flow-arrow {
        font-size: 1.6rem;
        color: #ffd700;
        text-shadow: 0 0 12px rgba(255, 215, 0, 0.8);
        opacity: 0;
      }
      
      .db-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.24rem;
        padding: 0.64rem 1.04rem;
        background: rgba(0, 243, 255, 0.1);
        border: 2px solid #00f3ff;
        border-radius: 10px;
        box-shadow: 0 0 24px rgba(0, 243, 255, 0.4);
        opacity: 0;
      }
      
      .db-icon {
        font-size: 2rem;
      }
      
      .db-label {
        font-size: 0.72rem;
        font-weight: 800;
        color: #00f3ff;
        text-transform: uppercase;
      }
      
      .query-counter {
        font-size: 0.6rem;
        font-weight: 700;
        color: #999;
        font-family: 'JetBrains Mono', monospace;
      }
      
      .count {
        color: #ff0055;
        font-weight: 900;
        font-size: 0.72rem;
      }
      
      .message {
        font-size: 0.96rem;
        font-weight: 900;
        color: #ff0055;
        text-transform: uppercase;
        letter-spacing: 1px;
        text-shadow: 0 0 16px rgba(255, 0, 85, 0.8);
        opacity: 0;
      }
    `;
    
    const script = `
      const tl = gsap.timeline();
      
      tl.to('.app-box', {
        opacity: 1,
        y: -8,
        duration: 0.4,
        ease: 'power2.out'
      }, 0);
      
      tl.to('.flow-arrows', {
        opacity: 1,
        duration: 0.2
      }, 0.4);
      
      tl.to(['.a1', '.a2', '.a3'], {
        opacity: 1,
        y: 6,
        duration: 0.2,
        stagger: 0.1,
        ease: 'power2.out'
      }, 0.6);
      
      tl.to('.db-box', {
        opacity: 1,
        y: -6,
        duration: 0.4,
        ease: 'power2.out'
      }, 1.0);
      
      // Counter rapidly increments
      tl.to('.count', {
        textContent: '1000',
        duration: 0.6,
        snap: { textContent: 1 },
        ease: 'power2.inOut'
      }, 1.4);
      
      // DB box pulses (stressed)
      tl.to('.db-box', {
        borderColor: '#ff0055',
        boxShadow: '0 0 32px rgba(255, 0, 85, 0.6)',
        duration: 0.2,
        yoyo: true,
        repeat: 1
      }, 2.0);
      
      tl.to('.message', {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 2.4);
      
      // Animation completes at 2.8s, holds final position
      
      return tl;
    `;
    
    return { html, css, script };
  }
};

export default SlowAppHook;
