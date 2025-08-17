const Database = require('../config/database');
const SessionService = require('../services/SessionService');

// Mock QRCodeService
jest.mock('../services/QRCodeService', () => {
  let mockBaseUrl = 'http://localhost:3000';
  
  return jest.fn().mockImplementation(() => ({
    generateQRCode: jest.fn().mockImplementation((sessionId, token) => Promise.resolve({
      success: true,
      qrData: {
        sessionId: sessionId,
        token: token,
        url: `${mockBaseUrl}/attend/${sessionId}?token=${token}`,
        qrCodeDataUrl: 'data:image/png;base64,test-data',
        qrCodeSvg: '<svg>test</svg>',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30000).toISOString()
      }
    })),
    startQRRotation: jest.fn().mockImplementation((sessionId) => ({
      success: true,
      sessionId: sessionId,
      message: 'QR rotation started',
      intervalMs: 30000
    })),
    stopQRRotation: jest.fn().mockImplementation((sessionId) => ({
      success: true,
      sessionId: sessionId,
      message: 'QR rotation stopped',
      wasActive: true
    })),
    getRotationStatus: jest.fn().mockImplementation((sessionId) => ({
      isActive: false,
      sessionId: sessionId
    })),
    setBaseUrl: jest.fn().mockImplementation((url) => {
      mockBaseUrl = url;
    }),
    getBaseUrl: jest.fn().mockImplementation(() => mockBaseUrl)
  }));
});

