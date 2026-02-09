/**
 * Express Backend Server for Reel Composer
 * Handles projects, video uploads, SRT storage
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  saveSRTData,
  getSRTData,
  saveGeneratedContent,
  getGeneratedContent,
  saveAnimationSegments,
  getAnimationSegments,
  updateAnimationSegment,
  deleteAnimationSegments,
  deleteSRTDataForProject,
  deleteGeneratedContentForProject,
  getDatabase,
} = require('./db.cjs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Uploads directory
const UPLOADS_DIR = path.join(__dirname, '../.data/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|webm|mkv|mp3|wav|m4a/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.test(ext.slice(1))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video/audio files allowed.'));
    }
  }
});

// ==================== API ENDPOINTS ====================

/**
 * GET /api/projects
 * Get all projects
 */
app.get('/api/projects', (req, res) => {
  getAllProjects((err, projects) => {
    if (err) {
      console.error('Error fetching projects:', err);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }
    res.json({ projects });
  });
});

/**
 * GET /api/projects/:id
 * Get project by ID with all associated data
 */
app.get('/api/projects/:id', (req, res) => {
  const projectId = req.params.id;
  
  getProjectById(projectId, (err, project) => {
    if (err) {
      console.error('Error fetching project:', err);
      return res.status(500).json({ error: 'Failed to fetch project' });
    }
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get SRT data
    getSRTData(projectId, (err, srtData) => {
      if (err) {
        console.error('Error fetching SRT data:', err);
      }

      // Get generated content
      getGeneratedContent(projectId, (err, content) => {
        if (err) {
          console.error('Error fetching generated content:', err);
        }

        res.json({
          project,
          srtData: srtData ? {
            text: srtData.srt_text,
            json: JSON.parse(srtData.srt_json),
            method: srtData.method,
          } : null,
          generatedContent: content ? {
            html: content.html_content,
            layoutConfig: JSON.parse(content.layout_config),
            topicContext: content.topic_context,
          } : null,
        });
      });
    });
  });
});

/**
 * POST /api/projects
 * Create new project with optional video upload
 */
app.post('/api/projects', upload.single('video'), (req, res) => {
  const { name, duration } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  // Video is optional
  const videoFilename = req.file ? req.file.filename : null;
  const videoPath = req.file ? `/uploads/${videoFilename}` : null;
  const videoDuration = parseFloat(duration) || 0;

  createProject(name, videoFilename, videoPath, videoDuration, (err, projectId) => {
    if (err) {
      console.error('Error creating project:', err);
      return res.status(500).json({ error: 'Failed to create project' });
    }

    getProjectById(projectId, (err, project) => {
      if (err) {
        console.error('Error fetching created project:', err);
        return res.status(500).json({ error: 'Project created but failed to fetch' });
      }
      res.status(201).json({ project });
    });
  });
});

/**
 * PUT /api/projects/:id
 * Update project (currently just updates timestamp)
 */
app.put('/api/projects/:id', (req, res) => {
  const projectId = req.params.id;
  
  updateProject(projectId, {}, (err) => {
    if (err) {
      console.error('Error updating project:', err);
      return res.status(500).json({ error: 'Failed to update project' });
    }
    res.json({ success: true });
  });
});

/**
 * PUT /api/projects/:id/video
 * Replace video for an existing project
 * Also deletes SRT and generated content since they're tied to the old video
 */
