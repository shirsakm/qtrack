const DatabaseService = require('../services/DatabaseService');

describe('DatabaseService', () => {
  beforeAll(async () => {
    // Override database connection for testing
    const originalConnect = DatabaseService.db?.connect;
    if (DatabaseService.db) {
      DatabaseService.db.connect = () => {
        return new Promise((resolve, reject) => {
          const sqlite3 = require('sqlite3').verbose();
          DatabaseService.db.db = new sqlite3.Database(':memory:', (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      };
    }

    await DatabaseService.initialize();
  });

  afterAll(async () => {
    await DatabaseService.close();
  });

  test('should initialize successfully', () => {
    expect(DatabaseService.isInitialized).toBe(true);
  });

  test('should provide access to models', () => {
    const sessionModel = DatabaseService.getSessionModel();
    const studentModel = DatabaseService.getStudentModel();
    const attendanceModel = DatabaseService.getAttendanceModel();

    expect(sessionModel).toBeDefined();
    expect(studentModel).toBeDefined();
    expect(attendanceModel).toBeDefined();
  });

  test('should provide database access', () => {
    const db = DatabaseService.getDatabase();
    expect(db).toBeDefined();
    expect(db.db).toBeDefined();
  });

  test('should perform health check', async () => {
    const health = await DatabaseService.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.timestamp).toBeDefined();
  });

  test('should get database statistics', async () => {
    const stats = await DatabaseService.getStats();
    expect(stats).toHaveProperty('students');
    expect(stats).toHaveProperty('sessions');
    expect(stats).toHaveProperty('attendanceRecords');
    expect(stats).toHaveProperty('timestamp');
    expect(typeof stats.students).toBe('number');
  });

  test('should throw error when accessing uninitialized service', async () => {
    const uninitializedService = require('../services/DatabaseService');
    uninitializedService.isInitialized = false;
    
    expect(() => {
      uninitializedService.getSessionModel();
    }).toThrow('Database service not initialized');
  });
});