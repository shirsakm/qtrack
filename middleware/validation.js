const { AppError, createValidationError } = require('./errorHandler');

/**
 * Validation schemas and rules
 */
const VALIDATION_RULES = {
  email: {
    pattern: /^[a-zA-Z]+\.[a-zA-Z]+\.[a-zA-Z]+\d{2}@heritageit\.edu\.in$/,
    message: 'Email must be in format firstname.lastname.branchyear@heritageit.edu.in'
  },
  sessionId: {
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    message: 'Session ID must be a valid UUID'
  },
  token: {
    pattern: /^[a-zA-Z0-9]{32,}$/,
    message: 'Token must be at least 32 alphanumeric characters'
  },
  facultyId: {
    pattern: /^[a-zA-Z0-9_-]{3,50}$/,
    message: 'Faculty ID must be 3-50 characters, alphanumeric with dashes/underscores'
  },
  courseName: {
    pattern: /^[a-zA-Z0-9\s]{3,100}$/,
    message: 'Course name must be 3-100 characters, alphanumeric with spaces'
  },
  courseCode: {
    pattern: /^[a-zA-Z0-9_-]{2,20}$/,
    message: 'Course code must be 2-20 characters, alphanumeric with dashes/underscores'
  },
  section: {
    pattern: /^[a-zA-Z0-9]{1,10}$/,
    message: 'Section must be 1-10 characters, alphanumeric'
  }
};

/**
 * Sanitization functions
 */