describe('SessionService', () => {
  let db;
  let sessionService;

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
    sessionService = new SessionService(db);
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Session Creation and Validation', () => {
    test('should start a new session successfully', async () => {
      const sessionData = {
        facultyId: 'faculty123',
        courseName: 'Data Structures',
        courseCode: 'CSE201',
        section: 'A'
      };

      const result = await sessionService.startSession(sessionData);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session.faculty_id).toBe('faculty123');
      expect(result.session.is_active).toBe(1);
      expect(result.qrData).toBeDefined();
      expect(result.qrData.sessionId).toBe(result.session.id);
      expect(result.qrData.token).toBeDefined();
      expect(result.qrData.expiresAt).toBeDefined();
    });

    test('should validate required session data', async () => {
      const invalidData = {
        facultyId: 'faculty123',
        courseName: 'Data Structures',
        // Missing courseCode and section
      };

      const result = await sessionService.startSession(invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('courseCode is required');
    });

    test('should validate course code format', async () => {
      const invalidData = {
        facultyId: 'faculty123',
        courseName: 'Data Structures',
        courseCode: 'invalid-code',
        section: 'A'
      };

      const result = await sessionService.startSession(invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Course code must be in format');
    });

    test('should validate section format', async () => {
      const invalidData = {
        facultyId: 'faculty123',
        courseName: 'Data Structures',
        courseCode: 'CSE201',
        section: 'invalid'
      };

      const result = await sessionService.startSession(invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Section must be a single uppercase letter');
    });

    test('should prevent multiple active sessions for same faculty', async () => {
      const sessionData = {
        facultyId: 'faculty456',
        courseName: 'Algorithms',
        courseCode: 'CSE301',
        section: 'A'
      };

      // Start first session
      const result1 = await sessionService.startSession(sessionData);
      expect(result1.success).toBe(true);

      // Try to start second session
      const sessionData2 = {
        ...sessionData,
        courseName: 'Database Systems',
        courseCode: 'CSE401'
      };

      const result2 = await sessionService.startSession(sessionData2);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Faculty already has an active session');
    });
  });

  describe('Session Management', () => {
    async function createTestSession(facultyId = 'faculty789') {
      const sessionData = {
        facultyId,
        courseName: 'Test Course',
        courseCode: 'TEST101',
        section: 'A'
      };
      const result = await sessionService.startSession(sessionData);
      if (!result.success) {
        throw new Error(`Failed to create test session: ${result.error}`);
      }
      return result.session;
    }

    test('should end session successfully', async () => {
      const facultyId = 'faculty789-1';
      const testSession = await createTestSession(facultyId);
      const result = await sessionService.endSession(testSession.id, facultyId);

      expect(result.success).toBe(true);
      expect(result.session.is_active).toBe(0);
      expect(result.session.end_time).toBeDefined();
      expect(result.message).toBe('Session ended successfully');
    });

    test('should not end session for unauthorized faculty', async () => {
      const facultyId = 'faculty789-2';
      const testSession = await createTestSession(facultyId);
      const result = await sessionService.endSession(testSession.id, 'unauthorized-faculty');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    test('should not end non-existent session', async () => {
      const result = await sessionService.endSession('non-existent-id', 'faculty789-3');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    test('should not end already ended session', async () => {
      const facultyId = 'faculty789-4';
      const testSession = await createTestSession(facultyId);
      
      // End the session first
      await sessionService.endSession(testSession.id, facultyId);

      // Try to end again
      const result = await sessionService.endSession(testSession.id, facultyId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session is already ended');
    });

    test('should get session status for active session', async () => {
      const facultyId = 'faculty789-5';
      const testSession = await createTestSession(facultyId);
      const result = await sessionService.getSessionStatus(testSession.id, facultyId);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session.id).toBe(testSession.id);
      expect(result.session.isActive).toBe(true);
      expect(result.qrData).toBeDefined();
      expect(result.qrData.sessionId).toBe(testSession.id);
    });

    test('should get session status for ended session', async () => {
      const facultyId = 'faculty789-6';
      const testSession = await createTestSession(facultyId);
      
      // End the session first
      await sessionService.endSession(testSession.id, facultyId);

      const result = await sessionService.getSessionStatus(testSession.id, facultyId);

      expect(result.success).toBe(true);
      expect(result.session.isActive).toBe(false);
      expect(result.qrData).toBeUndefined(); // No QR data for inactive session
    });

    test('should not get session status for unauthorized faculty', async () => {
      const facultyId = 'faculty789-7';
      const testSession = await createTestSession(facultyId);
      const result = await sessionService.getSessionStatus(testSession.id, 'unauthorized-faculty');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('QR Token Management', () => {
    async function createTokenTestSession(facultyId = 'faculty999') {
      const sessionData = {
        facultyId,
        courseName: 'Token Test Course',
        courseCode: 'CSE301',
        section: 'A'
      };
      const result = await sessionService.startSession(sessionData);
      if (!result.success) {
        throw new Error(`Failed to create token test session: ${result.error}`);
      }
      return result.session;
    }

    test('should rotate QR token successfully', async () => {
      const facultyId = 'faculty999-1';
      const testSession = await createTokenTestSession(facultyId);
      const originalToken = testSession.current_token;
      
      const result = await sessionService.rotateQRToken(testSession.id, facultyId);

      expect(result.success).toBe(true);
      expect(result.qrData).toBeDefined();
      expect(result.qrData.sessionId).toBe(testSession.id);
      expect(result.qrData.token).toBeDefined();
      expect(result.qrData.token).not.toBe(originalToken);
      expect(result.qrData.expiresAt).toBeDefined();
    });

    test('should not rotate token for unauthorized faculty', async () => {
      const facultyId = 'faculty999-2';
      const testSession = await createTokenTestSession(facultyId);
      const result = await sessionService.rotateQRToken(testSession.id, 'unauthorized-faculty');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    test('should not rotate token for inactive session', async () => {
      const facultyId = 'faculty999-3';
      const testSession = await createTokenTestSession(facultyId);
      
      // End the session first
      await sessionService.endSession(testSession.id, facultyId);

      const result = await sessionService.rotateQRToken(testSession.id, facultyId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot rotate token for inactive session');
    });

    test('should validate attendance token successfully', async () => {
      const facultyId = 'faculty999-4';
      const testSession = await createTokenTestSession(facultyId);
      const result = await sessionService.validateAttendanceToken(testSession.id, testSession.current_token);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.message).toContain('Token is valid');
    });

    test('should reject invalid attendance token', async () => {
      const facultyId = 'faculty999-5';
      const testSession = await createTokenTestSession(facultyId);
      const result = await sessionService.validateAttendanceToken(testSession.id, 'invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
      expect(result.canRetry).toBe(false);
    });

    test('should handle expired token validation', async () => {
      const facultyId = 'faculty999-6';
      const testSession = await createTokenTestSession(facultyId);
      
      // Manually set expired token
      const expiredTime = new Date(Date.now() - 1000).toISOString();
      await sessionService.sessionModel.updateToken(testSession.id, testSession.current_token, expiredTime);

      const result = await sessionService.validateAttendanceToken(testSession.id, testSession.current_token);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token expired');
      expect(result.canRetry).toBe(true);
    });
  });

  describe('Faculty Session History', () => {
    async function createMultipleSessions(facultyId) {
      // Create multiple sessions for testing (one at a time since faculty can only have one active session)
      const sessionConfigs = [
        {
          facultyId,
          courseName: 'Course 1',
          courseCode: 'CSE101',
          section: 'A'
        },
        {
          facultyId,
          courseName: 'Course 2',
          courseCode: 'CSE102',
          section: 'B'
        },
        {
          facultyId,
          courseName: 'Course 3',
          courseCode: 'CSE103',
          section: 'A'
        }
      ];

      const createdSessions = [];
      
      for (let i = 0; i < sessionConfigs.length; i++) {
        const sessionData = sessionConfigs[i];
        const result = await sessionService.startSession(sessionData);
        if (!result.success) {
          throw new Error(`Failed to create session: ${result.error}`);
        }
        createdSessions.push(result.session);
        
        // End the first two sessions to create history, keep the last one active
        if (i < sessionConfigs.length - 1) {
          await sessionService.endSession(result.session.id, facultyId);
        }
      }

      return createdSessions;
    }

    test('should get all faculty sessions', async () => {
      const facultyId = 'faculty888-1';
      await createMultipleSessions(facultyId);
      const result = await sessionService.getFacultySessionHistory(facultyId);

      expect(result.success).toBe(true);
      expect(result.sessions).toBeDefined();
      expect(result.sessions.length).toBeGreaterThanOrEqual(3);
      
      result.sessions.forEach(session => {
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('courseName');
        expect(session).toHaveProperty('courseCode');
        expect(session).toHaveProperty('isActive');
      });
    });

    test('should get only active faculty sessions', async () => {
      const facultyId = 'faculty888-2';
      await createMultipleSessions(facultyId);
      const result = await sessionService.getFacultySessionHistory(facultyId, { activeOnly: true });

      expect(result.success).toBe(true);
      expect(result.sessions).toBeDefined();
      
      result.sessions.forEach(session => {
        expect(session.isActive).toBe(true);
      });
    });

    test('should limit session history results', async () => {
      const facultyId = 'faculty888-3';
      await createMultipleSessions(facultyId);
      const result = await sessionService.getFacultySessionHistory(facultyId, { limit: 2 });

      expect(result.success).toBe(true);
      expect(result.sessions.length).toBeLessThanOrEqual(2);
    });

    test('should return empty array for faculty with no sessions', async () => {
      const result = await sessionService.getFacultySessionHistory('faculty-no-sessions');

      expect(result.success).toBe(true);
      expect(result.sessions).toEqual([]);
    });
  });

  describe('Token Cleanup', () => {
    test('should cleanup expired tokens', async () => {
      // Create sessions with tokens that will expire
      const sessionData1 = {
        facultyId: 'faculty111',
        courseName: 'Cleanup Test 1',
        courseCode: 'CSE401',
        section: 'A'
      };

      const sessionData2 = {
        facultyId: 'faculty222',
        courseName: 'Cleanup Test 2',
        courseCode: 'CSE402',
        section: 'B'
      };

      const result1 = await sessionService.startSession(sessionData1);
      const result2 = await sessionService.startSession(sessionData2);

      // Manually expire the tokens
      const expiredTime = new Date(Date.now() - 1000).toISOString();
      await sessionService.sessionModel.updateToken(result1.session.id, result1.session.current_token, expiredTime);
      await sessionService.sessionModel.updateToken(result2.session.id, result2.session.current_token, expiredTime);

      const cleanupResult = await sessionService.cleanupExpiredTokens();

      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.cleanedCount).toBeGreaterThanOrEqual(2);
      expect(cleanupResult.message).toContain('Cleaned up');
    });
  });

  describe('QR Code Rotation Management', () => {
    test('should start QR rotation successfully', async () => {
      const sessionData = {
        facultyId: 'faculty-qr-1',
        courseName: 'QR Rotation Test',
        courseCode: 'CSE301',
        section: 'A'
      };

      const sessionResult = await sessionService.startSession(sessionData);
      expect(sessionResult.success).toBe(true);

      const mockCallback = jest.fn();
      const rotationResult = await sessionService.startQRRotation(
        sessionResult.session.id,
        sessionData.facultyId,
        mockCallback
      );

      expect(rotationResult.success).toBe(true);
      expect(rotationResult.sessionId).toBe(sessionResult.session.id);
    });

    test('should stop QR rotation successfully', async () => {
      const sessionData = {
        facultyId: 'faculty-qr-2',
        courseName: 'QR Stop Test',
        courseCode: 'CSE302',
        section: 'B'
      };

      const sessionResult = await sessionService.startSession(sessionData);
      const stopResult = sessionService.stopQRRotation(sessionResult.session.id);

      expect(stopResult.success).toBe(true);
      expect(stopResult.sessionId).toBe(sessionResult.session.id);
    });

    test('should get QR rotation status', async () => {
      const sessionData = {
        facultyId: 'faculty-qr-3',
        courseName: 'QR Status Test',
        courseCode: 'CSE303',
        section: 'C'
      };

      const sessionResult = await sessionService.startSession(sessionData);
      const statusResult = sessionService.getQRRotationStatus(sessionResult.session.id);

      expect(statusResult.sessionId).toBe(sessionResult.session.id);
      expect(statusResult.isActive).toBeDefined();
    });

    test('should handle QR rotation for unauthorized faculty', async () => {
      const sessionData = {
        facultyId: 'faculty-qr-4',
        courseName: 'QR Auth Test',
        courseCode: 'CSE304',
        section: 'D'
      };

      const sessionResult = await sessionService.startSession(sessionData);
      const mockCallback = jest.fn();
      
      const rotationResult = await sessionService.startQRRotation(
        sessionResult.session.id,
        'unauthorized-faculty',
        mockCallback
      );

      expect(rotationResult.success).toBe(false);
      expect(rotationResult.error).toContain('Unauthorized');
    });

    test('should handle QR rotation for inactive session', async () => {
      const sessionData = {
        facultyId: 'faculty-qr-5',
        courseName: 'QR Inactive Test',
        courseCode: 'CSE305',
        section: 'E'
      };

      const sessionResult = await sessionService.startSession(sessionData);
      
      // End the session first
      await sessionService.endSession(sessionResult.session.id, sessionData.facultyId);
      
      const mockCallback = jest.fn();
      const rotationResult = await sessionService.startQRRotation(
        sessionResult.session.id,
        sessionData.facultyId,
        mockCallback
      );

      expect(rotationResult.success).toBe(false);
      expect(rotationResult.error).toContain('inactive session');
    });
  });

  describe('QR Base URL Management', () => {
    test('should set and get QR base URL', () => {
      const newBaseUrl = 'https://example.com';
      
      sessionService.setQRBaseUrl(newBaseUrl);
      const retrievedUrl = sessionService.getQRBaseUrl();
      
      expect(retrievedUrl).toBe(newBaseUrl);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Close database to simulate error
      await db.close();

      const sessionData = {
        facultyId: 'faculty123',
        courseName: 'Error Test',
        courseCode: 'CSE501',
        section: 'A'
      };

      const result = await sessionService.startSession(sessionData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Reconnect for other tests
      await db.connect();
      await db.initializeSchema();
    });
  });
});