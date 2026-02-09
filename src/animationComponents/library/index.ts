/**
 * Component Library Index
 * Generic Animation Components
 */

import { ComponentRegistry } from '../registry';
import TextDisplay from './TextDisplay';
import { EmphasisComponent } from './Emphasis';
import SlowAppHook from './SlowAppHook';
import ExpensiveAndSlow from './ExpensiveAndSlow';
import CachingSolution from './CachingSolution';
import StoreInMemory from './StoreInMemory';
import FirstRequestFlow from './FirstRequestFlow';
import CacheHit from './CacheHit';
import StaleDataProblem from './StaleDataProblem';
import TTLSolution from './TTLSolution';
import CacheIntelligently from './CacheIntelligently';


// Register all components
// Universal utilities (ALWAYS AVAILABLE)
ComponentRegistry.register(TextDisplay);
ComponentRegistry.register(EmphasisComponent);

// Caching - Story Flow Components
ComponentRegistry.register(SlowAppHook);              // Hook: App is slow, every page load hits database
ComponentRegistry.register(ExpensiveAndSlow);         // Problem: Expensive, slow, users leaving
ComponentRegistry.register(CachingSolution);          // Solution: Caching fixes this

// Caching - Technical Components
ComponentRegistry.register(StoreInMemory);            // Store data in memory (Redis/Memcached)
ComponentRegistry.register(FirstRequestFlow);         // First request: DB → Cache
ComponentRegistry.register(CacheHit);                 // Next 1000 requests: instant from cache
ComponentRegistry.register(StaleDataProblem);         // Problem: Cached data gets stale
ComponentRegistry.register(TTLSolution);              // Solution: Set TTL (time to live)
ComponentRegistry.register(CacheIntelligently);       // Final advice: Cache intelligently

// Note: EndScreen is a React component in /src/components/EndScreen.tsx
// It's automatically shown during closing lines, not part of the component library



console.log(`🚀 Loaded ${ComponentRegistry.getAll().length} animation components`);

// Export for convenience
export {
  TextDisplay,
  EmphasisComponent,
  SlowAppHook,
  ExpensiveAndSlow,
  CachingSolution,
  StoreInMemory,
  FirstRequestFlow,
  CacheHit,
  StaleDataProblem,
  TTLSolution,
  CacheIntelligently,
};
