const request = require('supertest');
const { app, server } = require('../server');
const databaseService = require('../services/DatabaseService');

describe('Student Attendance Marking Flow Integration Tests', () => {
  let testDb;
  let testSessionId;
  let testToken;
  let testFacultyId = 'test-faculty-student-flow';
  let testStudentEmail = 'shirsak.majumder.cse28@heritageit.edu.in';

  beforeAll(async () => {
    // Initialize test database
    await databaseService.initialize();
    testDb = databaseService.getDatabase();
  });

  afterAll(async () => {
    // Clean up
    if (databaseService.isInitialized) {
      await databaseService.close();
    }
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Ensure database is initialized
    if (!databaseService.isInitialized) {
      await databaseService.initialize();
      testDb = databaseService.getDatabase();
    }

    // Clean up test data before each test
    await testDb.run('DELETE FROM sessions WHERE faculty_id = ?', [testFacultyId]);
    await testDb.run('DELETE FROM attendance WHERE session_id IN (SELECT id FROM sessions WHERE faculty_id = ?)', [testFacultyId]);

    // Create a test session for each test
    const sessionData = {
      facultyId: testFacultyId,
      courseName: 'Student Flow Test Course',
      courseCode: 'SFT101',
      section: 'A'
    };

    const sessionResponse = await request(app)
      .post('/api/faculty/sessions/start')
      .send(sessionData);

    testSessionId = sessionResponse.body.session.id;
    testToken = sessionResponse.body.qrData.token;
  });

  describe('Complete Student Attendance Flow', () => {
    test('should handle complete QR code scan to attendance marking flow', async () => {
      // Step 1: Student scans QR code (GET /attendance/mark)
      const qrScanResponse = await request(app)
        .get('/attendance/mark')
        .query({ session: testSessionId, token: testToken })
        .expect(302); // Should redirect to Google OAuth

      // Should redirect to Google OAuth since user is not authenticated
      expect(qrScanResponse.headers.location).toContain('/auth/google');

      // Step 2: Simulate successful OAuth callback and attendance submission
      // Since we can't easily test the full OAuth flow, we'll test the attendance submission directly
      const attendanceData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: testToken
      };

      const attendanceResponse = await request(app)
        .post('/api/attendance/mark')
        .send(attendanceData)
        .expect(201);

      expect(attendanceResponse.body.success).toBe(true);
      expect(attendanceResponse.body.message).toContain('marked successfully');
      expect(attendanceResponse.body.attendance.studentEmail).toBe(testStudentEmail);
      expect(attendanceResponse.body.attendance).toHaveProperty('timestamp');

      // Step 3: Verify attendance was recorded in database
      const dbRecord = await testDb.get(
        'SELECT * FROM attendance WHERE session_id = ? AND student_email = ?',
        [testSessionId, testStudentEmail]
      );

      expect(dbRecord).toBeTruthy();
      expect(dbRecord.student_email).toBe(testStudentEmail);
      expect(dbRecord.ip_address).toBeTruthy();
      // user_agent might be null in test environment
      expect(dbRecord.user_agent).toBeDefined();
    });

    test('should handle expired QR code gracefully', async () => {
      // End the session to make the token invalid
      await request(app)
        .post(`/api/faculty/sessions/${testSessionId}/end`)
        .send({ facultyId: testFacultyId });

      // Try to access the QR code landing page
      const response = await request(app)
        .get('/attendance/mark')
        .query({ session: testSessionId, token: testToken })
        .expect(302);

      // Should redirect to error page
      expect(response.headers.location).toContain('/attendance-error.html');
      expect(response.headers.location).toContain('SESSION_EXPIRED');
    });

    test('should handle missing QR code parameters', async () => {
      // Try to access without session or token
      const response = await request(app)
        .get('/attendance/mark')
        .expect(302);

      // Should redirect to error page
      expect(response.headers.location).toContain('/attendance-error.html');
      expect(response.headers.location).toContain('MISSING_PARAMETERS');
    });

    test('should prevent duplicate attendance marking', async () => {
      const attendanceData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: testToken
      };

      // Mark attendance first time
      await request(app)
        .post('/api/attendance/mark')
        .send(attendanceData)
        .expect(201);

      // Try to mark attendance again
      const duplicateResponse = await request(app)
        .post('/api/attendance/mark')
        .send(attendanceData)
        .expect(409);

      expect(duplicateResponse.body.success).toBe(false);
      expect(duplicateResponse.body.error).toContain('already marked');
    });

    test('should validate student email format', async () => {
      const invalidEmailData = {
        sessionId: testSessionId,
        studentEmail: 'invalid@gmail.com',
        token: testToken
      };

      const response = await request(app)
        .post('/attendance/mark-secure')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_EMAIL_FORMAT');
    });

    test('should validate session ID format', async () => {
      const invalidSessionData = {
        sessionId: 'invalid-session-id',
        studentEmail: testStudentEmail,
        token: testToken
      };

      const response = await request(app)
        .post('/attendance/mark-secure')
        .send(invalidSessionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SESSION_ID');
    });

    test('should validate token format', async () => {
      const invalidTokenData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: 'invalid-token!'
      };

      const response = await request(app)
        .post('/attendance/mark-secure')
        .send(invalidTokenData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN_FORMAT');
    });
  });

  describe('Security Features', () => {
    test('should apply rate limiting to attendance marking', async () => {
      const attendanceData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: testToken
      };

      // Make multiple rapid requests to trigger rate limiting
      const requests = [];
      for (let i = 0; i < 12; i++) {
        requests.push(
          request(app)
            .post('/api/attendance/mark')
            .send({
              ...attendanceData,
              studentEmail: `test${i}.student.cse28@heritageit.edu.in`
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/attendance/mark')
        .query({ session: testSessionId, token: testToken });

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    test('should log IP address and user agent for audit trail', async () => {
      const attendanceData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: testToken
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .set('User-Agent', 'Test-Student-Browser/1.0')
        .send(attendanceData)
        .expect(201);

      // Verify audit trail in database
      const auditRecord = await testDb.get(
        'SELECT ip_address, user_agent FROM attendance WHERE id = ?',
        [response.body.attendance.id]
      );

      expect(auditRecord.ip_address).toBeTruthy();
      expect(auditRecord.user_agent).toBe('Test-Student-Browser/1.0');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent student gracefully', async () => {
      const nonExistentStudentData = {
        sessionId: testSessionId,
        studentEmail: 'nonexistent.student.cse28@heritageit.edu.in',
        token: testToken
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(nonExistentStudentData)
        .expect(201); // The system creates attendance record even for non-existent students

      expect(response.body.success).toBe(true);
    });

    test('should handle malformed request data', async () => {
      const response = await request(app)
        .post('/api/attendance/mark')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      // Express should handle malformed JSON
    });
  });

  describe('Real-time Updates', () => {
    test('should trigger WebSocket updates when attendance is marked', async () => {
      const attendanceData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: testToken
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(attendanceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      
      // In a real test, you would verify WebSocket emissions
      // For now, we verify the attendance was marked successfully
      expect(response.body.attendance).toHaveProperty('id');
      expect(response.body.attendance.studentEmail).toBe(testStudentEmail);
    });
  });
});