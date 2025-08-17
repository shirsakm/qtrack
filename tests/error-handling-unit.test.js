const { AppError, handleDatabaseError, createValidationError } = require('../middleware/errorHandler');
const { ValidationSchema, validators, sanitizers } = require('../middleware/validation');

describe('Error Handling Unit Tests', () => {
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

    test('should include original error in log format', () => {
      const originalError = new Error('Original error message');
      const error = new AppError('INTERNAL_ERROR', 'Details', originalError);
      const logFormat = error.toLogFormat();
      
      expect(logFormat.originalError).toBeDefined();
      expect(logFormat.originalError.message).toBe('Original error message');
    });
  });

  describe('Database Error Handling', () => {
    test('should handle SQLite constraint errors', () => {
      const sqliteError = { code: 'SQLITE_CONSTRAINT', message: 'UNIQUE constraint failed' };
      const appError = handleDatabaseError(sqliteError, 'insert operation');
      
      expect(appError).toBeInstanceOf(AppError);
      expect(appError.code).toBe('INVALID_INPUT');
      expect(appError.userMessage).toContain('not in the correct format');
    });

    test('should handle SQLite busy errors', () => {
      const sqliteError = { code: 'SQLITE_BUSY', message: 'Database is locked' };
      const appError = handleDatabaseError(sqliteError, 'query operation');
      
      expect(appError).toBeInstanceOf(AppError);
      expect(appError.code).toBe('SERVICE_UNAVAILABLE');
      expect(appError.userMessage).toContain('temporarily unavailable');
    });

    test('should handle generic database errors', () => {
      const genericError = { code: 'UNKNOWN_DB_ERROR', message: 'Unknown error' };
      const appError = handleDatabaseError(genericError, 'database operation');
      
      expect(appError).toBeInstanceOf(AppError);
      expect(appError.code).toBe('DATABASE_ERROR');
      expect(appError.userMessage).toContain('database error occurred');
    });
  });

  describe('Validation Error Creation', () => {
    test('should create validation error with field and message', () => {
      const error = createValidationError('email', 'must be a valid email address');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.details).toBe('email: must be a valid email address');
    });
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

  describe('Validation Functions', () => {
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

    test('should validate boolean values', () => {
      expect(() => validators.boolean(true, 'flag')).not.toThrow();
      expect(() => validators.boolean('true', 'flag')).not.toThrow();
      expect(() => validators.boolean('false', 'flag')).not.toThrow();
      expect(() => validators.boolean('invalid', 'flag')).toThrow();
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

    test('should apply custom sanitizers', () => {
      const customSanitizer = (value) => value.replace(/[^a-zA-Z]/g, '');
      
      const schema = new ValidationSchema({
        text: {
          sanitizers: [customSanitizer],
          validators: [
            (value, field) => validators.required(value, field)
          ]
        }
      });

      const data = { text: 'Hello123World!' };
      const result = schema.validate(data);
      
      expect(result.text).toBe('HelloWorld');
    });

    test('should handle empty schema', () => {
      const schema = new ValidationSchema({});
      const result = schema.validate({ anyField: 'anyValue' });
      
      expect(result).toEqual({});
    });

    test('should handle missing fields in data', () => {
      const schema = new ValidationSchema({
        requiredField: {
          validators: [
            (value, field) => validators.required(value, field)
          ]
        }
      });

      expect(() => schema.validate({})).toThrow(AppError);
    });
  });

  describe('Error Message Consistency', () => {
    test('should provide consistent user-friendly messages', () => {
      const errorCodes = [
        'UNAUTHORIZED',
        'SESSION_EXPIRED', 
        'ALREADY_MARKED',
        'INVALID_EMAIL_FORMAT',
        'TOKEN_EXPIRED',
        'RATE_LIMIT_EXCEEDED'
      ];

      errorCodes.forEach(code => {
        const error = new AppError(code);
        expect(error.userMessage).toBeDefined();
        expect(error.userMessage.length).toBeGreaterThan(10);
        expect(error.userMessage).not.toContain('undefined');
        expect(error.userMessage).not.toContain('null');
      });
    });

    test('should have appropriate HTTP status codes', () => {
      const statusMappings = [
        { code: 'UNAUTHORIZED', expectedStatus: 401 },
        { code: 'FORBIDDEN', expectedStatus: 403 },
        { code: 'NOT_FOUND', expectedStatus: 404 },
        { code: 'ALREADY_MARKED', expectedStatus: 409 },
        { code: 'RATE_LIMIT_EXCEEDED', expectedStatus: 429 },
        { code: 'INTERNAL_ERROR', expectedStatus: 500 }
      ];

      statusMappings.forEach(({ code, expectedStatus }) => {
        const error = new AppError(code);
        expect(error.status).toBe(expectedStatus);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle circular references in error details', () => {
      const circularObj = { a: 1 };
      circularObj.self = circularObj;
      
      const error = new AppError('INTERNAL_ERROR', circularObj);
      
      // Should not throw when converting to JSON
      expect(() => error.toJSON()).not.toThrow();
    });

    test('should handle very long error messages', () => {
      const longMessage = 'x'.repeat(10000);
      const error = new AppError('INTERNAL_ERROR', longMessage);
      
      expect(error.details).toBe(longMessage);
      expect(() => error.toJSON()).not.toThrow();
    });

    test('should handle special characters in error details', () => {
      const specialChars = '!@#$%^&*()[]{}|;:,.<>?';
      const error = new AppError('INTERNAL_ERROR', specialChars);
      
      expect(error.details).toBe(specialChars);
      expect(() => error.toJSON()).not.toThrow();
    });

    test('should handle null and undefined in validation', () => {
      expect(() => validators.required(null, 'field')).toThrow();
      expect(() => validators.required(undefined, 'field')).toThrow();
      expect(() => validators.length(null, 'field')).toThrow();
      expect(() => validators.email(null, 'field')).toThrow();
    });

    test('should handle empty strings in validation', () => {
      expect(() => validators.required('', 'field')).toThrow();
      expect(() => validators.length('', 'field', 1)).toThrow();
      expect(() => validators.email('', 'field')).toThrow();
    });
  });
});