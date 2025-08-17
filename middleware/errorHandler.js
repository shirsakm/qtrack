const fs = require('fs').promises;
const path = require('path');

/**
 * Error codes and their corresponding HTTP status codes and user-friendly messages
 */
const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: {
    status: 401,
    message: 'Authentication required. Please log in to continue.',
    userMessage: 'You need to log in to access this feature.'
  },
  FORBIDDEN: {
    status: 403,
    message: 'Access denied. You do not have permission to perform this action.',
    userMessage: 'You don\'t have permission to access this resource.'
  },
  AUTH_FAILED: {
    status: 401,
    message: 'Authentication failed. Invalid credentials or session expired.',
    userMessage: 'Login failed. Please check your credentials and try again.'
  },
  INVALID_EMAIL_DOMAIN: {
    status: 400,
    message: 'Invalid email domain. Must be @heritageit.edu.in',
    userMessage: 'Please use your college email address ending with @heritageit.edu.in'
  },
  STUDENT_NOT_FOUND: {
    status: 404,
    message: 'Student not found in database.',
    userMessage: 'Your email is not registered. Please contact administration.'
  },

  // Session errors
  SESSION_NOT_FOUND: {
    status: 404,
    message: 'Attendance session not found.',
    userMessage: 'The attendance session could not be found. It may have been deleted.'
  },
  SESSION_EXPIRED: {
    status: 400,
    message: 'Attendance session has expired or is no longer active.',
    userMessage: 'This attendance session has ended. Please check with your instructor.'
  },
  SESSION_INACTIVE: {
    status: 400,
    message: 'Session is not active.',
    userMessage: 'This attendance session is not currently active.'
  },
  ACTIVE_SESSION_EXISTS: {
    status: 409,
    message: 'Faculty already has an active session.',
    userMessage: 'You already have an active attendance session. Please end it before starting a new one.'
  },
  SESSION_UNAUTHORIZED: {
    status: 403,
    message: 'Session does not belong to this faculty.',
    userMessage: 'You can only manage your own attendance sessions.'
  },

  // Token errors
  TOKEN_EXPIRED: {
    status: 400,
    message: 'QR code token has expired.',
    userMessage: 'This QR code has expired. Please scan the latest QR code displayed by your instructor.'
  },
  TOKEN_INVALID: {
    status: 400,
    message: 'Invalid or malformed token.',
    userMessage: 'The QR code is invalid. Please scan the current QR code from your instructor.'
  },
  CSRF_TOKEN_INVALID: {
    status: 403,
    message: 'Invalid CSRF token.',
    userMessage: 'Security token expired. Please refresh the page and try again.'
  },

  // Attendance errors
  ALREADY_MARKED: {
    status: 409,
    message: 'Attendance already marked for this session.',
    userMessage: 'You have already marked your attendance for this session.'
  },
  ATTENDANCE_WINDOW_CLOSED: {
    status: 400,
    message: 'Attendance marking window has closed.',
    userMessage: 'The time window for marking attendance has closed.'
  },

  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: {
    status: 429,
    message: 'Too many requests. Please try again later.',
    userMessage: 'You\'re making requests too quickly. Please wait a moment and try again.'
  },
  STRICT_RATE_LIMIT_EXCEEDED: {
    status: 429,
    message: 'Too many attendance attempts from this IP.',
    userMessage: 'Too many attendance attempts detected. Please wait before trying again.'
  },
  SUSPICIOUS_ACTIVITY_BLOCKED: {
    status: 429,
    message: 'Suspicious activity detected. Access temporarily blocked.',
    userMessage: 'Unusual activity detected. Your access has been temporarily restricted for security.'
  },

  // Validation errors
  MISSING_PARAMETERS: {
    status: 400,
    message: 'Required parameters are missing.',
    userMessage: 'Some required information is missing. Please check your input and try again.'
  },
  INVALID_INPUT: {
    status: 400,
    message: 'Invalid input format or value.',
    userMessage: 'The information you entered is not in the correct format. Please check and try again.'
  },
  INVALID_SESSION_ID: {
    status: 400,
    message: 'Invalid session ID format.',
    userMessage: 'The session identifier is invalid. Please scan a valid QR code.'
  },
  INVALID_EMAIL_FORMAT: {
    status: 400,
    message: 'Invalid email format.',
    userMessage: 'Please enter a valid email address in the format firstname.lastname.branchyear@heritageit.edu.in'
  },
  INVALID_TOKEN_FORMAT: {
    status: 400,
    message: 'Invalid token format.',
    userMessage: 'The QR code format is invalid. Please scan a valid QR code from your instructor.'
  },
  INVALID_FACULTY_ID: {
    status: 400,
    message: 'Invalid faculty ID format.',
    userMessage: 'The faculty identifier is invalid.'
  },
  INVALID_COURSE_NAME: {
    status: 400,
    message: 'Invalid course name format.',
    userMessage: 'Course name must be 3-100 characters long and contain only letters, numbers, and spaces.'
  },
  INVALID_COURSE_CODE: {
    status: 400,
    message: 'Invalid course code format.',
    userMessage: 'Course code must be 2-20 characters long and contain only letters, numbers, dashes, and underscores.'
  },
  INVALID_SECTION: {
    status: 400,
    message: 'Invalid section format.',
    userMessage: 'Section must be 1-10 characters long and contain only letters and numbers.'
  },

  // Database errors
  DATABASE_ERROR: {
    status: 500,
    message: 'Database operation failed.',
    userMessage: 'A database error occurred. Please try again later.'
  },
  DATABASE_CONNECTION_ERROR: {
    status: 503,
    message: 'Database connection failed.',
    userMessage: 'Unable to connect to the database. Please try again later.'
  },

  // General errors
  INTERNAL_ERROR: {
    status: 500,
    message: 'Internal server error.',
    userMessage: 'An unexpected error occurred. Please try again later.'
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: 'Service temporarily unavailable.',
    userMessage: 'The service is temporarily unavailable. Please try again later.'
  },
  NOT_FOUND: {
    status: 404,
    message: 'Resource not found.',
    userMessage: 'The requested resource could not be found.'
  },
  METHOD_NOT_ALLOWED: {
    status: 405,
    message: 'HTTP method not allowed.',
    userMessage: 'This action is not allowed.'
  }
};

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(code, details = null, originalError = null) {
    const errorInfo = ERROR_CODES[code] || ERROR_CODES.INTERNAL_ERROR;
    super(errorInfo.message);
    
    this.name = 'AppError';
    this.code = code;
    this.status = errorInfo.status;
    this.userMessage = errorInfo.userMessage;
    this.details = details;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, AppError);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.userMessage,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }

  toLogFormat() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      status: this.status,
      details: this.details,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : null,
      timestamp: this.timestamp
    };
  }
}