const sanitizers = {
  /**
   * Remove potentially dangerous HTML/script content
   */
  html: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/data:text\/html/gi, '')
      .replace(/vbscript:/gi, '');
  },

  /**
   * Remove SQL injection patterns
   */
  sql: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/('|(\\')|(;)|(\\)|(--)|(\s*(union|select|insert|update|delete|drop|create|alter|exec|execute)\s+))/gi, '');
  },

  /**
   * Trim whitespace and normalize
   */
  trim: (input) => {
    if (typeof input !== 'string') return input;
    return input.trim();
  },

  /**
   * Convert to lowercase
   */
  lowercase: (input) => {
    if (typeof input !== 'string') return input;
    return input.toLowerCase();
  },

  /**
   * Remove non-alphanumeric characters except specified
   */
  alphanumeric: (input, allowed = '') => {
    if (typeof input !== 'string') return input;
    const pattern = new RegExp(`[^a-zA-Z0-9${allowed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g');
    return input.replace(pattern, '');
  }
};

/**
 * Validation helper functions
 */
const validators = {
  /**
   * Check if value is required and not empty
   */
  required: (value, fieldName) => {
    if (value === undefined || value === null || value === '') {
      throw createValidationError(fieldName, 'is required');
    }
    return true;
  },

  /**
   * Check if string length is within bounds
   */
  length: (value, fieldName, min = 0, max = Infinity) => {
    if (typeof value !== 'string') {
      throw createValidationError(fieldName, 'must be a string');
    }
    if (value.length < min) {
      throw createValidationError(fieldName, `must be at least ${min} characters long`);
    }
    if (value.length > max) {
      throw createValidationError(fieldName, `must be no more than ${max} characters long`);
    }
    return true;
  },

  /**
   * Check if value matches a pattern
   */
  pattern: (value, fieldName, pattern, message) => {
    if (typeof value !== 'string') {
      throw createValidationError(fieldName, 'must be a string');
    }
    if (!pattern.test(value)) {
      throw createValidationError(fieldName, message || 'has invalid format');
    }
    return true;
  },

  /**
   * Check if value is a valid email
   */
  email: (value, fieldName) => {
    const rule = VALIDATION_RULES.email;
    return validators.pattern(value, fieldName, rule.pattern, rule.message);
  },

  /**
   * Check if value is a valid UUID
   */
  uuid: (value, fieldName) => {
    const rule = VALIDATION_RULES.sessionId;
    return validators.pattern(value, fieldName, rule.pattern, rule.message);
  },

  /**
   * Check if value is a valid token
   */
  token: (value, fieldName) => {
    const rule = VALIDATION_RULES.token;
    return validators.pattern(value, fieldName, rule.pattern, rule.message);
  },

  /**
   * Check if value is in allowed list
   */
  enum: (value, fieldName, allowedValues) => {
    if (!allowedValues.includes(value)) {
      throw createValidationError(fieldName, `must be one of: ${allowedValues.join(', ')}`);
    }
    return true;
  },

  /**
   * Check if value is a valid number within range
   */
  number: (value, fieldName, min = -Infinity, max = Infinity) => {
    const num = Number(value);
    if (isNaN(num)) {
      throw createValidationError(fieldName, 'must be a valid number');
    }
    if (num < min) {
      throw createValidationError(fieldName, `must be at least ${min}`);
    }
    if (num > max) {
      throw createValidationError(fieldName, `must be no more than ${max}`);
    }
    return true;
  },

  /**
   * Check if value is a valid boolean
   */
  boolean: (value, fieldName) => {
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
      throw createValidationError(fieldName, 'must be a boolean value');
    }
    return true;
  }
};

/**
 * Schema-based validation
 */
class ValidationSchema {
  constructor(schema) {
    this.schema = schema;
  }

  validate(data) {
    const errors = [];
    const sanitizedData = {};

    for (const [field, rules] of Object.entries(this.schema)) {
      let value = data[field];

      try {
        // Apply sanitizers first
        if (rules.sanitizers) {
          for (const sanitizer of rules.sanitizers) {
            if (typeof sanitizer === 'string' && sanitizers[sanitizer]) {
              value = sanitizers[sanitizer](value);
            } else if (typeof sanitizer === 'function') {
              value = sanitizer(value);
            }
          }
        }

        // Apply validators
        if (rules.validators) {
          for (const validator of rules.validators) {
            if (typeof validator === 'function') {
              validator(value, field);
            } else if (typeof validator === 'object') {
              const { type, ...params } = validator;
              if (validators[type]) {
                validators[type](value, field, ...Object.values(params));
              }
            }
          }
        }

        sanitizedData[field] = value;
      } catch (error) {
        if (error instanceof AppError) {
          errors.push(error);
        } else {
          errors.push(createValidationError(field, error.message));
        }
      }
    }

    if (errors.length > 0) {
      const combinedMessage = errors.map(e => e.details).join('; ');
      throw new AppError('INVALID_INPUT', combinedMessage);
    }

    return sanitizedData;
  }
}

/**
 * Pre-defined validation schemas
 */
const schemas = {
  attendanceMarking: new ValidationSchema({
    sessionId: {
      sanitizers: ['trim'],
      validators: [
        (value, field) => validators.required(value, field),
        (value, field) => validators.uuid(value, field)
      ]
    },
    studentEmail: {
      sanitizers: ['trim', 'lowercase'],
      validators: [
        (value, field) => validators.required(value, field),
        (value, field) => validators.email(value, field)
      ]
    },
    token: {
      sanitizers: ['trim'],
      validators: [
        (value, field) => validators.required(value, field),
        (value, field) => validators.token(value, field)
      ]
    }
  }),

  sessionCreation: new ValidationSchema({
    facultyId: {
      sanitizers: ['trim'],
      validators: [
        (value, field) => validators.required(value, field),
        (value, field) => validators.pattern(value, field, VALIDATION_RULES.facultyId.pattern, VALIDATION_RULES.facultyId.message)
      ]
    },
    courseName: {
      sanitizers: ['trim'],
      validators: [
        (value, field) => validators.required(value, field),
        (value, field) => validators.pattern(value, field, VALIDATION_RULES.courseName.pattern, VALIDATION_RULES.courseName.message)
      ]
    },
    courseCode: {
      sanitizers: ['trim'],
      validators: [
        (value, field) => validators.required(value, field),
        (value, field) => validators.pattern(value, field, VALIDATION_RULES.courseCode.pattern, VALIDATION_RULES.courseCode.message)
      ]
    },
    section: {
      sanitizers: ['trim'],
      validators: [
        (value, field) => validators.required(value, field),
        (value, field) => validators.pattern(value, field, VALIDATION_RULES.section.pattern, VALIDATION_RULES.section.message)
      ]
    }
  }),

  facultyOperation: new ValidationSchema({
    facultyId: {
      sanitizers: ['trim'],
      validators: [
        (value, field) => validators.required(value, field),
        (value, field) => validators.pattern(value, field, VALIDATION_RULES.facultyId.pattern, VALIDATION_RULES.facultyId.message)
      ]
    }
  }),

  sessionQuery: new ValidationSchema({
    sessionId: {
      sanitizers: ['trim'],
      validators: [
        (value, field) => validators.required(value, field),
        (value, field) => validators.uuid(value, field)
      ]
    },
    facultyId: {
      sanitizers: ['trim'],
      validators: [
        (value, field) => validators.required(value, field),
        (value, field) => validators.pattern(value, field, VALIDATION_RULES.facultyId.pattern, VALIDATION_RULES.facultyId.message)
      ]
    }
  })
};

/**
 * Middleware factory for validation
 */
const createValidationMiddleware = (schemaName, source = 'body') => {
  return (req, res, next) => {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        throw new AppError('INTERNAL_ERROR', `Validation schema '${schemaName}' not found`);
      }

      const data = source === 'query' ? req.query : req.body;
      const validatedData = schema.validate(data);

      // Replace the original data with validated and sanitized data
      if (source === 'query') {
        req.query = { ...req.query, ...validatedData };
      } else {
        req.body = { ...req.body, ...validatedData };
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Enhanced input sanitization middleware
 */
const enhancedSanitization = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          // Apply multiple sanitization layers
          obj[key] = sanitizers.html(obj[key]);
          obj[key] = sanitizers.sql(obj[key]);
          obj[key] = sanitizers.trim(obj[key]);
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    }
    return obj;
  };

  // Sanitize request body and query parameters
  if (req.body) {
    req.body = sanitizeObject({ ...req.body });
  }
  if (req.query) {
    req.query = sanitizeObject({ ...req.query });
  }
  if (req.params) {
    req.params = sanitizeObject({ ...req.params });
  }

  next();
};

/**
 * File upload validation
 */
const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];
    
    for (const file of files) {
      // Check file size
      if (file.size > maxSize) {
        throw new AppError('INVALID_INPUT', `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`);
      }

      // Check file type
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        throw new AppError('INVALID_INPUT', `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      }

      // Check for potentially dangerous file names
      if (/[<>:"/\\|?*]/.test(file.originalname)) {
        throw new AppError('INVALID_INPUT', 'File name contains invalid characters');
      }
    }

    next();
  };
};

module.exports = {
  ValidationSchema,
  validators,
  sanitizers,
  schemas,
  createValidationMiddleware,
  enhancedSanitization,
  validateFileUpload,
  VALIDATION_RULES
};