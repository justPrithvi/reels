import { AnimationComponent } from '../types';

/**
 * Stale Data Problem - Cached data gets stale
 */
const StaleDataProblem: AnimationComponent = {
  id: 'stale_data_problem',
  name: 'Stale Data Problem',
  description: 'Problem with caching - cached data gets stale showing old data',
  category: 'visual',
  paramsSchema: {},
  
  render(params, duration) {
    const html = `
      <div class="stale-container">
        <div class="warning-label">But There's a Problem</div>
        
        <div class="scenario">
          <div class="action-box">
            <div class="action-icon">✏️</div>
            <div class="action-text">User updates profile</div>
          </div>
          
          <div class="vs-arrow">→</div>
          
          <div class="cache-box">
            <div class="cache-icon">💾</div>
            <div class="cache-status">Still shows old data</div>
            <div class="stale-badge">⚠️ STALE</div>
          </div>
        </div>
        
        <div class="problem-text">Cached data gets stale</div>
      </div>
    `;
    
    const css = `
      .stale-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.64rem;
      }
      
      .warning-label {
        font-size: 0.96rem;
        font-weight: 900;
        color: #ff9900;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        text-shadow: 0 0 16px rgba(255, 153, 0, 0.8);
        opacity: 0;
      }
      
      .scenario {
        display: flex;
        align-items: center;
        gap: 0.64rem;
        opacity: 0;
      }
      
      .action-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.24rem;
        padding: 0.56rem 0.8rem;
        background: rgba(0, 243, 255, 0.1);
        border: 2px solid #00f3ff;
        border-radius: 8px;
      }
      
      .action-icon {
        font-size: 1.44rem;
      }
      
      .action-text {
        font-size: 0.6rem;
        font-weight: 800;
        color: #00f3ff;
        text-transform: uppercase;
        text-align: center;
        line-height: 1.2;
      }
      
      .vs-arrow {
        font-size: 1.44rem;
        color: #ffd700;
        font-weight: 900;
      }
      
      .cache-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.24rem;
        padding: 0.64rem 0.88rem;
        background: rgba(255, 153, 0, 0.15);
        border: 2px solid #ff9900;
        border-radius: 10px;
        box-shadow: 0 0 24px rgba(255, 153, 0, 0.5);
      }
      
      .cache-icon {
        font-size: 1.6rem;
      }
      
      .cache-status {
        font-size: 0.6rem;
        font-weight: 800;
        color: #ff9900;
        text-transform: uppercase;
        text-align: center;
        line-height: 1.2;
      }
      
      .stale-badge {
        font-size: 0.56rem;
        font-weight: 900;
        color: #ff9900;
        padding: 0.24rem 0.48rem;
        background: rgba(255, 153, 0, 0.2);
        border: 2px solid #ff9900;
        border-radius: 6px;
        text-transform: uppercase;
      }
      
      .problem-text {
        font-size: 0.8rem;
        font-weight: 800;
        color: #ff9900;
        text-transform: uppercase;
        font-style: italic;
        opacity: 0;
      }
    `;
    
    const script = `
      const tl = gsap.timeline();
      
      tl.to('.warning-label', {
        opacity: 1,
        y: -8,
        duration: 0.4,
        ease: 'power2.out'
      }, 0);
      
      tl.to('.scenario', {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out'
      }, 0.4);
      
      tl.from('.action-box', {
        x: -30,
        scale: 0,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 0.7);
      
      tl.from('.vs-arrow', {
        scale: 0,
        duration: 0.2,
        ease: 'back.out(3)'
      }, 1.0);
      
      tl.from('.cache-box', {
        x: 30,
        scale: 0,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 1.2);
      
      tl.to('.problem-text', {
        opacity: 1,
        y: -6,
        duration: 0.3,
        ease: 'power2.out'
      }, 1.7);
      
      // Animation completes at 2.0s, holds final position
      
      return tl;
    `;
    
    return { html, css, script };
  }
};

export default StaleDataProblem;
