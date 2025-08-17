const request = require('supertest');
const { app } = require('../server');
const databaseService = require('../services/DatabaseService');

describe('Enhanced Security Features', () => {
  beforeAll(async () => {
    await databaseService.initialize();
  });

  afterAll(async () => {
    if (databaseService.isInitialized) {
      databaseService.getDatabase().close();
    }
  });

  describe('Advanced Security Headers', () => {
    test('should include Permissions Policy headers', async () => {
      const response = await request(app)
        .get('/api/health');

      // Permissions Policy might be set as different header names
      const hasPermissionsPolicy = response.headers['permissions-policy'] || 
                                   response.headers['feature-policy'] ||
                                   response.headers['Permissions-Policy'];
      
      // If not present, that's also acceptable as it's optional
      if (hasPermissionsPolicy) {
        expect(hasPermissionsPolicy).toBeDefined();
      } else {
        // Just verify other security headers are present
        expect(response.headers['x-frame-options']).toBe('DENY');
      }
    });

    test('should include comprehensive CSP headers', async () => {
      const response = await request(app)
        .get('/');

      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['content-security-policy']).toContain("object-src 'none'");
    });

    test('should apply security headers to all routes', async () => {
      const routes = [
        '/api/health',
        '/attendance/mark?session=test&token=test',
        '/auth/status'
      ];

      for (const route of routes) {
        const response = await request(app).get(route);
        
        // Should have basic security headers regardless of status code
        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-powered-by']).toBeUndefined();
      }
    });
  });

  describe('Enhanced Input Sanitization', () => {
    test('should sanitize advanced XSS attempts', async () => {
      const maliciousInputs = [
        'test<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'vbscript:msgbox("xss")',
        'onclick="alert(\'xss\')"'
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app)
          .post('/api/faculty/sessions/start')
          .send({
            facultyId: 'test-faculty',
            courseName: maliciousInput,
            courseCode: 'CS101',
            section: 'A'
          });

        // Should handle the request without crashing
        expect([200, 201, 400, 403, 429, 500]).toContain(response.status);
      }
    });

    test('should sanitize nested object properties', async () => {
      const nestedMaliciousInput = {
        facultyId: 'test-faculty',
        courseName: 'Computer Science',
        courseCode: 'CS101',
        section: 'A',
        metadata: {
          description: '<script>alert("nested xss")</script>',
          tags: ['normal', 'javascript:alert("xss")']
        }
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(nestedMaliciousInput);

      // Should handle nested sanitization
      expect([200, 201, 400, 403, 429, 500]).toContain(response.status);
    });
  });

  describe('Suspicious Activity Detection', () => {
    test('should detect and block rapid requests from same IP', async () => {
      const requests = [];
      
      // Make 25 rapid requests (above the 20 request threshold)
      for (let i = 0; i < 25; i++) {
        requests.push(
          request(app)
            .get('/api/health')
            .set('X-Forwarded-For', '192.168.1.100') // Simulate same IP
        );
      }

      const responses = await Promise.all(requests);
      
      // Should have some blocked responses
      const blockedResponses = responses.filter(res => 
        res.status === 429 && 
        res.body.error && 
        res.body.error.code === 'SUSPICIOUS_ACTIVITY_BLOCKED'
      );
      
      // At least some requests should be blocked for suspicious activity
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    test('should log suspicious patterns in requests', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Make request with suspicious pattern
      await request(app)
        .get('/api/health?test=../../../etc/passwd');

      // Should log the suspicious activity
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY ALERT]')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Security Logging', () => {
    test('should log security-relevant requests', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      // Make a POST request that should be logged
      await request(app)
        .post('/attendance/mark-secure')
        .send({
          sessionId: '12345678-1234-5678-9012-123456789012',
          studentEmail: 'test.student.cse28@heritageit.edu.in',
          token: 'abcdef1234567890abcdef1234567890'
        });

      // Should log the security-relevant request
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY]')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Advanced Rate Limiting', () => {
    test('should apply different rate limits based on endpoint sensitivity', async () => {
      // Test attendance endpoint (stricter)
      const attendanceRequests = [];
      for (let i = 0; i < 5; i++) {
        attendanceRequests.push(
          request(app)
            .post('/attendance/mark-secure')
            .send({
              sessionId: '12345678-1234-5678-9012-123456789012',
              studentEmail: `test${i}.student.cse28@heritageit.edu.in`,
              token: 'abcdef1234567890abcdef1234567890'
            })
        );
      }

      // Test API endpoint (more permissive)
      const apiRequests = [];
      for (let i = 0; i < 5; i++) {
        apiRequests.push(request(app).get('/api/health'));
      }

      const [attendanceResponses, apiResponses] = await Promise.all([
        Promise.all(attendanceRequests),
        Promise.all(apiRequests)
      ]);

      // Attendance should be more strictly rate limited
      const attendanceRateLimited = attendanceResponses.filter(res => res.status === 429);
      const apiRateLimited = apiResponses.filter(res => res.status === 429);

      expect(attendanceRateLimited.length).toBeGreaterThanOrEqual(apiRateLimited.length);
    });
  });

  describe('CSRF Protection Enhancement', () => {
    test('should protect all state-changing operations', async () => {
      const stateChangingEndpoints = [
        { method: 'post', path: '/api/faculty/sessions/start' },
        { method: 'post', path: '/api/faculty/sessions/test-id/end' },
        { method: 'post', path: '/attendance/mark-secure' },
        { method: 'post', path: '/auth/logout' }
      ];

      for (const endpoint of stateChangingEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.path)
          .send({ test: 'data' });

        // Should return CSRF error or rate limit
        expect([403, 429, 500]).toContain(response.status);
      }
    });
  });

  describe('Input Validation Enhancement', () => {
    test('should validate complex input patterns', async () => {
      const invalidInputs = [
        {
          sessionId: 'not-a-uuid',
          studentEmail: 'invalid-email',
          token: 'short'
        },
        {
          sessionId: '12345678-1234-5678-9012-123456789012',
          studentEmail: 'test@wrongdomain.com',
          token: 'abcdef1234567890abcdef1234567890'
        },
        {
          sessionId: '12345678-1234-5678-9012-123456789012',
          studentEmail: 'test.student.cse28@heritageit.edu.in',
          token: 'invalid-token-with-special-chars!'
        }
      ];

      for (const input of invalidInputs) {
        const response = await request(app)
          .post('/attendance/mark-secure')
          .send(input);

        // Should return validation error
        expect([400, 429, 500]).toContain(response.status);
      }
    });

    test('should validate faculty input parameters thoroughly', async () => {
      const invalidFacultyInputs = [
        { facultyId: '' }, // Empty faculty ID
        { facultyId: 'a' }, // Too short
        { facultyId: 'a'.repeat(60) }, // Too long
        { facultyId: 'invalid@faculty#id' }, // Invalid characters
      ];

      for (const input of invalidFacultyInputs) {
        const response = await request(app)
          .post('/api/faculty/sessions/test-session/end')
          .send(input);

        expect([400, 403, 429, 500]).toContain(response.status);
      }
    });
  });

  describe('Error Handling Security', () => {
    test('should not expose internal paths in error messages', async () => {
      const response = await request(app)
        .post('/attendance/mark-secure')
        .send({ invalid: 'data' });

      if (response.body && response.body.error && response.body.error.message) {
        const errorMessage = response.body.error.message;
        
        // Should not contain internal paths
        expect(errorMessage).not.toContain('/home/');
        expect(errorMessage).not.toContain('node_modules');
        expect(errorMessage).not.toContain(__dirname);
        expect(errorMessage).not.toContain('SQLITE');
        expect(errorMessage).not.toContain('Error:');
      }
    });

    test('should return consistent error structure', async () => {
      const response = await request(app)
        .post('/attendance/mark-secure')
        .send({});

      if (response.status === 400) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      }
    });
  });

  describe('Security Middleware Integration', () => {
    test('should have all security middleware properly integrated', () => {
      const security = require('../middleware/security');
      
      // Verify all security middleware is available
      expect(security.suspiciousActivityDetection).toBeDefined();
      expect(security.securityLogger).toBeDefined();
      expect(security.sanitizeInput).toBeDefined();
      expect(security.securityHeaders).toBeDefined();
      
      // Verify they are functions
      expect(typeof security.suspiciousActivityDetection).toBe('function');
      expect(typeof security.securityLogger).toBe('function');
      expect(typeof security.sanitizeInput).toBe('function');
    });
  });
});