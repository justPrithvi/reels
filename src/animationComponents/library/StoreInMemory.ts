import { AnimationComponent } from '../types';

/**
 * Store In Memory - Store frequent data in memory (Redis/Memcached)
 */
const StoreInMemory: AnimationComponent = {
  id: 'store_in_memory',
  name: 'Store In Memory',
  description: 'Store frequent data in memory using Redis or Memcached',
  category: 'visual',
  paramsSchema: {},
  
  render(params, duration) {
    const html = `
      <div class="memory-container">
        <div class="instruction">Store in Memory</div>
        
        <div class="cache-boxes">
          <div class="cache-box redis">
            <div class="cache-icon">🔴</div>
            <div class="cache-name">Redis</div>
          </div>
          
          <div class="or-divider">OR</div>
          
          <div class="cache-box memcached">
            <div class="cache-icon">💾</div>
            <div class="cache-name">Memcached</div>
          </div>
        </div>
        
        <div class="note-text">Whatever works</div>
      </div>
    `;
    
    const css = `
      .memory-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.64rem;
      }
      
      .instruction {
        font-size: 0.96rem;
        font-weight: 900;
        color: #ffd700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        opacity: 0;
      }
      
      .cache-boxes {
        display: flex;
        align-items: center;
        gap: 0.64rem;
        opacity: 0;
      }
      
      .cache-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.32rem;
        padding: 0.72rem 0.96rem;
        background: rgba(0, 243, 255, 0.1);
        border: 2px solid #00f3ff;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(0, 243, 255, 0.4);
      }
      
      .cache-icon {
        font-size: 2rem;
      }
      
      .cache-name {
        font-size: 0.72rem;
        font-weight: 800;
        color: #00f3ff;
        text-transform: uppercase;
      }
      
      .or-divider {
        font-size: 0.72rem;
        font-weight: 800;
        color: #999;
        padding: 0.32rem 0.48rem;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 6px;
      }
      
      .note-text {
        font-size: 0.64rem;
        font-weight: 700;
        color: #999;
        font-style: italic;
        opacity: 0;
      }
    `;
    
    const script = `
      const tl = gsap.timeline();
      
      tl.to('.instruction', {
        opacity: 1,
        y: -8,
        duration: 0.4,
        ease: 'power2.out'
      }, 0);
      
      tl.to('.cache-boxes', {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out'
      }, 0.4);
      
      tl.from('.redis', {
        x: -30,
        scale: 0,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 0.7);
      
      tl.from('.or-divider', {
        scale: 0,
        duration: 0.2,
        ease: 'back.out(3)'
      }, 1.0);
      
      tl.from('.memcached', {
        x: 30,
        scale: 0,
        duration: 0.4,
        ease: 'back.out(2)'
      }, 1.2);
      
      tl.to('.note-text', {
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

export default StoreInMemory;
