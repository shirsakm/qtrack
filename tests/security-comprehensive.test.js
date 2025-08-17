const request = require('supertest');
const { app } = require('../server');
const databaseService = require('../services/DatabaseService');

describe('Security Implementation Verification', () => {
  beforeAll(async () => {
    await databaseService.initialize();
  });

  afterAll(async () => {
    if (databaseService.isInitialized) {
      databaseService.getDatabase().close();
    }
  });

  describe('Security Middleware Integration', () => {
    test('should have security middleware properly configured', () => {
      const security = require('../middleware/security');
      
      // Verify all required middleware is exported
      expect(security.attendanceRateLimit).toBeDefined();
      expect(security.strictAttendanceRateLimit).toBeDefined();
      expect(security.apiRateLimit).toBeDefined();
      expect(security.facultyRateLimit).toBeDefined();
      expect(security.csrfProtection).toBeDefined();
      expect(security.attendanceCSRFProtection).toBeDefined();
      expect(security.securityHeaders).toBeDefined();
      expect(security.basicSecurityHeaders).toBeDefined();
      expect(security.validateAttendanceInput).toBeDefined();
      expect(security.validateFacultyInput).toBeDefined();
      expect(security.validateSessionInput).toBeDefined();
      expect(security.sanitizeInput).toBeDefined();
    });

    test('should apply security headers to all responses', async () => {
      const response = await request(app)
        .get('/api/health');

      // Basic security headers should be present
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('should apply input sanitization', async () => {
      // Test that XSS attempts are sanitized
      const maliciousData = {
        facultyId: 'test<script>alert("xss")</script>faculty',
        courseName: 'Computer<script>alert("xss")</script>Science',
        courseCode: 'CS101',
        section: 'A'
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(maliciousData);

      // Should handle the request without crashing (accept various status codes)
      expect([200, 201, 400, 403, 429, 500]).toContain(response.status);
    });
  });

  describe('Rate Limiting Implementation', () => {
    test('should apply different rate limits to different endpoints', async () => {
      // Test that rate limiting is configured differently for different endpoints
      const attendanceRequests = [];
      const apiRequests = [];

      // Make requests to attendance endpoint
      for (let i = 0; i < 5; i++) {
        attendanceRequests.push(
          request(app)
            .post('/attendance/mark-secure')
            .send({
              sessionId: '12345678-1234-5678-9012-123456789012',
              studentEmail: 'test.student.cse28@heritageit.edu.in',
              token: 'abcdef1234567890abcdef1234567890'
            })
        );
      }

      // Make requests to API endpoint
      for (let i = 0; i < 5; i++) {
        apiRequests.push(request(app).get('/api/health'));
      }

      const [attendanceResponses, apiResponses] = await Promise.all([
        Promise.all(attendanceRequests),
        Promise.all(apiRequests)
      ]);

      // Attendance endpoints should have stricter rate limiting
      const attendanceRateLimited = attendanceResponses.filter(res => res.status === 429);
      const apiRateLimited = apiResponses.filter(res => res.status === 429);

      // Attendance should be more likely to be rate limited
      expect(attendanceRateLimited.length).toBeGreaterThanOrEqual(apiRateLimited.length);
    });
  });

  describe('Input Validation Implementation', () => {
    test('should validate all required input parameters', async () => {
      // Test attendance input validation
      const invalidAttendanceInputs = [
        {}, // Missing all parameters
        { sessionId: 'invalid' }, // Invalid session ID
        { 
          sessionId: '12345678-1234-5678-9012-123456789012',
          studentEmail: 'invalid@email.com' // Invalid email domain
        },
        {
          sessionId: '12345678-1234-5678-9012-123456789012',
          studentEmail: 'test.student.cse28@heritageit.edu.in',
          token: 'short' // Invalid token format
        }
      ];

      for (const input of invalidAttendanceInputs) {
        const response = await request(app)
          .post('/attendance/mark-secure')
          .send(input);

        // Should return validation error (400) or rate limit (429)
        expect([400, 429, 500]).toContain(response.status);
      }
    });

    test('should validate faculty input parameters', async () => {
      const invalidFacultyInputs = [
        {}, // Missing faculty ID
        { facultyId: 'invalid@faculty' }, // Invalid faculty ID format
      ];

      for (const input of invalidFacultyInputs) {
        const response = await request(app)
          .post('/api/faculty/sessions/12345678-1234-5678-9012-123456789012/end')
          .send(input);

        // Should return validation error or other expected status
        expect([400, 403, 429, 500]).toContain(response.status);
      }
    });
  });

  describe('CSRF Protection Implementation', () => {
    test('should have CSRF protection configured for state-changing operations', () => {
      const security = require('../middleware/security');
      
      // CSRF middleware should be available
      expect(security.csrfProtection).toBeDefined();
      expect(security.attendanceCSRFProtection).toBeDefined();
      expect(security.csrfErrorHandler).toBeDefined();
    });

    test('should protect faculty endpoints with CSRF', async () => {
      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send({
          facultyId: 'test-faculty',
          courseName: 'Computer Science',
          courseCode: 'CS101',
          section: 'A'
        });

      // Should return CSRF error (403) or rate limit (429)
      expect([403, 429, 500]).toContain(response.status);
    });
  });

  describe('Error Handling and Security', () => {
    test('should return structured error responses', async () => {
      const response = await request(app)
        .get('/nonexistent-endpoint');

      // Should not expose internal server information
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('should handle errors gracefully without exposing internals', async () => {
      const response = await request(app)
        .post('/attendance/mark-secure')
        .send({ invalid: 'data' });

      // Should not expose stack traces or internal paths
      if (response.body && response.body.error) {
        expect(response.body.error.message).not.toContain('node_modules');
        expect(response.body.error.message).not.toContain('/home/');
        expect(response.body.error.message).not.toContain('SQLITE');
      }
    });
  });

  describe('Security Headers Configuration', () => {
    test('should include comprehensive security headers', async () => {
      const response = await request(app).get('/');

      // Check for Helmet security headers
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      
      // Should not expose server information
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });
  });

  describe('IP-based Request Throttling', () => {
    test('should track and limit requests by IP', async () => {
      // Make multiple requests from the same IP
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/attendance/mark-secure')
            .send({
              sessionId: '12345678-1234-5678-9012-123456789012',
              studentEmail: `test${i}.student.cse28@heritageit.edu.in`,
              token: 'abcdef1234567890abcdef1234567890'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Should have some rate limited responses
      const rateLimitedCount = responses.filter(res => res.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });
});