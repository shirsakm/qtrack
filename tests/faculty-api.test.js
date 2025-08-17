const request = require('supertest');
const { app, server } = require('../server');
const databaseService = require('../services/DatabaseService');
const path = require('path');

describe('Faculty API Endpoints', () => {
  let testDb;
  let testSessionId;
  let testFacultyId = 'test-faculty-123';

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
  });

  afterEach(async () => {
    // Stop all QR rotations to prevent timers from running after tests
    const QRCodeService = require('../services/QRCodeService');
    const qrService = new QRCodeService();
    qrService.stopAllRotations();
  });

  describe('POST /api/faculty/sessions/start', () => {
    test('should start a new attendance session successfully', async () => {
      const sessionData = {
        facultyId: testFacultyId,
        courseName: 'Computer Science Fundamentals',
        courseCode: 'CSE101',
        section: 'A'
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.session).toHaveProperty('id');
      expect(response.body.session.courseName).toBe(sessionData.courseName);
      expect(response.body.session.courseCode).toBe(sessionData.courseCode);
      expect(response.body.session.section).toBe(sessionData.section);
      expect(response.body.session.isActive).toBe(true);
      expect(response.body.qrData).toHaveProperty('sessionId');
      expect(response.body.qrData).toHaveProperty('token');
      expect(response.body.qrData).toHaveProperty('qrCodeDataUrl');

      testSessionId = response.body.session.id;
    });

    test('should fail with missing required fields', async () => {
      const incompleteData = {
        facultyId: testFacultyId,
        courseName: 'Computer Science Fundamentals'
        // Missing courseCode and section
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('should fail when faculty already has an active session', async () => {
      const sessionData = {
        facultyId: testFacultyId,
        courseName: 'Computer Science Fundamentals',
        courseCode: 'CSE101',
        section: 'A'
      };

      // Start first session
      await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData)
        .expect(201);

      // Try to start second session
      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send({
          ...sessionData,
          courseName: 'Different Course',
          courseCode: 'CSE102'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already has an active session');
    });

    test('should validate course code format', async () => {
      const sessionData = {
        facultyId: testFacultyId,
        courseName: 'Computer Science Fundamentals',
        courseCode: 'invalid-code',
        section: 'A'
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Course code must be in format');
    });
  });

  describe('POST /api/faculty/sessions/:sessionId/end', () => {
    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        facultyId: testFacultyId,
        courseName: 'Test Course',
        courseCode: 'TST101',
        section: 'A'
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData);

      testSessionId = response.body.session.id;
    });

    test('should end an active session successfully', async () => {
      const response = await request(app)
        .post(`/api/faculty/sessions/${testSessionId}/end`)
        .send({ facultyId: testFacultyId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.session.isActive).toBe(false);
      expect(response.body.session).toHaveProperty('endTime');
      expect(response.body.message).toContain('ended successfully');
    });

    test('should fail with missing faculty ID', async () => {
      const response = await request(app)
        .post(`/api/faculty/sessions/${testSessionId}/end`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Faculty ID is required');
    });

    test('should fail with unauthorized faculty ID', async () => {
      const response = await request(app)
        .post(`/api/faculty/sessions/${testSessionId}/end`)
        .send({ facultyId: 'unauthorized-faculty' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
    });

    test('should fail with non-existent session ID', async () => {
      const response = await request(app)
        .post('/api/faculty/sessions/non-existent-id/end')
        .send({ facultyId: testFacultyId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Session not found');
    });
  });

  describe('GET /api/faculty/sessions/:sessionId/status', () => {
    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        facultyId: testFacultyId,
        courseName: 'Test Course',
        courseCode: 'TST101',
        section: 'A'
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData);

      testSessionId = response.body.session.id;
    });

    test('should get session status successfully', async () => {
      const response = await request(app)
        .get(`/api/faculty/sessions/${testSessionId}/status`)
        .query({ facultyId: testFacultyId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.session).toHaveProperty('id', testSessionId);
      expect(response.body.session).toHaveProperty('courseName');
      expect(response.body.session).toHaveProperty('isActive', true);
      expect(response.body.session).toHaveProperty('attendanceCount');
      expect(response.body).toHaveProperty('qrData');
    });

    test('should fail with missing faculty ID', async () => {
      const response = await request(app)
        .get(`/api/faculty/sessions/${testSessionId}/status`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Faculty ID is required');
    });

    test('should fail with unauthorized faculty ID', async () => {
      const response = await request(app)
        .get(`/api/faculty/sessions/${testSessionId}/status`)
        .query({ facultyId: 'unauthorized-faculty' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
    });
  });

  describe('GET /api/faculty/sessions/:sessionId/attendance', () => {
    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        facultyId: testFacultyId,
        courseName: 'Test Course',
        courseCode: 'TST101',
        section: 'A'
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData);

      testSessionId = response.body.session.id;
    });

    test('should get attendance data successfully', async () => {
      const response = await request(app)
        .get(`/api/faculty/sessions/${testSessionId}/attendance`)
        .query({ facultyId: testFacultyId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBe(testSessionId);
      expect(response.body.attendance).toHaveProperty('present');
      expect(response.body.attendance).toHaveProperty('summary');
      expect(response.body.attendance.summary).toHaveProperty('totalStudents');
      expect(response.body.attendance.summary).toHaveProperty('presentCount');
      expect(response.body.attendance.summary).toHaveProperty('absentCount');
      expect(response.body.attendance.summary).toHaveProperty('attendancePercentage');
    });

    test('should fail with missing faculty ID', async () => {
      const response = await request(app)
        .get(`/api/faculty/sessions/${testSessionId}/attendance`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Faculty ID is required');
    });
  });

  describe('GET /api/faculty/sessions/:sessionId/export', () => {
    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        facultyId: testFacultyId,
        courseName: 'Test Course',
        courseCode: 'TST101',
        section: 'A'
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData);

      testSessionId = response.body.session.id;
    });

    test('should export attendance data successfully', async () => {
      const response = await request(app)
        .get(`/api/faculty/sessions/${testSessionId}/export`)
        .query({ facultyId: testFacultyId })
        .expect(200);

      expect(response.body).toHaveProperty('sessionInfo');
      expect(response.body).toHaveProperty('attendance');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('exportedAt');

      expect(response.body.sessionInfo).toHaveProperty('id', testSessionId);
      expect(response.body.sessionInfo).toHaveProperty('courseName');
      expect(response.body.sessionInfo).toHaveProperty('courseCode');

      expect(response.body.attendance).toHaveProperty('present');
      expect(response.body.attendance).toHaveProperty('absent');

      expect(response.body.summary).toHaveProperty('totalStudents');
      expect(response.body.summary).toHaveProperty('presentCount');
      expect(response.body.summary).toHaveProperty('absentCount');
      expect(response.body.summary).toHaveProperty('attendancePercentage');

      // Check headers for file download
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should fail with missing faculty ID', async () => {
      const response = await request(app)
        .get(`/api/faculty/sessions/${testSessionId}/export`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Faculty ID is required');
    });
  });

  describe('GET /api/faculty/:facultyId/sessions', () => {
    beforeEach(async () => {
      // Create multiple test sessions
      const sessionData1 = {
        facultyId: testFacultyId,
        courseName: 'Course 1',
        courseCode: 'CSE101',
        section: 'A'
      };

      const response1 = await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData1);

      // End the first session so we can create a second one
      await request(app)
        .post(`/api/faculty/sessions/${response1.body.session.id}/end`)
        .send({ facultyId: testFacultyId });

      const sessionData2 = {
        facultyId: testFacultyId,
        courseName: 'Course 2',
        courseCode: 'CSE102',
        section: 'B'
      };

      const response2 = await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData2);

      // Leave the second session active for activeOnly test
    });

    test('should get all faculty sessions', async () => {
      const response = await request(app)
        .get(`/api/faculty/${testFacultyId}/sessions`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.sessions[0]).toHaveProperty('id');
      expect(response.body.sessions[0]).toHaveProperty('courseName');
      expect(response.body.sessions[0]).toHaveProperty('isActive');
    });

    test('should get only active sessions when activeOnly=true', async () => {
      const response = await request(app)
        .get(`/api/faculty/${testFacultyId}/sessions`)
        .query({ activeOnly: 'true' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0].isActive).toBe(true);
    });

    test('should limit results when limit parameter is provided', async () => {
      const response = await request(app)
        .get(`/api/faculty/${testFacultyId}/sessions`)
        .query({ limit: '1' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessions).toHaveLength(1);
    });
  });

  describe('POST /api/faculty/sessions/:sessionId/qr/rotate', () => {
    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        facultyId: testFacultyId,
        courseName: 'Test Course',
        courseCode: 'TST101',
        section: 'A'
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData);

      testSessionId = response.body.session.id;
    });

    test('should rotate QR code successfully', async () => {
      const response = await request(app)
        .post(`/api/faculty/sessions/${testSessionId}/qr/rotate`)
        .send({ facultyId: testFacultyId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.qrData).toHaveProperty('sessionId', testSessionId);
      expect(response.body.qrData).toHaveProperty('token');
      expect(response.body.qrData).toHaveProperty('qrCodeDataUrl');
    });

    test('should fail with missing faculty ID', async () => {
      const response = await request(app)
        .post(`/api/faculty/sessions/${testSessionId}/qr/rotate`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Faculty ID is required');
    });

    test('should fail with unauthorized faculty ID', async () => {
      const response = await request(app)
        .post(`/api/faculty/sessions/${testSessionId}/qr/rotate`)
        .send({ facultyId: 'unauthorized-faculty' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
    });
  });
});