/**
 * Error logger class for structured logging
 */
class ErrorLogger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.errorLogFile = path.join(this.logDir, 'error.log');
    this.securityLogFile = path.join(this.logDir, 'security.log');
    this.accessLogFile = path.join(this.logDir, 'access.log');
    
    this.initializeLogDirectory();
  }

  async initializeLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  async logError(error, req = null, additionalInfo = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      error: error instanceof AppError ? error.toLogFormat() : {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      request: req ? {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user.id : null,
        sessionId: req.sessionID
      } : null,
      additionalInfo
    };

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('ERROR:', JSON.stringify(logEntry, null, 2));
    }

    // Log to file
    try {
      await fs.appendFile(this.errorLogFile, JSON.stringify(logEntry) + '\n');
    } catch (fileError) {
      console.error('Failed to write to error log file:', fileError);
    }
  }

  async logSecurity(event, req, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'SECURITY',
      event,
      request: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user.id : null,
        sessionId: req.sessionID
      },
      details
    };

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.warn('SECURITY:', JSON.stringify(logEntry, null, 2));
    }

    // Log to file
    try {
      await fs.appendFile(this.securityLogFile, JSON.stringify(logEntry) + '\n');
    } catch (fileError) {
      console.error('Failed to write to security log file:', fileError);
    }
  }

  async logAccess(req, res, responseTime) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ACCESS',
      request: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user.id : null,
        sessionId: req.sessionID
      },
      response: {
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length'),
        responseTime: responseTime
      }
    };

    // Only log to file for access logs (too verbose for console)
    try {
      await fs.appendFile(this.accessLogFile, JSON.stringify(logEntry) + '\n');
    } catch (fileError) {
      console.error('Failed to write to access log file:', fileError);
    }
  }
}

// Create singleton logger instance
const errorLogger = new ErrorLogger();

/**
 * Global error handling middleware
 */
const globalErrorHandler = async (err, req, res, next) => {
  // Log the error
  await errorLogger.logError(err, req);

  // Handle different types of errors
  if (err instanceof AppError) {
    return res.status(err.status).json(err.toJSON());
  }

  // Handle specific known errors
  if (err.name === 'ValidationError') {
    const appError = new AppError('INVALID_INPUT', err.message, err);
    return res.status(appError.status).json(appError.toJSON());
  }

  if (err.name === 'CastError') {
    const appError = new AppError('INVALID_INPUT', 'Invalid ID format', err);
    return res.status(appError.status).json(appError.toJSON());
  }

  if (err.code === 'EBADCSRFTOKEN') {
    const appError = new AppError('CSRF_TOKEN_INVALID', null, err);
    return res.status(appError.status).json(appError.toJSON());
  }

  // Handle database errors
  if (err.code === 'SQLITE_ERROR' || err.code === 'ENOTFOUND') {
    const appError = new AppError('DATABASE_ERROR', err.message, err);
    return res.status(appError.status).json(appError.toJSON());
  }

  // Default to internal server error
  const appError = new AppError('INTERNAL_ERROR', null, err);
  res.status(appError.status).json(appError.toJSON());
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res) => {
  const appError = new AppError('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`);
  res.status(appError.status).json(appError.toJSON());
};

/**
 * Access logging middleware
 */
const accessLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', async () => {
    const responseTime = Date.now() - startTime;
    await errorLogger.logAccess(req, res, responseTime);
  });
  
  next();
};

/**
 * Security event logger middleware
 */
const securityLogger = (event, details = {}) => {
  return async (req, res, next) => {
    await errorLogger.logSecurity(event, req, details);
    next();
  };
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error helper
 */
const createValidationError = (field, message) => {
  return new AppError('INVALID_INPUT', `${field}: ${message}`);
};

/**
 * Database error helper
 */
const handleDatabaseError = (error, operation = 'database operation') => {
  console.error(`Database error during ${operation}:`, error);
  
  if (error.code === 'SQLITE_CONSTRAINT') {
    return new AppError('INVALID_INPUT', 'Data constraint violation');
  }
  
  if (error.code === 'SQLITE_BUSY') {
    return new AppError('SERVICE_UNAVAILABLE', 'Database is busy, please try again');
  }
  
  return new AppError('DATABASE_ERROR', `Failed to perform ${operation}`);
};

module.exports = {
  AppError,
  ErrorLogger,
  ERROR_CODES,
  globalErrorHandler,
  notFoundHandler,
  accessLogger,
  securityLogger,
  asyncHandler,
  createValidationError,
  handleDatabaseError,
  errorLogger
};