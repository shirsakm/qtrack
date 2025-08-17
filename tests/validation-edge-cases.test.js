const request = require('supertest');
const { app } = require('../server');
const { ValidationSchema, validators, sanitizers } = require('../middleware/validation');
const { AppError } = require('../middleware/errorHandler');
const databaseService = require('../services/DatabaseService');

describe('Validation Edge Cases and Security Tests', () => {
  beforeAll(async () => {
    await databaseService.initialize();
  });

  afterAll(async () => {
    await databaseService.close();
  });

  describe('Input Sanitization', () => {
    test('should sanitize HTML/script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World';
      const sanitized = sanitizers.html(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Hello World');
    });

    test('should sanitize JavaScript URLs', () => {
      const maliciousInput = 'javascript:alert("xss")';
      const sanitized = sanitizers.html(maliciousInput);
      
      expect(sanitized).not.toContain('javascript:');
    });

    test('should sanitize event handlers', () => {
      const maliciousInput = 'onclick="alert(\'xss\')" onload="malicious()"';
      const sanitized = sanitizers.html(maliciousInput);
      
      expect(sanitized).not.toContain('onclick=');
      expect(sanitized).not.toContain('onload=');
    });

    test('should sanitize SQL injection patterns', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const sanitized = sanitizers.sql(maliciousInput);
      
      expect(sanitized).not.toContain('DROP TABLE');
      expect(sanitized).not.toContain('--');
    });

    test('should handle non-string inputs gracefully', () => {
      expect(sanitizers.html(null)).toBe(null);
      expect(sanitizers.html(undefined)).toBe(undefined);
      expect(sanitizers.html(123)).toBe(123);
      expect(sanitizers.html({})).toEqual({});
    });

    test('should trim whitespace correctly', () => {
      expect(sanitizers.trim('  hello world  ')).toBe('hello world');
      expect(sanitizers.trim('\t\n  test  \n\t')).toBe('test');
    });

    test('should convert to lowercase', () => {
      expect(sanitizers.lowercase('HELLO WORLD')).toBe('hello world');
      expect(sanitizers.lowercase('MiXeD cAsE')).toBe('mixed case');
    });

    test('should filter alphanumeric characters', () => {
      expect(sanitizers.alphanumeric('abc123!@#', '-_')).toBe('abc123');
      expect(sanitizers.alphanumeric('test-value_123', '-_')).toBe('test-value_123');
    });
  });

  describe('Complex Validation Scenarios', () => {
    test('should handle nested object validation', () => {
      const schema = new ValidationSchema({
        'user.email': {
          sanitizers: ['trim', 'lowercase'],
          validators: [
            (value, field) => validators.required(value, field),
            (value, field) => validators.email(value, field)
          ]
        },
        'user.name': {
          sanitizers: ['trim'],
          validators: [
            (value, field) => validators.required(value, field),
            (value, field) => validators.length(value, field, 2, 50)
          ]
        }
      });

      const data = {
        'user.email': '  JOHN.DOE.CSE28@HERITAGEIT.EDU.IN  ',
        'user.name': '  John Doe  '
      };

      const result = schema.validate(data);
      expect(result['user.email']).toBe('john.doe.cse28@heritageit.edu.in');
      expect(result['user.name']).toBe('John Doe');
    });

    test('should handle multiple validation errors', () => {
      const schema = new ValidationSchema({
        email: {
          validators: [
            (value, field) => validators.required(value, field),
            (value, field) => validators.email(value, field)
          ]
        },
        age: {
          validators: [
            (value, field) => validators.required(value, field),
            (value, field) => validators.number(value, field, 0, 120)
          ]
        }
      });

      const invalidData = {
        email: 'invalid-email',
        age: 'not-a-number'
      };

      expect(() => schema.validate(invalidData)).toThrow(AppError);
    });

    test('should handle custom validator functions', () => {
      const customValidator = (value, field) => {
        if (value !== 'expected-value') {
          throw new Error(`${field} must be 'expected-value'`);
        }
      };

      const schema = new ValidationSchema({
        customField: {
          validators: [customValidator]
        }
      });

      expect(() => schema.validate({ customField: 'wrong-value' })).toThrow();
      expect(() => schema.validate({ customField: 'expected-value' })).not.toThrow();
    });
  });

  describe('API Endpoint Edge Cases', () => {
    test('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/attendance/mark')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      // Should handle JSON parsing error gracefully
      expect(response.body.success).toBe(false);
    });

    test('should handle extremely large request bodies', async () => {
      const largeData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'john.doe.cse28@heritageit.edu.in',
        token: 'abcdef1234567890abcdef1234567890',
        extraData: 'x'.repeat(100000) // Very large string
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(largeData);

      // Should either accept or reject gracefully, not crash
      expect([200, 201, 400, 413]).toContain(response.status);
    });

    test('should handle Unicode characters in input', async () => {
      const unicodeData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'jöhn.döe.cse28@heritageit.edu.in', // Unicode characters
        token: 'abcdef1234567890abcdef1234567890'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(unicodeData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_EMAIL_FORMAT');
    });

    test('should handle array inputs where strings expected', async () => {
      const arrayData = {
        sessionId: ['123e4567-e89b-12d3-a456-426614174000'],
        studentEmail: ['john.doe.cse28@heritageit.edu.in'],
        token: ['abcdef1234567890abcdef1234567890']
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(arrayData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle object inputs where strings expected', async () => {
      const objectData = {
        sessionId: { id: '123e4567-e89b-12d3-a456-426614174000' },
        studentEmail: { email: 'john.doe.cse28@heritageit.edu.in' },
        token: { token: 'abcdef1234567890abcdef1234567890' }
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(objectData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Security Attack Patterns', () => {
    test('should handle SQL injection attempts', async () => {
      const sqlInjectionData = {
        sessionId: "'; DROP TABLE sessions; --",
        studentEmail: 'john.doe.cse28@heritageit.edu.in',
        token: 'abcdef1234567890abcdef1234567890'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(sqlInjectionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SESSION_ID');
    });

    test('should handle XSS attempts in various fields', async () => {
      const xssData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: '<script>alert("xss")</script>@heritageit.edu.in',
        token: 'abcdef1234567890abcdef1234567890'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(xssData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_EMAIL_FORMAT');
    });

    test('should handle path traversal attempts', async () => {
      const pathTraversalData = {
        sessionId: '../../../etc/passwd',
        studentEmail: 'john.doe.cse28@heritageit.edu.in',
        token: 'abcdef1234567890abcdef1234567890'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(pathTraversalData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SESSION_ID');
    });

    test('should handle command injection attempts', async () => {
      const commandInjectionData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'john.doe.cse28@heritageit.edu.in; cat /etc/passwd',
        token: 'abcdef1234567890abcdef1234567890'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(commandInjectionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_EMAIL_FORMAT');
    });
  });

  describe('Boundary Value Testing', () => {
    test('should handle minimum length inputs', async () => {
      const minData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'a.b.c01@heritageit.edu.in', // Minimum valid format
        token: 'a'.repeat(32) // Minimum token length
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(minData);

      // Should be valid format-wise (though may fail for other reasons)
      expect(response.status).not.toBe(400);
    });

    test('should handle maximum length inputs', async () => {
      const maxData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'verylongfirstname.verylonglastname.verylongbranch99@heritageit.edu.in',
        token: 'a'.repeat(100) // Very long token
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(maxData);

      // Should handle gracefully
      expect([200, 201, 400]).toContain(response.status);
    });

    test('should handle edge case email formats', async () => {
      const edgeCaseEmails = [
        'a.b.c01@heritageit.edu.in', // Minimum
        'firstname.lastname.branch99@heritageit.edu.in', // Maximum year
        'test.user.cse00@heritageit.edu.in', // Year 00
        'x.y.z99@heritageit.edu.in' // Single character names
      ];

      for (const email of edgeCaseEmails) {
        const data = {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          studentEmail: email,
          token: 'abcdef1234567890abcdef1234567890'
        };

        const response = await request(app)
          .post('/api/attendance/mark')
          .send(data);

        // Should not fail due to email format
        if (response.status === 400) {
          expect(response.body.error.code).not.toBe('INVALID_EMAIL_FORMAT');
        }
      }
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle multiple simultaneous validation requests', async () => {
      const validData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'john.doe.cse28@heritageit.edu.in',
        token: 'abcdef1234567890abcdef1234567890'
      };

      const requests = Array(10).fill().map(() =>
        request(app)
          .post('/api/attendance/mark')
          .send(validData)
      );

      const responses = await Promise.all(requests);

      // All should be handled without server errors
      responses.forEach(response => {
        expect(response.status).not.toBe(500);
      });
    });

    test('should handle mixed valid and invalid concurrent requests', async () => {
      const validData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'john.doe.cse28@heritageit.edu.in',
        token: 'abcdef1234567890abcdef1234567890'
      };

      const invalidData = {
        sessionId: 'invalid-uuid',
        studentEmail: 'invalid-email',
        token: 'short'
      };

      const requests = [
        ...Array(5).fill().map(() => request(app).post('/api/attendance/mark').send(validData)),
        ...Array(5).fill().map(() => request(app).post('/api/attendance/mark').send(invalidData))
      ];

      const responses = await Promise.all(requests);

      // Valid requests should not be affected by invalid ones
      const validResponses = responses.slice(0, 5);
      const invalidResponses = responses.slice(5);

      validResponses.forEach(response => {
        expect(response.status).not.toBe(500);
      });

      invalidResponses.forEach(response => {
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Error Recovery', () => {
    test('should recover from validation errors and continue processing', async () => {
      // Send invalid request
      const invalidData = {
        sessionId: 'invalid',
        studentEmail: 'invalid',
        token: 'invalid'
      };

      await request(app)
        .post('/api/attendance/mark')
        .send(invalidData)
        .expect(400);

      // Send valid request immediately after
      const validData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        studentEmail: 'john.doe.cse28@heritageit.edu.in',
        token: 'abcdef1234567890abcdef1234567890'
      };

      const response = await request(app)
        .post('/api/attendance/mark')
        .send(validData);

      // Should process normally, not affected by previous error
      expect(response.status).not.toBe(500);
    });
  });
});