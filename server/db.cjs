/**
 * SQLite Database Setup
 * Stores projects, videos, and SRT data
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file location
const DB_DIR = path.join(__dirname, '../.data');
const DB_PATH = path.join(DB_DIR, 'reel-composer.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeTables();
  }
});

/**
 * Create tables if they don't exist
 */
function initializeTables() {
  db.serialize(() => {
    // Check if we need to migrate the projects table
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'", (err, row) => {
      if (err) {
        console.error('Error checking projects table:', err);
        return;
      }

      if (row && row.sql && row.sql.includes('video_filename TEXT NOT NULL')) {
        // Need to migrate - SQLite doesn't support ALTER COLUMN, so we need to recreate
        console.log('🔄 Migrating projects table to make video fields optional...');
        
        db.run('ALTER TABLE projects RENAME TO projects_old', (err) => {
          if (err) {
            console.error('Error renaming old table:', err);
            return;
          }

          // Create new table with optional video fields
          db.run(`
            CREATE TABLE projects (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              video_filename TEXT,
              video_path TEXT,
              video_duration REAL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) {
              console.error('Error creating new projects table:', err);
              return;
            }

            // Copy data from old table
            db.run(`
              INSERT INTO projects (id, name, video_filename, video_path, video_duration, created_at, updated_at)
              SELECT id, name, video_filename, video_path, video_duration, created_at, updated_at
              FROM projects_old
            `, (err) => {
              if (err) {
                console.error('Error copying data:', err);
                return;
              }

              // Drop old table
              db.run('DROP TABLE projects_old', (err) => {
                if (err) {
                  console.error('Error dropping old table:', err);
                } else {
                  console.log('✅ Projects table migrated successfully');
                }
              });
            });
          });
        });
      } else {
        // Table doesn't exist or already has correct schema
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
            video_filename TEXT,
            video_path TEXT,
        video_duration REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating projects table:', err);
      else console.log('✅ Projects table ready');
        });
      }
    });

    // SRT data table (linked to projects)
    db.run(`
      CREATE TABLE IF NOT EXISTS srt_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        srt_text TEXT NOT NULL,
        srt_json TEXT NOT NULL,
        method TEXT DEFAULT 'gemini',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('Error creating srt_data table:', err);
      else console.log('✅ SRT data table ready');
    });

    // Generated content table (animations, layouts)
    db.run(`
      CREATE TABLE IF NOT EXISTS generated_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        html_content TEXT NOT NULL,
        layout_config TEXT NOT NULL,
        topic_context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('Error creating generated_content table:', err);
      else console.log('✅ Generated content table ready');
    });

    // Animation segments table (optimized segments for animation)
    db.run(`
      CREATE TABLE IF NOT EXISTS animation_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        segment_index INTEGER NOT NULL,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        text TEXT NOT NULL,
        animation_type TEXT,
        generated_html TEXT,
        prompt_used TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('Error creating animation_segments table:', err);
      else console.log('✅ Animation segments table ready');
    });

    // Segment to subtitle mapping (many-to-many relationship)
    db.run(`
      CREATE TABLE IF NOT EXISTS segment_subtitle_map (
        segment_id INTEGER NOT NULL,
        subtitle_index INTEGER NOT NULL,
        FOREIGN KEY (segment_id) REFERENCES animation_segments(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('Error creating segment_subtitle_map table:', err);
      else console.log('✅ Segment subtitle map table ready');
    });
  });
}

/**
 * Get all projects
 */
function getAllProjects(callback) {
  const sql = `
    SELECT 
      p.*,
      CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END as has_subtitles,
      CASE WHEN g.id IS NOT NULL THEN 1 ELSE 0 END as has_content
    FROM projects p
    LEFT JOIN srt_data s ON p.id = s.project_id
    LEFT JOIN generated_content g ON p.id = g.project_id
    ORDER BY p.updated_at DESC
  `;
  db.all(sql, [], callback);
}

/**
 * Get project by ID
 */
function getProjectById(id, callback) {
  const sql = 'SELECT * FROM projects WHERE id = ?';
  db.get(sql, [id], callback);
}

/**
 * Create new project
 */
function createProject(name, videoFilename, videoPath, videoDuration, callback) {
  const sql = `
    INSERT INTO projects (name, video_filename, video_path, video_duration)
    VALUES (?, ?, ?, ?)
  `;
  db.run(sql, [name, videoFilename, videoPath, videoDuration], function(err) {
    callback(err, this ? this.lastID : null);
  });
}

/**
 * Update project
 */
function updateProject(id, updates, callback) {
  const sql = 'UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  db.run(sql, [id], callback);
}

/**
 * Delete project
 */
function deleteProject(id, callback) {
  const sql = 'DELETE FROM projects WHERE id = ?';
  db.run(sql, [id], callback);
}

/**
 * Save SRT data for project
 */
function saveSRTData(projectId, srtText, srtJson, method, callback) {
  // Delete existing SRT for this project
  const deleteSql = 'DELETE FROM srt_data WHERE project_id = ?';
  db.run(deleteSql, [projectId], (err) => {
    if (err) return callback(err);
    
    // Insert new SRT
    const insertSql = `
      INSERT INTO srt_data (project_id, srt_text, srt_json, method)
      VALUES (?, ?, ?, ?)
    `;
    db.run(insertSql, [projectId, srtText, srtJson, method], function(err) {
      callback(err, this ? this.lastID : null);
    });
  });
}

/**
 * Get SRT data for project
 */
function getSRTData(projectId, callback) {
  const sql = 'SELECT * FROM srt_data WHERE project_id = ? ORDER BY created_at DESC LIMIT 1';
  db.get(sql, [projectId], callback);
}

/**
 * Save generated content
 */
function saveGeneratedContent(projectId, htmlContent, layoutConfig, topicContext, callback) {
  // Delete existing content for this project
  const deleteSql = 'DELETE FROM generated_content WHERE project_id = ?';
  db.run(deleteSql, [projectId], (err) => {
    if (err) return callback(err);
    
    // Insert new content
    const insertSql = `
      INSERT INTO generated_content (project_id, html_content, layout_config, topic_context)
      VALUES (?, ?, ?, ?)
    `;
    db.run(insertSql, [projectId, htmlContent, layoutConfig, topicContext], function(err) {
      callback(err, this ? this.lastID : null);
    });
  });
}

/**
 * Get generated content for project
 */
function getGeneratedContent(projectId, callback) {
  const sql = 'SELECT * FROM generated_content WHERE project_id = ? ORDER BY created_at DESC LIMIT 1';
  db.get(sql, [projectId], callback);
}

/**
 * Save animation segments for a project
 */
function saveAnimationSegments(projectId, segments, callback) {
  // Delete existing segments for this project
  const deleteSql = 'DELETE FROM animation_segments WHERE project_id = ?';
  db.run(deleteSql, [projectId], (err) => {
    if (err) return callback(err);
    
    // Insert new segments
    if (segments.length === 0) return callback(null);
    
    const insertSql = `
      INSERT INTO animation_segments (project_id, segment_index, start_time, end_time, text, animation_type, generated_html, prompt_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    let completed = 0;
    let hasError = false;
    
    segments.forEach((segment, index) => {
      db.run(insertSql, [
        projectId,
        index,
        segment.startTime,
        segment.endTime,
        segment.text,
        segment.animationType || null,
        segment.generatedHtml || null,
        segment.promptUsed || null
      ], function(err) {
        if (err && !hasError) {
          hasError = true;
          return callback(err);
        }
        
        const segmentId = this.lastID;
        
        // Save subtitle mappings if provided
        if (segment.originalSubtitles && segment.originalSubtitles.length > 0) {
          const mapSql = 'INSERT INTO segment_subtitle_map (segment_id, subtitle_index) VALUES (?, ?)';
          segment.originalSubtitles.forEach(subtitleIndex => {
            db.run(mapSql, [segmentId, subtitleIndex]);
          });
        }
        
        completed++;
        if (completed === segments.length && !hasError) {
          callback(null);
        }
      });
    });
  });
}

/**
 * Get animation segments for a project
 */
function getAnimationSegments(projectId, callback) {
  const sql = `
    SELECT * FROM animation_segments 
    WHERE project_id = ? 
    ORDER BY segment_index ASC
  `;
  db.all(sql, [projectId], (err, segments) => {
    if (err) return callback(err);
    
    // Get subtitle mappings for each segment
    if (!segments || segments.length === 0) return callback(null, []);
    
    let completed = 0;
    segments.forEach((segment, index) => {
      const mapSql = 'SELECT subtitle_index FROM segment_subtitle_map WHERE segment_id = ?';
      db.all(mapSql, [segment.id], (err, mappings) => {
        if (!err && mappings) {
          segments[index].originalSubtitles = mappings.map(m => m.subtitle_index);
        }
        completed++;
        if (completed === segments.length) {
          callback(null, segments);
        }
      });
    });
  });
}

/**
 * Update a specific animation segment
 */
function updateAnimationSegment(segmentId, updates, callback) {
  const { generatedHtml, promptUsed, animationType } = updates;
  const sql = `
    UPDATE animation_segments 
    SET generated_html = COALESCE(?, generated_html),
        prompt_used = COALESCE(?, prompt_used),
        animation_type = COALESCE(?, animation_type)
    WHERE id = ?
  `;
  db.run(sql, [generatedHtml, promptUsed, animationType, segmentId], callback);
}

/**
 * Delete animation segments for a project
 */
function deleteAnimationSegments(projectId, callback) {
  const sql = 'DELETE FROM animation_segments WHERE project_id = ?';
  db.run(sql, [projectId], callback);
}

/**
 * Delete SRT data for a project
 */
function deleteSRTDataForProject(projectId, callback) {
  const sql = 'DELETE FROM srt_data WHERE project_id = ?';
  db.run(sql, [projectId], callback);
}

/**
 * Delete generated content for a project
 */
function deleteGeneratedContentForProject(projectId, callback) {
  const sql = 'DELETE FROM generated_content WHERE project_id = ?';
  db.run(sql, [projectId], callback);
}

/**
 * Get database instance
 */
function getDatabase() {
  return db;
}

module.exports = {
  db,
  getDatabase,
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
};
