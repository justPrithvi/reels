import { AnimationComponent } from '../types';

/**
 * First Request Flow - First request hits DB, save to cache
 */
const FirstRequestFlow: AnimationComponent = {
  id: 'first_request_flow',
  name: 'First Request Flow',
  description: 'First request flow - hits database then saves result to cache',
  category: 'visual',
  paramsSchema: {},
  
  render(params, duration) {
    const html = `
      <div class="flow-container">
        <div class="flow-title">First Request</div>
        
        <div class="flow-diagram">
          <div class="flow-step step-1">
            <div class="step-icon">📥</div>
            <div class="step-label">Request</div>
          </div>
          
          <div class="flow-arrow arr-1">↓</div>
          
          <div class="flow-step step-2">
            <div class="step-icon">🗄️</div>
            <div class="step-label">Database</div>
          </div>
          
          <div class="flow-arrow arr-2">↓</div>
          
          <div class="flow-step step-3">
            <div class="step-icon">💾</div>
            <div class="step-label">Save to Cache</div>
          </div>
        </div>
      </div>
    `;
    
    const css = `
      .flow-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.56rem;
      }
      
      .flow-title {
        font-size: 0.88rem;
        font-weight: 900;
        color: #ffd700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        opacity: 0;
      }
      
      .flow-diagram {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
      }
      
      .flow-step {
        display: flex;
        align-items: center;
        gap: 0.48rem;
        padding: 0.56rem 0.96rem;
        background: rgba(0, 0, 0, 0.5);
        border: 2px solid #00f3ff;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(0, 243, 255, 0.3);
        opacity: 0;
      }
      
      .step-icon {
        font-size: 1.44rem;
      }
      
      .step-label {
        font-size: 0.72rem;
        font-weight: 800;
        color: #fff;
        text-transform: uppercase;
      }
      
      .flow-arrow {
        font-size: 1.44rem;
        color: #ffd700;
        font-weight: 900;
        opacity: 0;
      }
      
      .step-3 {
        border-color: #00ff9d;
        box-shadow: 0 0 20px rgba(0, 255, 157, 0.4);
      }
    `;
    
    const script = `
      const tl = gsap.timeline();
      
      tl.to('.flow-title', {
        opacity: 1,
        y: -6,
        duration: 0.3,
        ease: 'power2.out'
      }, 0);
      
      tl.to('.step-1', {
        opacity: 1,
        x: 6,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 0.3);
      
      tl.to('.arr-1', {
        opacity: 1,
        y: 4,
        duration: 0.2
      }, 0.7);
      
      tl.to('.step-2', {
        opacity: 1,
        x: 6,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 0.9);
      
      tl.to('.arr-2', {
        opacity: 1,
        y: 4,
        duration: 0.2
      }, 1.3);
      
      tl.to('.step-3', {
        opacity: 1,
        x: 6,
        scale: 1,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 1.5);
      
      // Animation completes at 1.9s, holds final position
      
      return tl;
    `;
    
    return { html, css, script };
  }
};

export default FirstRequestFlow;
