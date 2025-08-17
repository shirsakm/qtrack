const request = require('supertest');
const { app } = require('../server');
const databaseService = require('../services/DatabaseService');

describe('Faculty Dashboard API Integration', () => {
  let testDb;
  let testFacultyId = 'integration-faculty-123';
  let testStudentEmail = 'shirsak.majumder.cse28@heritageit.edu.in';

  beforeAll(async () => {
    await databaseService.initialize();
    testDb = databaseService.getDatabase();
  });

  afterAll(async () => {
    await databaseService.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await testDb.run('DELETE FROM sessions WHERE faculty_id = ?', [testFacultyId]);
    await testDb.run('DELETE FROM attendance WHERE session_id IN (SELECT id FROM sessions WHERE faculty_id = ?)', [testFacultyId]);
  });

  test('complete faculty dashboard workflow', async () => {
    // 1. Start a session
    const sessionData = {
      facultyId: testFacultyId,
      courseName: 'Integration Test Course',
      courseCode: 'INT101',
      section: 'A'
    };

    const startResponse = await request(app)
      .post('/api/faculty/sessions/start')
      .send(sessionData)
      .expect(201);

    expect(startResponse.body.success).toBe(true);
    const sessionId = startResponse.body.session.id;
    const token = startResponse.body.qrData.token;

    // 2. Check session status
    const statusResponse = await request(app)
      .get(`/api/faculty/sessions/${sessionId}/status`)
      .query({ facultyId: testFacultyId })
      .expect(200);

    expect(statusResponse.body.success).toBe(true);
    expect(statusResponse.body.session.isActive).toBe(true);

    // 3. Mark attendance
    const attendanceResponse = await request(app)
      .post('/api/attendance/mark')
      .send({
        sessionId,
        studentEmail: testStudentEmail,
        token
      })
      .expect(201);

    expect(attendanceResponse.body.success).toBe(true);

    // 4. Get attendance data
    const attendanceDataResponse = await request(app)
      .get(`/api/faculty/sessions/${sessionId}/attendance`)
      .query({ facultyId: testFacultyId })
      .expect(200);

    expect(attendanceDataResponse.body.success).toBe(true);
    expect(attendanceDataResponse.body.attendance.present).toHaveLength(1);
    expect(attendanceDataResponse.body.attendance.present[0].studentEmail).toBe(testStudentEmail);

    // 5. Export attendance data
    const exportResponse = await request(app)
      .get(`/api/faculty/sessions/${sessionId}/export`)
      .query({ facultyId: testFacultyId })
      .expect(200);

    expect(exportResponse.body.sessionInfo.id).toBe(sessionId);
    expect(exportResponse.body.attendance.present).toHaveLength(1);
    expect(exportResponse.body.summary.presentCount).toBe(1);

    // 6. End session
    const endResponse = await request(app)
      .post(`/api/faculty/sessions/${sessionId}/end`)
      .send({ facultyId: testFacultyId })
      .expect(200);

    expect(endResponse.body.success).toBe(true);
    expect(endResponse.body.session.isActive).toBe(false);

    // 7. Verify session is ended
    const finalStatusResponse = await request(app)
      .get(`/api/faculty/sessions/${sessionId}/status`)
      .query({ facultyId: testFacultyId })
      .expect(200);

    expect(finalStatusResponse.body.session.isActive).toBe(false);
  });

  test('faculty session history workflow', async () => {
    // Create and end multiple sessions
    const sessions = [];
    
    for (let i = 1; i <= 3; i++) {
      const sessionData = {
        facultyId: testFacultyId,
        courseName: `Course ${i}`,
        courseCode: `TST10${i}`,
        section: 'A'
      };

      const startResponse = await request(app)
        .post('/api/faculty/sessions/start')
        .send(sessionData)
        .expect(201);

      sessions.push(startResponse.body.session.id);

      // End the session immediately
      await request(app)
        .post(`/api/faculty/sessions/${startResponse.body.session.id}/end`)
        .send({ facultyId: testFacultyId })
        .expect(200);
    }

    // Get all sessions
    const historyResponse = await request(app)
      .get(`/api/faculty/${testFacultyId}/sessions`)
      .expect(200);

    expect(historyResponse.body.success).toBe(true);
    expect(historyResponse.body.sessions).toHaveLength(3);

    // Get with limit
    const limitedResponse = await request(app)
      .get(`/api/faculty/${testFacultyId}/sessions`)
      .query({ limit: '2' })
      .expect(200);

    expect(limitedResponse.body.sessions).toHaveLength(2);

    // Get only active sessions (should be 0)
    const activeResponse = await request(app)
      .get(`/api/faculty/${testFacultyId}/sessions`)
      .query({ activeOnly: 'true' })
      .expect(200);

    expect(activeResponse.body.sessions).toHaveLength(0);
  });

  test('error handling workflow', async () => {
    // Try to get status of non-existent session
    await request(app)
      .get('/api/faculty/sessions/non-existent/status')
      .query({ facultyId: testFacultyId })
      .expect(404);

    // Try to mark attendance with invalid token
    await request(app)
      .post('/api/attendance/mark')
      .send({
        sessionId: 'non-existent',
        studentEmail: testStudentEmail,
        token: 'invalid-token'
      })
      .expect(400);

    // Try to end non-existent session
    await request(app)
      .post('/api/faculty/sessions/non-existent/end')
      .send({ facultyId: testFacultyId })
      .expect(400);
  });
});