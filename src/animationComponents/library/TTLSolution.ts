import { AnimationComponent } from '../types';

/**
 * TTL Solution - Set time to live for cache expiration
 */
const TTLSolution: AnimationComponent = {
  id: 'ttl_solution',
  name: 'TTL Solution',
  description: 'TTL solution - set time to live so cache expires and gets fresh data',
  category: 'visual',
  paramsSchema: {},
  
  render(params, duration) {
    const html = `
      <div class="ttl-container">
        <div class="solution-title">Set a TTL</div>
        <div class="subtitle">(Time To Live)</div>
        
        <div class="ttl-options">
          <div class="ttl-option opt-1">
            <div class="opt-time">30 sec</div>
          </div>
          <div class="ttl-option opt-2">
            <div class="opt-time">5 min</div>
          </div>
          <div class="ttl-option opt-3">
            <div class="opt-time">1 hour</div>
          </div>
        </div>
        
        <div class="expiry-flow">
          <div class="flow-icon">⏱️</div>
          <div class="flow-text">After TTL → Cache Expires</div>
        </div>
        
        <div class="result-badge">
          <span class="badge-icon">✓</span>
          <span class="badge-text">Fresh Data</span>
        </div>
      </div>
    `;
    
    const css = `
      .ttl-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.48rem;
      }
      
      .solution-title {
        font-size: 1.12rem;
        font-weight: 900;
        color: #00ff9d;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        text-shadow: 0 0 20px rgba(0, 255, 157, 0.8);
        opacity: 0;
      }
      
      .subtitle {
        font-size: 0.64rem;
        font-weight: 700;
        color: #999;
        font-style: italic;
        opacity: 0;
      }
      
      .ttl-options {
        display: flex;
        gap: 0.48rem;
        margin-top: 0.32rem;
        opacity: 0;
      }
      
      .ttl-option {
        padding: 0.48rem 0.72rem;
        background: rgba(0, 243, 255, 0.1);
        border: 2px solid #00f3ff;
        border-radius: 8px;
        box-shadow: 0 0 16px rgba(0, 243, 255, 0.3);
      }
      
      .opt-time {
        font-size: 0.72rem;
        font-weight: 900;
        color: #00f3ff;
        font-family: 'JetBrains Mono', monospace;
        text-transform: uppercase;
      }
      
      .expiry-flow {
        display: flex;
        align-items: center;
        gap: 0.48rem;
        padding: 0.48rem 0.88rem;
        background: rgba(255, 215, 0, 0.1);
        border: 2px solid #ffd700;
        border-radius: 8px;
        margin-top: 0.32rem;
        opacity: 0;
      }
      
      .flow-icon {
        font-size: 1.28rem;
      }
      
      .flow-text {
        font-size: 0.64rem;
        font-weight: 800;
        color: #ffd700;
        text-transform: uppercase;
      }
      
      .result-badge {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.48rem 0.88rem;
        background: rgba(0, 255, 157, 0.15);
        border: 2px solid #00ff9d;
        border-radius: 8px;
        box-shadow: 0 0 20px rgba(0, 255, 157, 0.4);
        opacity: 0;
      }
      
      .badge-icon {
        font-size: 1.04rem;
        color: #00ff9d;
        font-weight: 900;
      }
      
      .badge-text {
        font-size: 0.72rem;
        font-weight: 900;
        color: #00ff9d;
        text-transform: uppercase;
      }
    `;
    
    const script = `
      const tl = gsap.timeline();
      
      tl.to('.solution-title', {
        opacity: 1,
        y: -8,
        duration: 0.4,
        ease: 'power2.out'
      }, 0);
      
      tl.to('.subtitle', {
        opacity: 1,
        y: -4,
        duration: 0.3,
        ease: 'power2.out'
      }, 0.4);
      
      tl.to('.ttl-options', {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out'
      }, 0.7);
      
      tl.from(['.opt-1', '.opt-2', '.opt-3'], {
        scale: 0,
        rotation: -5,
        duration: 0.3,
        stagger: 0.1,
        ease: 'back.out(2)'
      }, 1.0);
      
      tl.to('.expiry-flow', {
        opacity: 1,
        y: -6,
        duration: 0.4,
        ease: 'power2.out'
      }, 1.6);
      
      tl.to('.result-badge', {
        opacity: 1,
        scale: 1,
        y: -6,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 2.1);
      
      // Animation completes at 2.5s, holds final position
      
      return tl;
    `;
    
    return { html, css, script };
  }
};

export default TTLSolution;
