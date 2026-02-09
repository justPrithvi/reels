import { AnimationComponent } from '../types';

/**
 * Cache Intelligently - Final advice and call to action
 */
const CacheIntelligently: AnimationComponent = {
  id: 'cache_intelligently',
  name: 'Cache Intelligently',
  description: 'Final message - cache intelligently your users will thank you',
  category: 'visual',
  paramsSchema: {},
  
  render(params, duration) {
    const html = `
      <div class="advice-container">
        <div class="main-message">
          <div class="message-icon">🧠</div>
          <div class="message-text">Cache Intelligently</div>
        </div>
        
        <div class="benefits-grid">
          <div class="benefit-item">
            <div class="benefit-icon">⚡</div>
            <div class="benefit-label">Faster</div>
          </div>
          <div class="benefit-item">
            <div class="benefit-icon">💰</div>
            <div class="benefit-label">Cheaper</div>
          </div>
          <div class="benefit-item">
            <div class="benefit-icon">😊</div>
            <div class="benefit-label">Happy Users</div>
          </div>
        </div>
        
        <div class="thank-you">Your users will thank you</div>
      </div>
    `;
    
    const css = `
      .advice-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.72rem;
      }
      
      .main-message {
        display: flex;
        align-items: center;
        gap: 0.64rem;
        padding: 0.88rem 1.36rem;
        background: linear-gradient(135deg, rgba(0, 255, 157, 0.2), rgba(0, 243, 255, 0.2));
        border: 3px solid #00ff9d;
        border-radius: 13px;
        box-shadow: 0 0 32px rgba(0, 255, 157, 0.6);
        opacity: 0;
      }
      
      .message-icon {
        font-size: 2.4rem;
      }
      
      .message-text {
        font-size: 1.2rem;
        font-weight: 900;
        color: #00ff9d;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        text-shadow: 0 0 20px rgba(0, 255, 157, 0.8);
      }
      
      .benefits-grid {
        display: flex;
        gap: 0.56rem;
        opacity: 0;
      }
      
      .benefit-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.24rem;
        padding: 0.56rem 0.72rem;
        background: rgba(0, 243, 255, 0.1);
        border: 2px solid #00f3ff;
        border-radius: 8px;
        box-shadow: 0 0 16px rgba(0, 243, 255, 0.3);
        min-width: 72px;
      }
      
      .benefit-icon {
        font-size: 1.44rem;
      }
      
      .benefit-label {
        font-size: 0.6rem;
        font-weight: 800;
        color: #fff;
        text-transform: uppercase;
      }
      
      .thank-you {
        font-size: 0.8rem;
        font-weight: 800;
        color: #ffd700;
        text-transform: uppercase;
        font-style: italic;
        opacity: 0;
      }
    `;
    
    const script = `
      const tl = gsap.timeline();
      
      tl.to('.main-message', {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: 'back.out(2)'
      }, 0);
      
      tl.to('.main-message', {
        boxShadow: '0 0 48px rgba(0, 255, 157, 0.9)',
        duration: 0.2,
        yoyo: true,
        repeat: 1
      }, 0.5);
      
      tl.to('.benefits-grid', {
        opacity: 1,
        y: -8,
        duration: 0.4,
        ease: 'power2.out'
      }, 0.9);
      
      tl.from('.benefit-item', {
        scale: 0,
        rotation: -10,
        duration: 0.4,
        stagger: 0.12,
        ease: 'back.out(2)'
      }, 1.3);
      
      tl.to('.thank-you', {
        opacity: 1,
        y: -6,
        duration: 0.4,
        ease: 'power2.out'
      }, 2.0);
      
      // Animation completes at 2.4s, holds final position
      
      return tl;
    `;
    
    return { html, css, script };
  }
};

export default CacheIntelligently;
