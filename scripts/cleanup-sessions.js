#!/usr/bin/env node

/**
 * Cleanup script to close all active sessions
 * Useful for development and maintenance
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const databaseService = require("../services/DatabaseService");

async function cleanupActiveSessions() {
  console.log("🧹 Starting session cleanup...");

  try {
    // Initialize database
    if (!databaseService.isInitialized) {
      await databaseService.initialize();
      console.log("✅ Database initialized");
    }

    const db = databaseService.getDatabase();

    // Get count of active sessions before cleanup
    const activeCount = await db.get(
      "SELECT COUNT(*) as count FROM sessions WHERE is_active = 1"
    );
    console.log(`📊 Found ${activeCount.count} active session(s)`);

    if (activeCount.count === 0) {
      console.log("✨ No active sessions to cleanup");
      return;
    }

    // Close all active sessions
    const result = await db.run(`
      UPDATE sessions 
      SET is_active = 0, end_time = datetime('now') 
      WHERE is_active = 1
    `);

    console.log(`✅ Successfully closed ${result.changes} session(s)`);

    // Show session details that were closed
    const closedSessions = await db.all(`
      SELECT id, faculty_id, course_name, course_code, section, start_time, end_time
      FROM sessions 
      WHERE end_time >= datetime('now', '-1 minute')
      ORDER BY end_time DESC
    `);

    if (closedSessions.length > 0) {
      console.log("\n📋 Closed sessions:");
      closedSessions.forEach((session, index) => {
        console.log(
          `   ${index + 1}. ${session.course_name} (${
            session.course_code
          }) - Section ${session.section}`
        );
        console.log(`      Faculty: ${session.faculty_id}`);
        console.log(`      Started: ${session.start_time}`);
        console.log(`      Ended: ${session.end_time}`);
        console.log("");
      });
    }
  } catch (error) {
    console.error("❌ Error during cleanup:", error.message);
    process.exit(1);
  } finally {
    // Close database connection
    if (databaseService.isInitialized) {
      databaseService.close();
      console.log("🔒 Database connection closed");
    }
  }

  console.log("🎉 Cleanup completed successfully!");
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupActiveSessions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Cleanup failed:", error);
      process.exit(1);
    });
}

module.exports = cleanupActiveSessions;
