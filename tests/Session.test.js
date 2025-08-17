const Database = require('../config/database');
const Session = require('../models/Session');

describe('Session Management', () => {
  let db;
  let sessionModel;

  beforeAll(async () => {
    // Use in-memory database for testing
    db = new Database();
    // Override the database path for testing
    db.connect = () => {
      return new Promise((resolve, reject) => {
        const sqlite3 = require('sqlite3').verbose();
        db.db = new sqlite3.Database(':memory:', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    };

    await db.connect();
    await db.initializeSchema();
    sessionModel = new Session(db);
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Session Creation and Activation', () => {
    test('should create a new session with automatic activation', async () => {
      const sessionData = {
        facultyId: 'faculty123',
        courseName: 'Data Structures',
        courseCode: 'CSE201',
        section: 'A'
      };

      const session = await sessionModel.create(sessionData);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.faculty_id).toBe('faculty123');
      expect(session.course_name).toBe('Data Structures');
      expect(session.course_code).toBe('CSE201');
      expect(session.section).toBe('A');
      expect(session.is_active).toBe(1);
      expect(session.current_token).toBeDefined();
      expect(session.token_expiry).toBeDefined();
      expect(session.start_time).toBeDefined();
    });

    test('should create session with provided token and expiry', async () => {
      const customToken = 'custom-token-123';
      const customExpiry = new Date(Date.now() + 60000).toISOString();
      
      const sessionData = {
        facultyId: 'faculty456',
        courseName: 'Algorithms',
        courseCode: 'CSE301',
        section: 'B',
        currentToken: customToken,
        tokenExpiry: customExpiry
      };

      const session = await sessionModel.create(sessionData);

      expect(session.current_token).toBe(customToken);
      expect(session.token_expiry).toBe(customExpiry);
    });

    test('should activate an inactive session', async () => {
      // Create and then deactivate a session
      const sessionData = {
        facultyId: 'faculty789',
        courseName: 'Database Systems',
        courseCode: 'CSE401',
        section: 'A'
      };

      const session = await sessionModel.create(sessionData);
      await sessionModel.deactivate(session.id);

      // Activate the session
      const activatedSession = await sessionModel.activate(session.id);

      expect(activatedSession.is_active).toBe(1);
      expect(activatedSession.current_token).toBeDefined();
      expect(activatedSession.token_expiry).toBeDefined();
    });

    test('should deactivate an active session', async () => {
      const sessionData = {
        facultyId: 'faculty101',
        courseName: 'Operating Systems',
        courseCode: 'CSE402',
        section: 'A'
      };

      const session = await sessionModel.create(sessionData);
      const deactivatedSession = await sessionModel.deactivate(session.id);

      expect(deactivatedSession.is_active).toBe(0);
      expect(deactivatedSession.current_token).toBeNull();
      expect(deactivatedSession.token_expiry).toBeNull();
    });
  });

  describe('Session Validation', () => {
    let testSession;

    beforeEach(async () => {
      const sessionData = {
        facultyId: 'faculty999',
        courseName: 'Test Course',
        courseCode: 'TEST101',
        section: 'A'
      };
      testSession = await sessionModel.create(sessionData);
    });

    test('should validate active session with correct token', async () => {
      const validation = await sessionModel.validateSessionToken(
        testSession.id, 
        testSession.current_token
      );

      expect(validation.valid).toBe(true);
      expect(validation.session).toBeDefined();
      expect(validation.session.id).toBe(testSession.id);
    });

    test('should reject validation for non-existent session', async () => {
      const validation = await sessionModel.validateSessionToken(
        'non-existent-id', 
        'any-token'
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Session not found');
    });

    test('should reject validation for inactive session', async () => {
      await sessionModel.deactivate(testSession.id);
      
      const validation = await sessionModel.validateSessionToken(
        testSession.id, 
        testSession.current_token
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Session is not active');
    });

    test('should reject validation for incorrect token', async () => {
      const validation = await sessionModel.validateSessionToken(
        testSession.id, 
        'wrong-token'
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Invalid token');
    });

    test('should reject validation for expired token', async () => {
      // Update session with expired token
      const expiredTime = new Date(Date.now() - 1000).toISOString();
      await sessionModel.updateToken(testSession.id, testSession.current_token, expiredTime);
      
      const validation = await sessionModel.validateSessionToken(
        testSession.id, 
        testSession.current_token
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Token expired');
    });

    test('should check if session is active', async () => {
      const isActive = await sessionModel.isActive(testSession.id);
      expect(isActive).toBe(true);

      await sessionModel.deactivate(testSession.id);
      const isInactive = await sessionModel.isActive(testSession.id);
      expect(isInactive).toBe(false);
    });
  });

  describe('Token Management', () => {
    let testSession;

    beforeEach(async () => {
      const sessionData = {
        facultyId: 'faculty888',
        courseName: 'Token Test Course',
        courseCode: 'TOKEN101',
        section: 'A'
      };
      testSession = await sessionModel.create(sessionData);
    });

    test('should generate secure tokens', () => {
      const token1 = sessionModel.generateSecureToken();
      const token2 = sessionModel.generateSecureToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex characters
      expect(token2.length).toBe(64);
    });

    test('should generate token expiry 30 seconds in future', () => {
      const expiry = sessionModel.getTokenExpiry();
      const expiryTime = new Date(expiry);
      const now = new Date();
      const timeDiff = expiryTime.getTime() - now.getTime();

      expect(timeDiff).toBeGreaterThan(29000); // At least 29 seconds
      expect(timeDiff).toBeLessThan(31000); // At most 31 seconds
    });

    test('should detect expired tokens', () => {
      const expiredTime = new Date(Date.now() - 1000).toISOString();
      const futureTime = new Date(Date.now() + 30000).toISOString();

      expect(sessionModel.isTokenExpired(expiredTime)).toBe(true);
      expect(sessionModel.isTokenExpired(futureTime)).toBe(false);
      expect(sessionModel.isTokenExpired(null)).toBe(true);
      expect(sessionModel.isTokenExpired(undefined)).toBe(true);
    });

    test('should rotate token for active session', async () => {
      const originalToken = testSession.current_token;
      const rotatedSession = await sessionModel.rotateToken(testSession.id);

      expect(rotatedSession.current_token).toBeDefined();
      expect(rotatedSession.current_token).not.toBe(originalToken);
      expect(rotatedSession.token_expiry).toBeDefined();
      expect(new Date(rotatedSession.token_expiry)).toBeInstanceOf(Date);
    });

    test('should not rotate token for inactive session', async () => {
      await sessionModel.deactivate(testSession.id);

      await expect(sessionModel.rotateToken(testSession.id))
        .rejects.toThrow('Cannot rotate token for inactive session');
    });

    test('should not rotate token for non-existent session', async () => {
      await expect(sessionModel.rotateToken('non-existent-id'))
        .rejects.toThrow('Session not found');
    });

    test('should update session token', async () => {
      const newToken = 'new-test-token';
      const newExpiry = new Date(Date.now() + 60000).toISOString();

      const updatedSession = await sessionModel.updateToken(testSession.id, newToken, newExpiry);

      expect(updatedSession.current_token).toBe(newToken);
      expect(updatedSession.token_expiry).toBe(newExpiry);
    });
  });

  describe('Session Lifecycle Management', () => {
    let testSession;

    beforeEach(async () => {
      const sessionData = {
        facultyId: 'faculty777',
        courseName: 'Lifecycle Test Course',
        courseCode: 'LIFE101',
        section: 'A'
      };
      testSession = await sessionModel.create(sessionData);
    });

    test('should end session properly', async () => {
      const endedSession = await sessionModel.endSession(testSession.id);

      expect(endedSession.is_active).toBe(0);
      expect(endedSession.end_time).toBeDefined();
      expect(endedSession.current_token).toBeNull();
      expect(endedSession.token_expiry).toBeNull();
    });

    test('should find active sessions', async () => {
      // Create multiple sessions
      await sessionModel.create({
        facultyId: 'faculty666',
        courseName: 'Active Course 1',
        courseCode: 'ACT101',
        section: 'A'
      });

      const activeSession2 = await sessionModel.create({
        facultyId: 'faculty666',
        courseName: 'Active Course 2',
        courseCode: 'ACT102',
        section: 'B'
      });

      // End one session
      await sessionModel.endSession(activeSession2.id);

      const activeSessions = await sessionModel.findActive();
      expect(activeSessions.length).toBeGreaterThan(0);
      
      // All returned sessions should be active
      activeSessions.forEach(session => {
        expect(session.is_active).toBe(1);
      });
    });

    test('should find sessions by faculty', async () => {
      const facultyId = 'faculty555';
      
      // Create multiple sessions for the same faculty
      await sessionModel.create({
        facultyId,
        courseName: 'Course 1',
        courseCode: 'C101',
        section: 'A'
      });

      await sessionModel.create({
        facultyId,
        courseName: 'Course 2',
        courseCode: 'C102',
        section: 'B'
      });

      const facultySessions = await sessionModel.findByFaculty(facultyId);
      expect(facultySessions.length).toBe(2);
      
      facultySessions.forEach(session => {
        expect(session.faculty_id).toBe(facultyId);
      });
    });

    test('should find active sessions by faculty', async () => {
      const facultyId = 'faculty444';
      
      // Create sessions for faculty
      const session1 = await sessionModel.create({
        facultyId,
        courseName: 'Active Course',
        courseCode: 'AC101',
        section: 'A'
      });

      const session2 = await sessionModel.create({
        facultyId,
        courseName: 'Inactive Course',
        courseCode: 'IC101',
        section: 'B'
      });

      // End one session
      await sessionModel.endSession(session2.id);

      const activeFacultySessions = await sessionModel.findActiveByfaculty(facultyId);
      expect(activeFacultySessions.length).toBe(1);
      expect(activeFacultySessions[0].id).toBe(session1.id);
      expect(activeFacultySessions[0].is_active).toBe(1);
    });
  });

  describe('Session Statistics and Cleanup', () => {
    let testSession;

    beforeEach(async () => {
      const sessionData = {
        facultyId: 'faculty333',
        courseName: 'Stats Test Course',
        courseCode: 'STATS101',
        section: 'A'
      };
      testSession = await sessionModel.create(sessionData);
    });

    test('should get session with attendance statistics', async () => {
      const sessionWithStats = await sessionModel.getSessionWithStats(testSession.id);

      expect(sessionWithStats).toBeDefined();
      expect(sessionWithStats.id).toBe(testSession.id);
      expect(sessionWithStats.attendance_count).toBe(0); // No attendance marked yet
    });

    test('should cleanup expired tokens', async () => {
      // Create sessions with expired tokens
      const expiredSession1 = await sessionModel.create({
        facultyId: 'faculty222',
        courseName: 'Expired Course 1',
        courseCode: 'EXP101',
        section: 'A'
      });

      const expiredSession2 = await sessionModel.create({
        facultyId: 'faculty222',
        courseName: 'Expired Course 2',
        courseCode: 'EXP102',
        section: 'B'
      });

      // Manually set expired tokens
      const expiredTime = new Date(Date.now() - 1000).toISOString();
      await sessionModel.updateToken(expiredSession1.id, 'expired-token-1', expiredTime);
      await sessionModel.updateToken(expiredSession2.id, 'expired-token-2', expiredTime);

      // Get count of active sessions with expired tokens before cleanup
      const beforeCleanup = await sessionModel.db.all(
        'SELECT COUNT(*) as count FROM sessions WHERE token_expiry <= ? AND is_active = 1',
        [new Date().toISOString()]
      );

      const cleanedCount = await sessionModel.cleanupExpiredTokens();
      expect(cleanedCount).toBeGreaterThanOrEqual(2);

      // Verify tokens were cleared
      const session1 = await sessionModel.findById(expiredSession1.id);
      const session2 = await sessionModel.findById(expiredSession2.id);

      expect(session1.current_token).toBeNull();
      expect(session1.token_expiry).toBeNull();
      expect(session2.current_token).toBeNull();
      expect(session2.token_expiry).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle updates to non-existent sessions', async () => {
      await expect(
        sessionModel.update('non-existent-id', { course_name: 'Updated Course' })
      ).rejects.toThrow('Session not found');
    });

    test('should handle empty update data', async () => {
      const sessionData = {
        facultyId: 'faculty111',
        courseName: 'Error Test Course',
        courseCode: 'ERR101',
        section: 'A'
      };
      const session = await sessionModel.create(sessionData);

      await expect(
        sessionModel.update(session.id, {})
      ).rejects.toThrow('No fields to update');
    });

    test('should return undefined for non-existent session lookup', async () => {
      const session = await sessionModel.findById('non-existent-id');
      expect(session).toBeUndefined();
    });

    test('should return false for isActive on non-existent session', async () => {
      const isActive = await sessionModel.isActive('non-existent-id');
      expect(isActive).toBe(false);
    });
  });
});