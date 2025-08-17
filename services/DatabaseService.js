const Database = require('../config/database');
const Session = require('../models/Session');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');

class DatabaseService {
  constructor() {
    this.db = null;
    this.sessionModel = null;
    this.studentModel = null;
    this.attendanceModel = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize database connection
      this.db = new Database();
      await this.db.connect();
      await this.db.initializeSchema();
      await this.db.insertHardcodedStudents();

      // Initialize models
      this.sessionModel = new Session(this.db);
      this.studentModel = new Student(this.db);
      this.attendanceModel = new Attendance(this.db);

      this.isInitialized = true;
      console.log('Database service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  // Getter methods for models
  getSessionModel() {
    this.ensureInitialized();
    return this.sessionModel;
  }

  getStudentModel() {
    this.ensureInitialized();
    return this.studentModel;
  }

  getAttendanceModel() {
    this.ensureInitialized();
    return this.attendanceModel;
  }

  // Direct database access (for advanced queries)
  getDatabase() {
    this.ensureInitialized();
    return this.db;
  }

  // Ensure service is initialized
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized. Call initialize() first.');
    }
  }

  // Close database connection
  async close() {
    if (this.db) {
      await this.db.close();
      this.isInitialized = false;
    }
  }

  // Health check
  async healthCheck() {
    try {
      this.ensureInitialized();
      // Simple query to check database connectivity
      await this.db.get('SELECT 1 as test');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }

  // Get database statistics
  async getStats() {
    this.ensureInitialized();
    
    const [studentCount, sessionCount, attendanceCount] = await Promise.all([
      this.studentModel.getCount(),
      this.db.get('SELECT COUNT(*) as count FROM sessions'),
      this.db.get('SELECT COUNT(*) as count FROM attendance')
    ]);

    return {
      students: studentCount,
      sessions: sessionCount.count,
      attendanceRecords: attendanceCount.count,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
const databaseService = new DatabaseService();
module.exports = databaseService;