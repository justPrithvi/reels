import { AnimationComponent } from '../types';

/**
 * Caching Solution - The fix? Caching
 */
const CachingSolution: AnimationComponent = {
  id: 'caching_solution',
  name: 'Caching Solution',
  description: 'Solution reveal - caching fixes the slow app problem',
  category: 'visual',
  paramsSchema: {},
  
  render(params, duration) {
    const html = `
      <div class="solution-container">
        <div class="question-text">The Fix?</div>
        
        <div class="solution-box">
          <div class="solution-icon">⚡</div>
          <div class="solution-text">Caching</div>
        </div>
        
        <div class="benefits">
          <div class="benefit">✓ Fast</div>
          <div class="benefit">✓ Cheap</div>
        </div>
      </div>
    `;
    
    const css = `
      .solution-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.64rem;
      }
      
      .question-text {
        font-size: 0.88rem;
        font-weight: 800;
        color: #ffd700;
        text-transform: uppercase;
        opacity: 0;
      }
      
      .solution-box {
        display: flex;
        align-items: center;
        gap: 0.72rem;
        padding: 0.96rem 1.6rem;
        background: linear-gradient(135deg, rgba(0, 255, 157, 0.2), rgba(0, 243, 255, 0.2));
        border: 3px solid #00ff9d;
        border-radius: 13px;
        box-shadow: 0 0 32px rgba(0, 255, 157, 0.6);
        opacity: 0;
      }
      
      .solution-icon {
        font-size: 2.4rem;
      }
      
      .solution-text {
        font-size: 1.44rem;
        font-weight: 900;
        color: #00ff9d;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        text-shadow: 0 0 20px rgba(0, 255, 157, 0.8);
      }
      
      .benefits {
        display: flex;
        gap: 0.64rem;
        opacity: 0;
      }
      
      .benefit {
        font-size: 0.72rem;
        font-weight: 800;
        color: #00ff9d;
        padding: 0.4rem 0.8rem;
        background: rgba(0, 255, 157, 0.1);
        border: 2px solid #00ff9d;
        border-radius: 8px;
        text-transform: uppercase;
      }
    `;
    
    const script = `
      const tl = gsap.timeline();
      
      tl.to('.question-text', {
        opacity: 1,
        y: -6,
        duration: 0.3,
        ease: 'power2.out'
      }, 0);
      
      tl.to('.solution-box', {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: 'back.out(2)'
      }, 0.4);
      
      tl.to('.solution-box', {
        boxShadow: '0 0 48px rgba(0, 255, 157, 0.9)',
        duration: 0.2,
        yoyo: true,
        repeat: 1
      }, 0.9);
      
      tl.to('.benefits', {
        opacity: 1,
        y: -8,
        duration: 0.4,
        ease: 'power2.out'
      }, 1.3);
      
      tl.from('.benefit', {
        scale: 0,
        rotation: -5,
        duration: 0.3,
        stagger: 0.1,
        ease: 'back.out(2)'
      }, 1.6);
      
      // Animation completes at 2.0s, holds final position
      
      return tl;
    `;
    
    return { html, css, script };
  }
};

export default CachingSolution;
