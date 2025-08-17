const request = require('supertest');
const { app } = require('../server');
const { AppError, errorLogger } = require('../middleware/errorHandler');
const { ValidationSchema, validators } = require('../middleware/validation');
const databaseService = require('../services/DatabaseService');

describe('Error Handling and Validation System', () => {
  beforeAll(async () => {
    // Initialize database for testing
    await databaseService.initialize();
  });

  afterAll(async () => {
    // Clean up database connection
    await databaseService.close();
  });

  describe('AppError Class', () => {
    test('should create AppError with correct properties', () => {
      const error = new AppError('UNAUTHORIZED', 'Additional details');
      
      expect(error.name).toBe('AppError');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.status).toBe(401);
      expect(error.userMessage).toBe('You need to log in to access this feature.');
      expect(error.details).toBe('Additional details');
      expect(error.timestamp).toBeDefined();
    });

    test('should convert to JSON format correctly', () => {
      const error = new AppError('SESSION_NOT_FOUND');
      const json = error.toJSON();
      
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('SESSION_NOT_FOUND');
      expect(json.error.message).toBe('The attendance session could not be found. It may have been deleted.');
      expect(json.error.timestamp).toBeDefined();
    });

    test('should handle unknown error codes', () => {
      const error = new AppError('UNKNOWN_ERROR');
      
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.status).toBe(500);
      expect(error.userMessage).toBe('An unexpected error occurred. Please try again later.');
    });
  });

  describe('Validation System', () => {
    describe('Validators', () => {
      test('should validate required fields', () => {
        expect(() => validators.required('test', 'field')).not.toThrow();
        expect(() => validators.required('', 'field')).toThrow();
        expect(() => validators.required(null, 'field')).toThrow();
        expect(() => validators.required(undefined, 'field')).toThrow();
      });

      test('should validate string length', () => {
        expect(() => validators.length('test', 'field', 2, 10)).not.toThrow();
        expect(() => validators.length('a', 'field', 2, 10)).toThrow();
        expect(() => validators.length('very long string', 'field', 2, 10)).toThrow();
      });

      test('should validate email format', () => {
        expect(() => validators.email('john.doe.cse28@heritageit.edu.in', 'email')).not.toThrow();
        expect(() => validators.email('invalid@email.com', 'email')).toThrow();
        expect(() => validators.email('john.doe@heritageit.edu.in', 'email')).toThrow();
      });

      test('should validate UUID format', () => {
        const validUuid = '123e4567-e89b-12d3-a456-426614174000';
        const invalidUuid = 'not-a-uuid';
        
        expect(() => validators.uuid(validUuid, 'sessionId')).not.toThrow();
        expect(() => validators.uuid(invalidUuid, 'sessionId')).toThrow();
      });

      test('should validate token format', () => {
        const validToken = 'abcdef1234567890abcdef1234567890';
        const invalidToken = 'short';
        
        expect(() => validators.token(validToken, 'token')).not.toThrow();
        expect(() => validators.token(invalidToken, 'token')).toThrow();
      });

      test('should validate enum values', () => {
        const allowedValues = ['A', 'B', 'C'];
        
        expect(() => validators.enum('A', 'section', allowedValues)).not.toThrow();
        expect(() => validators.enum('D', 'section', allowedValues)).toThrow();
      });

      test('should validate numbers', () => {
        expect(() => validators.number('10', 'count', 0, 100)).not.toThrow();
        expect(() => validators.number('150', 'count', 0, 100)).toThrow();
        expect(() => validators.number('not-a-number', 'count')).toThrow();
      });
    });

    describe('ValidationSchema', () => {
      test('should validate and sanitize data according to schema', () => {
        const schema = new ValidationSchema({
          email: {
            sanitizers: ['trim', 'lowercase'],
            validators: [
              (value, field) => validators.required(value, field),
              (value, field) => validators.email(value, field)
            ]
          },
          name: {
            sanitizers: ['trim'],
            validators: [
              (value, field) => validators.required(value, field),
              (value, field) => validators.length(value, field, 2, 50)
            ]
          }
        });

        const validData = {
          email: '  JOHN.DOE.CSE28@HERITAGEIT.EDU.IN  ',
          name: '  John Doe  '
        };

        const result = schema.validate(validData);
        
        expect(result.email).toBe('john.doe.cse28@heritageit.edu.in');
        expect(result.name).toBe('John Doe');
      });

      test('should throw validation errors for invalid data', () => {
        const schema = new ValidationSchema({
          email: {
            validators: [
              (value, field) => validators.required(value, field),
              (value, field) => validators.email(value, field)
            ]
          }
        });

        const invalidData = {
          email: 'invalid-email'
        };

        expect(() => schema.validate(invalidData)).toThrow(AppError);
      });
    });
  });

  describe('API Error Handling', () => {
    test('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('requested resource could not be found');
    });

    test('should handle validation errors in faculty session creation', async () => {
      const invalidSessionData = {
        facultyId: '', // Empty faculty ID
        courseName: 'Test Course',
        courseCode: 'TC101',
        section: 'A'
      };

      const response = await request(app)
        .post('/api/faculty/sessions/start')
        .send(invalidSessionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    test('should handle missing parameters in attendance marking', async () => {
      const incompleteData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000'
        // Missing studentEmail and token
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });

    test('should handle invalid email format in attendance marking', async () => {
      const invalidData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'invalid@email.com',
        token: 'abcdef1234567890abcdef1234567890'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_EMAIL_FORMAT');
    });

    test('should handle invalid session ID format', async () => {
      const invalidData = {
        sessionId: 'not-a-valid-uuid',
        studentEmail: 'john.doe.cse28@heritageit.edu.in',
        token: 'abcdef1234567890abcdef1234567890'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SESSION_ID');
    });

    test('should handle invalid token format', async () => {
      const invalidData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'john.doe.cse28@heritageit.edu.in',
        token: 'short' // Too short
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN_FORMAT');
    });
  });

  describe('Rate Limiting Error Handling', () => {
    test('should handle rate limit exceeded', async () => {
      const validData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'john.doe.cse28@heritageit.edu.in',
        token: 'abcdef1234567890abcdef1234567890'
      };

      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(15).fill().map(() => 
        request(app)
          .post('/api/attendance/mark')
          .send(validData)
      );

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited
      const rateLimitedResponse = responses.find(res => res.status === 429);
      expect(rateLimitedResponse).toBeDefined();
      
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body.success).toBe(false);
        expect(rateLimitedResponse.body.error.code).toContain('RATE_LIMIT');
      }
    }, 10000); // Increase timeout for this test
  });

  describe('Security Error Handling', () => {
    test('should handle CSRF token errors', async () => {
      // This test would need to be implemented based on your CSRF setup
      // For now, we'll test that the error handler exists
      expect(typeof require('../middleware/errorHandler').globalErrorHandler).toBe('function');
    });

    test('should sanitize malicious input', async () => {
      const maliciousData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'john.doe.cse28@heritageit.edu.in<script>alert("xss")</script>',
        token: 'abcdef1234567890abcdef1234567890'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(maliciousData);

      // The malicious script should be sanitized out
      // The exact behavior depends on your sanitization implementation
      expect(response.status).not.toBe(500); // Should not cause server error
    });
  });

  describe('Database Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // This would require mocking database failures
      // For now, we'll test that the error handler exists
      const { handleDatabaseError } = require('../middleware/errorHandler');
      
      const mockError = { code: 'SQLITE_BUSY', message: 'Database is busy' };
      const appError = handleDatabaseError(mockError, 'test operation');
      
      expect(appError).toBeInstanceOf(AppError);
      expect(appError.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('Error Logging', () => {
    test('should log errors with proper format', async () => {
      const error = new AppError('TEST_ERROR', 'Test details');
      const logFormat = error.toLogFormat();
      
      expect(logFormat.name).toBe('AppError');
      expect(logFormat.code).toBe('TEST_ERROR');
      expect(logFormat.message).toBeDefined();
      expect(logFormat.userMessage).toBeDefined();
      expect(logFormat.status).toBeDefined();
      expect(logFormat.timestamp).toBeDefined();
    });

    test('should handle error logger initialization', () => {
      expect(errorLogger).toBeDefined();
      expect(typeof errorLogger.logError).toBe('function');
      expect(typeof errorLogger.logSecurity).toBe('function');
      expect(typeof errorLogger.logAccess).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/attendance/mark')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });

    test('should handle null values in request', async () => {
      const nullData = {
        sessionId: null,
        studentEmail: null,
        token: null
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(nullData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });

    test('should handle very long input strings', async () => {
      const longString = 'a'.repeat(1000);
      const longData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: `${longString}@heritageit.edu.in`,
        token: 'abcdef1234567890abcdef1234567890'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(longData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_EMAIL_FORMAT');
    });

    test('should handle special characters in input', async () => {
      const specialData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'john.doe.cse28@heritageit.edu.in',
        token: 'abcdef1234567890!@#$%^&*()'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(specialData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN_FORMAT');
    });
  });

  describe('User-Friendly Error Messages', () => {
    test('should provide user-friendly messages for common errors', () => {
      const errors = [
        { code: 'UNAUTHORIZED', expectedMessage: 'You need to log in to access this feature.' },
        { code: 'SESSION_EXPIRED', expectedMessage: 'This attendance session has ended. Please check with your instructor.' },
        { code: 'ALREADY_MARKED', expectedMessage: 'You have already marked your attendance for this session.' },
        { code: 'INVALID_EMAIL_FORMAT', expectedMessage: 'Please enter a valid email address in the format firstname.lastname.branchyear@heritageit.edu.in' }
      ];

      errors.forEach(({ code, expectedMessage }) => {
        const error = new AppError(code);
        expect(error.userMessage).toBe(expectedMessage);
      });
    });
  });
});