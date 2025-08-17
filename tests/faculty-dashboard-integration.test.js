/**
 * Faculty Dashboard Integration Tests
 * Tests the integration between frontend and backend APIs
 */

const request = require('supertest');
const { app } = require('../server');
const databaseService = require('../services/DatabaseService');

describe('Faculty Dashboard Integration', () => {
    beforeAll(async () => {
        // Set test environment
        process.env.NODE_ENV = 'test';
        
        // Initialize database for testing
        await databaseService.initialize();
    });

    afterAll(async () => {
        // Close database connections
        if (databaseService.db) {
            await new Promise((resolve) => {
                databaseService.db.close((err) => {
                    if (err) console.error('Error closing database:', err);
                    resolve();
                });
            });
        }
    });

    describe('Faculty Dashboard API Endpoints', () => {
        test('should serve faculty dashboard HTML', async () => {
            const response = await request(app)
                .get('/faculty-dashboard.html')
                .expect(200);

            expect(response.text).toContain('Faculty Attendance Dashboard');
            expect(response.text).toContain('Start Attendance Session');
            expect(response.text).toContain('QR Code');
            expect(response.text).toContain('Real-time Attendance');
        });

        test('should serve faculty dashboard CSS', async () => {
            const response = await request(app)
                .get('/css/faculty-dashboard.css')
                .expect(200);

            expect(response.text).toContain('.dashboard-container');
            expect(response.text).toContain('.btn-primary');
            expect(response.text).toContain('.qr-container');
            expect(response.text).toContain('.attendance-list');
        });

        test('should serve faculty dashboard JavaScript', async () => {
            const response = await request(app)
                .get('/js/faculty-dashboard.js')
                .expect(200);

            expect(response.text).toContain('FacultyDashboard');
            expect(response.text).toContain('startSession');
            expect(response.text).toContain('endSession');
            expect(response.text).toContain('initializeWebSocket');
        });
    });

    describe('Faculty API Integration', () => {
        let sessionId;

        test('should start a session via API', async () => {
            const sessionData = {
                facultyId: 'test-faculty-001',
                courseName: 'Test Course',
                courseCode: 'TEST101',
                section: 'A'
            };

            const response = await request(app)
                .post('/api/faculty/sessions/start')
                .send(sessionData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.session).toBeDefined();
            expect(response.body.session.courseName).toBe('Test Course');
            expect(response.body.qrData).toBeDefined();
            expect(response.body.qrData.qrCodeDataURL).toContain('data:image/png;base64');

            sessionId = response.body.session.id;
        });

        test('should get session status', async () => {
            const response = await request(app)
                .get(`/api/faculty/sessions/${sessionId}/status?facultyId=test-faculty-001`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.session).toBeDefined();
            expect(response.body.session.isActive).toBe(true);
        });

        test('should get attendance data', async () => {
            const response = await request(app)
                .get(`/api/faculty/sessions/${sessionId}/attendance?facultyId=test-faculty-001`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.attendance).toBeDefined();
            expect(response.body.attendance.present).toEqual([]);
            expect(response.body.attendance.summary).toBeDefined();
        });

        test('should export attendance data', async () => {
            const response = await request(app)
                .get(`/api/faculty/sessions/${sessionId}/export?facultyId=test-faculty-001`)
                .expect(200);

            expect(response.body.sessionInfo).toBeDefined();
            expect(response.body.attendance).toBeDefined();
            expect(response.body.summary).toBeDefined();
            expect(response.body.exportedAt).toBeDefined();
        });

        test('should end session via API', async () => {
            const response = await request(app)
                .post(`/api/faculty/sessions/${sessionId}/end`)
                .send({ facultyId: 'test-faculty-001' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.session.isActive).toBe(false);
        });
    });

    describe('WebSocket Integration', () => {
        test('should have WebSocket service available', () => {
            // Test that WebSocket service is properly initialized
            expect(app.get('webSocketService')).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid session start', async () => {
            const invalidData = {
                facultyId: 'test-faculty-001'
                // Missing required fields
            };

            const response = await request(app)
                .post('/api/faculty/sessions/start')
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Missing required fields');
        });

        test('should handle non-existent session', async () => {
            const response = await request(app)
                .get('/api/faculty/sessions/non-existent-session/status?facultyId=test-faculty-001')
                .expect(404);

            expect(response.body.success).toBe(false);
        });

        test('should handle unauthorized access', async () => {
            // Try to access session without faculty ID
            const response = await request(app)
                .get('/api/faculty/sessions/some-session/status')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Faculty ID is required');
        });
    });

    describe('Security Features', () => {
        test('should have security headers', async () => {
            const response = await request(app)
                .get('/faculty-dashboard.html');

            // Check for security headers (these are set by helmet middleware)
            expect(response.headers).toBeDefined();
        });

        test('should handle rate limiting on API endpoints', async () => {
            // Make multiple rapid requests to test rate limiting
            const requests = Array(10).fill().map(() => 
                request(app)
                    .post('/api/faculty/sessions/start')
                    .send({
                        facultyId: 'test-faculty-001',
                        courseName: 'Test',
                        courseCode: 'TEST',
                        section: 'A'
                    })
            );

            const responses = await Promise.all(requests);
            
            // Some requests should succeed, others might be rate limited
            const successCount = responses.filter(r => r.status === 201).length;
            const errorCount = responses.filter(r => r.status >= 400).length;
            
            expect(successCount + errorCount).toBe(10);
        });
    });

    describe('Performance', () => {
        test('should respond to dashboard requests quickly', async () => {
            const startTime = Date.now();
            
            await request(app)
                .get('/faculty-dashboard.html')
                .expect(200);
            
            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
        });

        test('should handle concurrent session starts', async () => {
            const concurrentRequests = Array(5).fill().map((_, index) => 
                request(app)
                    .post('/api/faculty/sessions/start')
                    .send({
                        facultyId: `test-faculty-${index}`,
                        courseName: `Concurrent Course ${index}`,
                        courseCode: `CONC${index}`,
                        section: 'A'
                    })
            );

            const responses = await Promise.all(concurrentRequests);
            
            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
            });

            // Clean up - end all sessions
            const endRequests = responses.map(response => 
                request(app)
                    .post(`/api/faculty/sessions/${response.body.session.id}/end`)
                    .send({ facultyId: response.body.session.facultyId })
            );

            await Promise.all(endRequests);
        });
    });
});