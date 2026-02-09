import { AnimationComponent } from '../types';

/**
 * Cache Hit - Next 1000 requests instant from cache
 */
const CacheHit: AnimationComponent = {
  id: 'cache_hit',
  name: 'Cache Hit',
  description: 'Cache hit - next 1000 requests instant from cache lightning fast',
  category: 'visual',
  paramsSchema: {},
  
  render(params, duration) {
    const html = `
      <div class="hit-container">
        <div class="requests-info">
          <span class="req-label">Next Requests:</span>
          <span class="req-count">1,000+</span>
        </div>
        
        <div class="cache-visual">
          <div class="cache-icon-big">💾</div>
          <div class="cache-label">Cache</div>
          <div class="hit-badge">⚡ CACHE HIT</div>
        </div>
        
        <div class="speed-indicator">
          <div class="speed-text">Instant</div>
          <div class="speed-time">~1ms</div>
        </div>
      </div>
    `;
    
    const css = `
      .hit-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.64rem;
      }
      
      .requests-info {
        display: flex;
        align-items: center;
        gap: 0.48rem;
        padding: 0.48rem 0.88rem;
        background: rgba(255, 215, 0, 0.1);
        border: 2px solid #ffd700;
        border-radius: 8px;
        opacity: 0;
      }
      
      .req-label {
        font-size: 0.64rem;
        font-weight: 700;
        color: #ffd700;
        text-transform: uppercase;
      }
      
      .req-count {
        font-size: 0.88rem;
        font-weight: 900;
        color: #fff;
        font-family: 'JetBrains Mono', monospace;
      }
      
      .cache-visual {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.32rem;
        padding: 0.96rem 1.44rem;
        background: rgba(0, 255, 157, 0.15);
        border: 3px solid #00ff9d;
        border-radius: 13px;
        box-shadow: 0 0 32px rgba(0, 255, 157, 0.6);
        opacity: 0;
      }
      
      .cache-icon-big {
        font-size: 3.2rem;
      }
      
      .cache-label {
        font-size: 0.96rem;
        font-weight: 900;
        color: #00ff9d;
        text-transform: uppercase;
      }
      
      .hit-badge {
        font-size: 0.72rem;
        font-weight: 900;
        color: #ffd700;
        padding: 0.32rem 0.72rem;
        background: rgba(255, 215, 0, 0.2);
        border: 2px solid #ffd700;
        border-radius: 6px;
        text-transform: uppercase;
        animation: pulse-glow 1.5s ease-in-out infinite;
      }
      
      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 0 12px rgba(255, 215, 0, 0.4); }
        50% { box-shadow: 0 0 24px rgba(255, 215, 0, 0.8); }
      }
      
      .speed-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.16rem;
        opacity: 0;
      }
      
      .speed-text {
        font-size: 1.04rem;
        font-weight: 900;
        color: #00ff9d;
        text-transform: uppercase;
        text-shadow: 0 0 16px rgba(0, 255, 157, 0.8);
      }
      
      .speed-time {
        font-size: 0.64rem;
        font-weight: 700;
        color: #999;
        font-family: 'JetBrains Mono', monospace;
      }
    `;
    
    const script = `
      const tl = gsap.timeline();
      
      tl.to('.requests-info', {
        opacity: 1,
        y: -6,
        duration: 0.4,
        ease: 'power2.out'
      }, 0);
      
      tl.to('.cache-visual', {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: 'back.out(2)'
      }, 0.4);
      
      tl.to('.cache-visual', {
        boxShadow: '0 0 48px rgba(0, 255, 157, 0.9)',
        duration: 0.2,
        yoyo: true,
        repeat: 1
      }, 0.9);
      
      tl.to('.speed-indicator', {
        opacity: 1,
        y: -8,
        duration: 0.4,
        ease: 'power2.out'
      }, 1.3);
      
      // Animation completes at 1.7s, holds final position
      
      return tl;
    `;
    
    return { html, css, script };
  }
};

export default CacheHit;
