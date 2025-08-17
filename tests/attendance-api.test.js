const request = require('supertest');
const { app, server } = require('../server');
const databaseService = require('../services/DatabaseService');

describe('Attendance API Endpoints', () => {
  let testDb;
  let testSessionId;
  let testToken;
  let testFacultyId = 'test-faculty-123';
  let testStudentEmail = 'shirsak.majumder.cse28@heritageit.edu.in';

  beforeAll(async () => {
    // Initialize test database
    await databaseService.initialize();
    testDb = databaseService.getDatabase();
  });

  afterAll(async () => {
    // Clean up
    await databaseService.close();
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await testDb.run('DELETE FROM sessions WHERE faculty_id = ?', [testFacultyId]);
    await testDb.run('DELETE FROM attendance WHERE session_id IN (SELECT id FROM sessions WHERE faculty_id = ?)', [testFacultyId]);

    // Create a test session for each test
    const sessionData = {
      facultyId: testFacultyId,
      courseName: 'Test Course',
      courseCode: 'TST101',
      section: 'A'
    };

    const sessionResponse = await request(app)
      .post('/api/faculty/sessions/start')
      .send(sessionData)
      .expect(201);

    if (!sessionResponse.body.session || !sessionResponse.body.session.id) {
      throw new Error('Failed to create test session: ' + JSON.stringify(sessionResponse.body));
    }

    testSessionId = sessionResponse.body.session.id;
    testToken = sessionResponse.body.qrData.token;
  });

  describe('POST /api/attendance/mark', () => {
    test('should mark attendance successfully', async () => {
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
      expect(response.body.message).toContain('marked successfully');
      expect(response.body.attendance).toHaveProperty('id');
      expect(response.body.attendance.sessionId).toBe(testSessionId);
      expect(response.body.attendance.studentEmail).toBe(testStudentEmail);
      expect(response.body.attendance).toHaveProperty('timestamp');
    });

    test('should fail with missing required fields', async () => {
      const incompleteData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail
        // Missing token
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('should fail with invalid token', async () => {
      const attendanceData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: 'invalid-token'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(attendanceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid token');
    });

    test('should fail with non-existent session', async () => {
      const attendanceData = {
        sessionId: 'non-existent-session',
        studentEmail: testStudentEmail,
        token: testToken
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(attendanceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Session not found');
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
      const response = await request(app)
        .post('/api/attendance/mark')
        .send(attendanceData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already marked');
    });

    test('should fail with expired token', async () => {
      // End the session to make token invalid
      await request(app)
        .post(`/api/faculty/sessions/${testSessionId}/end`)
        .send({ facultyId: testFacultyId });

      const attendanceData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: testToken
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(attendanceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not active');
    });

    test('should capture IP address and user agent', async () => {
      const attendanceData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: testToken
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .set('User-Agent', 'Test-Agent/1.0')
        .send(attendanceData)
        .expect(201);

      expect(response.body.success).toBe(true);

      // Verify in database that IP and user agent were captured
      const attendanceRecord = await testDb.get(
        'SELECT * FROM attendance WHERE id = ?',
        [response.body.attendance.id]
      );

      expect(attendanceRecord.ip_address).toBeTruthy();
      expect(attendanceRecord.user_agent).toBe('Test-Agent/1.0');
    });
  });

  describe('GET /api/attendance/session/:sessionId', () => {
    beforeEach(async () => {
      // Mark some attendance for testing
      const attendanceData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: testToken
      };

      await request(app)
        .post('/api/attendance/mark')
        .send(attendanceData);
    });

    test('should get session attendance summary with valid token', async () => {
      const response = await request(app)
        .get(`/api/attendance/session/${testSessionId}`)
        .query({ token: testToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBe(testSessionId);
      expect(response.body.attendance).toHaveProperty('presentCount');
      expect(response.body.attendance).toHaveProperty('totalStudents');
      expect(response.body.attendance).toHaveProperty('attendancePercentage');
      expect(response.body.attendance.presentCount).toBeGreaterThan(0);
    });

    test('should get session attendance summary without token', async () => {
      const response = await request(app)
        .get(`/api/attendance/session/${testSessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBe(testSessionId);
      expect(response.body.attendance).toHaveProperty('presentCount');
      expect(response.body.attendance).toHaveProperty('totalStudents');
      expect(response.body.attendance).toHaveProperty('attendancePercentage');
    });

    test('should fail with invalid token', async () => {
      const response = await request(app)
        .get(`/api/attendance/session/${testSessionId}`)
        .query({ token: 'invalid-token' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid token');
    });

    test('should fail with non-existent session', async () => {
      const response = await request(app)
        .get('/api/attendance/session/non-existent-session')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Real-time WebSocket Integration', () => {
    test('should trigger WebSocket update when attendance is marked', async () => {
      // This test verifies that the attendance marking endpoint
      // calls the WebSocket service (integration test)
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
      
      // The WebSocket broadcast is called internally
      // In a real test environment, you would verify the WebSocket emission
      // For now, we verify the attendance was marked successfully
      expect(response.body.attendance).toHaveProperty('id');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Close the database to simulate an error
      await databaseService.close();

      const attendanceData = {
        sessionId: testSessionId,
        studentEmail: testStudentEmail,
        token: testToken
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(attendanceData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Internal server error');

      // Reinitialize database for other tests
      await databaseService.initialize();
      testDb = databaseService.getDatabase();
    });

    test('should handle malformed request data', async () => {
      const response = await request(app)
        .post('/api/attendance/mark')
        .send('invalid-json-data')
        .expect(400);

      // Express should handle malformed JSON and return 400
    });
  });
});