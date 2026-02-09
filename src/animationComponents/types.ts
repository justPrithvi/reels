/**
 * Animation Component System
 * Components are pre-built, perfect animations that can be composed via LLM
 */

export interface ComponentParams {
  [key: string]: any;
}

export interface ParamSchema {
  type: 'string' | 'number' | 'color' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: any;
  options?: string[]; // For enum-like params
}

export interface AnimationComponent {
  // Metadata
  id: string;
  name: string;
  description: string;
  category: 'flow' | 'emphasis' | 'list' | 'comparison' | 'text' | 'diagram';
  
  // Schema for LLM to understand what params this component needs
  paramsSchema: {
    [key: string]: ParamSchema;
  };
  
  // Render function - returns HTML/CSS/JS for this component
  render(params: ComponentParams, duration: number): {
    html: string;      // HTML structure
    css: string;       // Component-specific styles
    script: string;    // GSAP animation code (returns timeline)
  };
}

export interface ComponentSelection {
  segmentId: number;
  componentId: string;
  params: ComponentParams;
}

export interface SegmentWithComponent {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  componentId: string;
  params: ComponentParams;
}
