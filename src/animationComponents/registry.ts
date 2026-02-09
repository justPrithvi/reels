import { AnimationComponent } from './types';

/**
 * Central registry for all animation components
 * Components register themselves here on import
 */
export class ComponentRegistry {
  private static components: Map<string, AnimationComponent> = new Map();
  
  static register(component: AnimationComponent) {
    this.components.set(component.id, component);
    console.log(`📦 Registered component: ${component.id}`);
  }
  
  static get(id: string): AnimationComponent | undefined {
    return this.components.get(id);
  }
  
  static getAll(): AnimationComponent[] {
    return Array.from(this.components.values());
  }
  
  static getAllByCategory(category: string): AnimationComponent[] {
    return this.getAll().filter(c => c.category === category);
  }
  
  /**
   * Get formatted component list for LLM prompt
   * Returns a description of all available components and their params
   */
  static getSchemaForLLM(): string {
    const components = this.getAll();
    
    return components.map(c => {
      const params = Object.entries(c.paramsSchema)
        .map(([key, schema]) => {
          const req = schema.required ? 'REQUIRED' : 'optional';
          const def = schema.default !== undefined ? ` (default: ${JSON.stringify(schema.default)})` : '';
          return `    - ${key} (${schema.type}, ${req})${def}: ${schema.description}`;
        })
        .join('\n');
      
      return `
**${c.id}** - ${c.name} [${c.category}]
  Description: ${c.description}
  Parameters:
${params}
`;
    }).join('\n');
  }
  
  /**
   * Get JSON schema for LLM structured output
   */
  static getJSONSchemaForLLM() {
    return {
      type: 'object',
      properties: {
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              segmentId: { type: 'number' },
              componentId: { 
                type: 'string',
                enum: this.getAll().map(c => c.id)
              },
              params: { type: 'object' }
            },
            required: ['segmentId', 'componentId', 'params']
          }
        }
      },
      required: ['segments']
    };
  }
}