app.put('/api/projects/:id/video', upload.single('video'), (req, res) => {
  const projectId = req.params.id;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded' });
  }

  // Get existing project to delete old video
  getProjectById(projectId, (err, project) => {
    if (err || !project) {
      console.error('Error fetching project:', err);
      return res.status(500).json({ error: 'Project not found' });
    }

    // Delete old video file if it exists
    if (project.video_filename) {
      const oldVideoPath = path.join(UPLOADS_DIR, project.video_filename);
      if (fs.existsSync(oldVideoPath)) {
        fs.unlinkSync(oldVideoPath);
        console.log(`🗑️  Deleted old video: ${project.video_filename}`);
      }
    }

    // Update with new video
    const { duration } = req.body;
    const videoFilename = req.file.filename;
    const videoPath = `/uploads/${videoFilename}`;

    // Update database - also delete SRT and generated content
    const db = getDatabase();
    db.serialize(() => {
      // Delete SRT data (it's tied to the old video)
      db.run(`DELETE FROM srt_data WHERE project_id = ?`, [projectId], (err) => {
        if (err) console.error('Error deleting SRT data:', err);
        else console.log('🗑️  Deleted SRT data for replaced video');
      });
      
      // Delete generated content (it's tied to the old video)
      db.run(`DELETE FROM generated_content WHERE project_id = ?`, [projectId], (err) => {
        if (err) console.error('Error deleting generated content:', err);
        else console.log('🗑️  Deleted generated content for replaced video');
      });
      
      // Update project with new video
      db.run(
        `UPDATE projects SET video_filename = ?, video_path = ?, video_duration = ?, updated_at = datetime('now') WHERE id = ?`,
        [videoFilename, videoPath, parseFloat(duration) || 0, projectId],
        function(err) {
          if (err) {
            console.error('Error updating project video:', err);
            return res.status(500).json({ error: 'Failed to update video' });
          }

          // Return updated project
          getProjectById(projectId, (err, updatedProject) => {
            if (err) {
              return res.status(500).json({ error: 'Video updated but failed to fetch project' });
            }
            res.json({ project: updatedProject });
          });
        }
      );
    });
  });
});

/**
 * DELETE /api/projects/:id/video
 * Delete video from project (but keep the project)
 */
app.delete('/api/projects/:id/video', (req, res) => {
  const projectId = req.params.id;

  // Get project to delete video file
  getProjectById(projectId, (err, project) => {
    if (err || !project) {
      console.error('Error fetching project:', err);
      return res.status(500).json({ error: 'Project not found' });
    }

    // Delete video file if it exists
    if (project.video_filename) {
      const videoPath = path.join(UPLOADS_DIR, project.video_filename);
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log(`🗑️  Deleted video: ${project.video_filename}`);
      }
    }

    const db = getDatabase();
    
    // Delete all associated data (SRT, generated content) and remove video reference
    db.serialize(() => {
      // Delete SRT data
      db.run(`DELETE FROM srt_data WHERE project_id = ?`, [projectId], (err) => {
        if (err) console.error('Error deleting SRT data:', err);
        else console.log('🗑️  Deleted SRT data');
      });
      
      // Delete generated content
      db.run(`DELETE FROM generated_content WHERE project_id = ?`, [projectId], (err) => {
        if (err) console.error('Error deleting generated content:', err);
        else console.log('🗑️  Deleted generated content');
      });
      
      // Update project to remove video reference
      db.run(
        `UPDATE projects SET video_filename = NULL, video_path = NULL, video_duration = 0, updated_at = datetime('now') WHERE id = ?`,
        [projectId],
        function(err) {
          if (err) {
            console.error('Error removing video from project:', err);
            return res.status(500).json({ error: 'Failed to remove video' });
          }

          // Return updated project
          getProjectById(projectId, (err, updatedProject) => {
            if (err) {
              return res.status(500).json({ error: 'Video removed but failed to fetch project' });
            }
            res.json({ success: true, project: updatedProject });
          });
        }
      );
    });
  });
});

/**
 * DELETE /api/projects/:id
 * Delete project and associated files
 */
app.delete('/api/projects/:id', (req, res) => {
  const projectId = req.params.id;

  // Get project to delete video file
  getProjectById(projectId, (err, project) => {
    if (err || !project) {
      console.error('Error fetching project for deletion:', err);
      return res.status(500).json({ error: 'Failed to fetch project' });
    }

    // Delete video file if it exists
    if (project.video_filename) {
    const videoPath = path.join(UPLOADS_DIR, project.video_filename);
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
        console.log(`🗑️  Deleted video file: ${project.video_filename}`);
      }
    }

    // Delete from database
    deleteProject(projectId, (err) => {
      if (err) {
        console.error('Error deleting project:', err);
        return res.status(500).json({ error: 'Failed to delete project' });
      }
      res.json({ success: true });
    });
  });
});

