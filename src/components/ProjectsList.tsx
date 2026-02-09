import React, { useState, useEffect } from 'react';
import { Plus, Video, Trash2, Clock, CheckCircle, Package } from 'lucide-react';
import { ComponentGallery } from '@/src/views/ComponentGallery';
import {
  fetchProjects,
  createProject,
  deleteProject,
  Project,
} from '@/src/services/apiClient';

interface ProjectsListProps {
  spaceName: string;
  onSelectProject: (projectId: number) => void;
  onCreateComplete?: () => void;
  onExitWorkspace: () => void;
}

export const ProjectsList: React.FC<ProjectsListProps> = ({
  spaceName,
  onSelectProject,
  onCreateComplete,
  onExitWorkspace,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showGallery, setShowGallery] = useState(false);

  // Load projects
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await fetchProjects();
      setProjects(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    try {
      setCreating(true);

      // Create project without video
      const project = await createProject(newProjectName.trim());

      // Close modal and reset
      setShowCreateModal(false);
      setNewProjectName('');

      // Reload projects list
      await loadProjects();

      // Notify parent and open project
      if (onCreateComplete) {
        onCreateComplete();
      }
      onSelectProject(project.id);
    } catch (err: any) {
      alert(`Failed to create project: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: number, name: string) => {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteProject(id);
      await loadProjects();
    } catch (err: any) {
      alert(`Failed to delete project: ${err.message}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Workspace Header - Fixed */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-950/50 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{spaceName}</h2>
            <p className="text-sm text-gray-400">Your workspace</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowGallery(true)}
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white transition-colors rounded-lg flex items-center gap-2"
            >
              <Package size={16} />
              Components
            </button>
          <button
            onClick={onExitWorkspace}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors border border-gray-700 rounded-lg hover:border-gray-600"
          >
            Exit Workspace
          </button>
          </div>
        </div>
      </div>

      {/* Projects Section - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">My Projects</h1>
          <p className="text-sm text-gray-400">Create and manage your reel projects</p>
        </div>

      {error && (
        <div className="max-w-7xl mx-auto mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Create Project Button */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-semibold shadow-lg transition-all transform hover:scale-105"
        >
          <Plus size={20} />
          Create New Project
        </button>
      </div>

      {/* Projects Grid - More compact layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {projects.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Video size={48} className="mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400 mb-2">No projects yet</p>
            <p className="text-gray-500 text-sm">Click "Create New Project" to get started</p>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-lg p-2.5 hover:border-blue-500/50 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => onSelectProject(project.id)}
            >
              {/* Video thumbnail placeholder - compact */}
              <div className="aspect-video bg-gray-900 rounded-md mb-1.5 flex items-center justify-center group-hover:bg-gray-800 transition-colors">
                <Video size={24} className="text-gray-600 group-hover:text-blue-500 transition-colors" />
              </div>

              {/* Project name - compact */}
              <h3 className="text-xs font-bold text-white mb-1 truncate" title={project.name}>
                {project.name}
              </h3>

              {/* Meta info - compact */}
              <div className="flex items-center text-[10px] text-gray-400 mb-1.5">
                <Clock size={10} className="mr-0.5" />
                  {formatDate(project.created_at)}
              </div>

              {/* Status badges - compact inline */}
              <div className="flex items-center gap-1 mb-1.5">
                {project.has_subtitles && (
                  <span className="flex items-center gap-0.5 px-1 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded-full">
                    <CheckCircle size={8} />
                    SRT
                  </span>
                )}
                {project.has_content && (
                  <span className="flex items-center gap-0.5 px-1 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] rounded-full">
                    <CheckCircle size={8} />
                    HTML
                  </span>
                )}
              </div>

              {/* Delete button - compact */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProject(project.id, project.name);
                }}
                className="flex items-center gap-0.5 text-red-400 hover:text-red-300 text-[10px] transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={10} />
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 max-w-lg w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Create New Project</h2>
            <p className="text-gray-400 text-sm mb-6">
              Create a project and add video on the next page
            </p>

            {/* Project name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !creating && newProjectName.trim() && handleCreateProject()}
                placeholder="My Awesome Reel"
                autoFocus
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCreateProject}
                disabled={creating || !newProjectName.trim()}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                }}
                disabled={creating}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      
      {showGallery && <ComponentGallery onClose={() => setShowGallery(false)} />}
    </div>
  );
};
