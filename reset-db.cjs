/**
 * Database Reset Script
 * Deletes the existing database so it can be recreated with the new schema
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '.data/reel-composer.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✅ Database deleted successfully');
  console.log('📝 The database will be recreated with the new schema when you restart the server');
} else {
  console.log('ℹ️  No database file found');
}