/**
 * POST /api/projects/:id/srt
 * Save SRT data for project
 */
app.post('/api/projects/:id/srt', (req, res) => {
  const projectId = req.params.id;
  const { srtText, srtJson, method } = req.body;

  if (!srtText || !srtJson) {
    return res.status(400).json({ error: 'Missing srtText or srtJson' });
  }

  saveSRTData(projectId, srtText, JSON.stringify(srtJson), method || 'gemini', (err, srtId) => {
    if (err) {
      console.error('Error saving SRT data:', err);
      return res.status(500).json({ error: 'Failed to save SRT data' });
    }

    // Update project timestamp
    updateProject(projectId, {}, () => {});

    res.status(201).json({ success: true, srtId });
  });
});

/**
 * POST /api/projects/:id/content
 * Save generated content for project
 */
app.post('/api/projects/:id/content', (req, res) => {
  const projectId = req.params.id;
  const { htmlContent, layoutConfig, topicContext } = req.body;

  if (!htmlContent || !layoutConfig) {
    return res.status(400).json({ error: 'Missing htmlContent or layoutConfig' });
  }

  saveGeneratedContent(
    projectId,
    htmlContent,
    JSON.stringify(layoutConfig),
    topicContext || '',
    (err, contentId) => {
      if (err) {
        console.error('Error saving generated content:', err);
        return res.status(500).json({ error: 'Failed to save generated content' });
      }

      // Update project timestamp
      updateProject(projectId, {}, () => {});

      res.status(201).json({ success: true, contentId });
    }
  );
});

/**
 * POST /api/projects/:id/segments
 * Save animation segments for project
 */
app.post('/api/projects/:id/segments', (req, res) => {
  const projectId = req.params.id;
  const { segments } = req.body;

  if (!segments || !Array.isArray(segments)) {
    return res.status(400).json({ error: 'Missing or invalid segments array' });
  }

  saveAnimationSegments(projectId, segments, (err) => {
    if (err) {
      console.error('Error saving animation segments:', err);
      return res.status(500).json({ error: 'Failed to save animation segments' });
    }

    // Update project timestamp
    updateProject(projectId, {}, () => {});

    res.status(201).json({ success: true });
  });
});

/**
 * GET /api/projects/:id/segments
 * Get animation segments for project
 */
app.get('/api/projects/:id/segments', (req, res) => {
  const projectId = req.params.id;

  getAnimationSegments(projectId, (err, segments) => {
    if (err) {
      console.error('Error getting animation segments:', err);
      return res.status(500).json({ error: 'Failed to get animation segments' });
    }

    res.json({ segments: segments || [] });
  });
});

/**
 * PUT /api/projects/:id/segments/:segmentId
 * Update a specific animation segment
 */
app.put('/api/projects/:id/segments/:segmentId', (req, res) => {
  const segmentId = req.params.segmentId;
  const updates = req.body;

  updateAnimationSegment(segmentId, updates, (err) => {
    if (err) {
      console.error('Error updating animation segment:', err);
      return res.status(500).json({ error: 'Failed to update animation segment' });
    }

    res.json({ success: true });
  });
});

/**
 * DELETE /api/projects/:id/segments
 * Delete all animation segments for a project
 */
app.delete('/api/projects/:id/segments', (req, res) => {
  const projectId = req.params.id;

  deleteAnimationSegments(projectId, (err) => {
    if (err) {
      console.error('Error deleting animation segments:', err);
      return res.status(500).json({ error: 'Failed to delete animation segments' });
    }

    res.json({ success: true });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 Reel Composer Backend`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`💾 Database: SQLite`);
  console.log(`📁 Uploads: ${UPLOADS_DIR}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

module.exports = app;
