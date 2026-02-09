/**
 * API Client for backend communication
 */

const API_BASE = '/api';

export interface Project {
  id: number;
  name: string;
  video_filename: string;
  video_path: string;
  video_duration: number;
  created_at: string;
  updated_at: string;
  has_subtitles?: boolean;
  has_content?: boolean;
}

export interface ProjectDetails {
  project: Project;
  srtData?: {
    text: string;
    json: any[];
    method: string;
  };
  generatedContent?: {
    html: string;
    layoutConfig: any[];
    topicContext: string;
  };
}

/**
 * Get all projects
 */
export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`);
  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }
  const data = await response.json();
  return data.projects;
}

/**
 * Get project details by ID
 */
export async function fetchProjectById(id: number): Promise<ProjectDetails> {
  const response = await fetch(`${API_BASE}/projects/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch project');
  }
  return await response.json();
}

/**
 * Create new project with optional video file
 */
export async function createProject(
  name: string,
  videoFile?: File,
  duration?: number
): Promise<Project> {
  const formData = new FormData();
  formData.append('name', name);
  
  if (videoFile) {
    formData.append('video', videoFile);
    formData.append('duration', (duration || 0).toString());
  }

  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to create project');
  }

  const data = await response.json();
  return data.project;
}

/**
 * Delete project
 */
export async function deleteProject(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete project');
  }
}

/**
 * Save SRT data for project
 */
export async function saveSRTData(
  projectId: number,
  srtText: string,
  srtJson: any[],
  method: string = 'gemini'
): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/srt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ srtText, srtJson, method }),
  });

  if (!response.ok) {
    throw new Error('Failed to save SRT data');
  }
}

/**
 * Save generated content for project
 */
export async function saveGeneratedContent(
  projectId: number,
  htmlContent: string,
  layoutConfig: any[],
  topicContext: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ htmlContent, layoutConfig, topicContext }),
  });

  if (!response.ok) {
    throw new Error('Failed to save generated content');
  }
}

/**
 * Replace video for an existing project
 */
export async function replaceProjectVideo(
  projectId: number,
  videoFile: File,
  duration: number
): Promise<Project> {
  const formData = new FormData();
  formData.append('video', videoFile);
  formData.append('duration', duration.toString());

  const response = await fetch(`${API_BASE}/projects/${projectId}/video`, {
    method: 'PUT',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to replace video');
  }

  const data = await response.json();
  return data.project;
}

/**
 * Delete video from a project
 */
export async function deleteProjectVideo(projectId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/video`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete video');
  }
}

/**
 * Save animation segments for project
 */
export async function saveAnimationSegments(
  projectId: number,
  segments: any[]
): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/segments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments }),
  });

  if (!response.ok) {
    throw new Error('Failed to save animation segments');
  }
}

/**
 * Get animation segments for project
 */
export async function getAnimationSegments(
  projectId: number
): Promise<any[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/segments`);
  
  if (!response.ok) {
    throw new Error('Failed to get animation segments');
  }

  const data = await response.json();
  return data.segments;
}

/**
 * Update a specific animation segment
 */
export async function updateAnimationSegment(
  projectId: number,
  segmentId: number,
  updates: { generatedHtml?: string; promptUsed?: string; animationType?: string }
): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/segments/${segmentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update animation segment');
  }
}

/**
 * Delete all animation segments for a project
 */
export async function deleteAnimationSegments(projectId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/segments`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete animation segments');
  }
}
