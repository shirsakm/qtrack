const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const csrf = require('csurf');
const { AppError, securityLogger } = require('./errorHandler');

/**
 * Rate limiting middleware for attendance marking
 * Prevents abuse by limiting requests per IP
 */
const attendanceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many attendance attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests from rate limiting
  skipSuccessfulRequests: true,
  // Custom key generator to include session info
  keyGenerator: (req) => {
    const ip = req.ip || req.connection.remoteAddress;
    const sessionId = req.body.sessionId || req.query.session;
    return `${ip}:${sessionId}`;
  }
});

/**
 * Strict rate limiting for attendance marking endpoints
 * More restrictive to prevent proxy attendance
 */
const strictAttendanceRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each IP to 3 requests per 5 minutes
  message: {
    success: false,
    error: {
      code: 'STRICT_RATE_LIMIT_EXCEEDED',
      message: 'Too many attendance attempts from this IP. Please wait before trying again.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

/**
 * General API rate limiting
 */
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'API_RATE_LIMIT_EXCEEDED',
      message: 'Too many API requests. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Faculty API rate limiting - more permissive for authenticated faculty
 */
const facultyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for faculty operations
  message: {
    success: false,
    error: {
      code: 'FACULTY_RATE_LIMIT_EXCEEDED',
      message: 'Too many faculty API requests. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * CSRF protection middleware using csurf library
 * Provides robust CSRF protection for state-changing operations
 */
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
});

/**
 * CSRF error handler middleware
 */
const csrfErrorHandler = (err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    // Log security event
    securityLogger('CSRF_TOKEN_INVALID', { originalUrl: req.originalUrl })(req, res, () => {});
    
    const appError = new AppError('CSRF_TOKEN_INVALID');
    return res.status(appError.status).json(appError.toJSON());
  }
  next(err);
};

/**
 * Custom CSRF protection for attendance endpoints
 * Uses session token as CSRF protection for attendance marking
 */
const attendanceCSRFProtection = (req, res, next) => {
  // Skip CSRF for GET requests
  if (req.method === 'GET') {
    return next();
  }

  // For attendance marking, the session token serves as CSRF protection
  if (req.path.includes('/attendance/mark') && req.body.token) {
    return next();
  }

  // For other attendance endpoints, use standard CSRF
  return csrfProtection(req, res, next);
};

/**
 * Generate CSRF token for session
 */
const generateCsrfToken = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
  }
  next();
};

/**
 * Enhanced security headers middleware using Helmet
 */
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  // Prevent MIME type sniffing
  noSniff: true,
  // XSS Protection (deprecated but still supported)
  xssFilter: false, // Disabled as it's deprecated
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  // IE No Open
  ieNoOpen: true,
  // Permissions Policy (formerly Feature Policy)
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: ['self'],
    payment: [],
    usb: [],
    accelerometer: [],
    gyroscope: [],
    magnetometer: []
  }
});

/**
 * Basic security headers for API endpoints
 */
const basicSecurityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Hide server information
  res.removeHeader('X-Powered-By');
  
  next();
};

/**
 * Input validation middleware for attendance marking
 * @deprecated Use createValidationMiddleware('attendanceMarking') instead
 */
const validateAttendanceInput = (req, res, next) => {
  const { sessionId, studentEmail, token } = req.body;

  try {
    // Validate required fields
    if (!sessionId || !studentEmail || !token) {
      throw new AppError('MISSING_PARAMETERS');
    }

    // Validate sessionId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      throw new AppError('INVALID_SESSION_ID');
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z]+\.[a-zA-Z]+\.[a-zA-Z]+\d{2}@heritageit\.edu\.in$/;
    if (!emailRegex.test(studentEmail)) {
      throw new AppError('INVALID_EMAIL_FORMAT');
    }

    // Validate token format (should be alphanumeric)
    const tokenRegex = /^[a-zA-Z0-9]{32,}$/;
    if (!tokenRegex.test(token)) {
      throw new AppError('INVALID_TOKEN_FORMAT');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Input validation middleware for faculty session operations
 * @deprecated Use createValidationMiddleware('facultyOperation') instead
 */
const validateFacultyInput = (req, res, next) => {
  const { facultyId } = req.body;

  try {
    // Validate required faculty ID
    if (!facultyId) {
      throw new AppError('MISSING_PARAMETERS', 'Faculty ID is required');
    }

    // Validate faculty ID format (should be alphanumeric)
    const facultyIdRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    if (!facultyIdRegex.test(facultyId)) {
      throw new AppError('INVALID_FACULTY_ID');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Input validation middleware for session creation
 * @deprecated Use createValidationMiddleware('sessionCreation') instead
 */
const validateSessionInput = (req, res, next) => {
  const { facultyId, courseName, courseCode, section } = req.body;

  try {
    // Validate required fields
    if (!facultyId || !courseName || !courseCode || !section) {
      throw new AppError('MISSING_PARAMETERS', 'Missing required fields: facultyId, courseName, courseCode, section');
    }

    // Validate course name (alphanumeric with spaces, 3-100 chars)
    const courseNameRegex = /^[a-zA-Z0-9\s]{3,100}$/;
    if (!courseNameRegex.test(courseName)) {
      throw new AppError('INVALID_COURSE_NAME');
    }

    // Validate course code (alphanumeric with dashes/underscores, 2-20 chars)
    const courseCodeRegex = /^[a-zA-Z0-9_-]{2,20}$/;
    if (!courseCodeRegex.test(courseCode)) {
      throw new AppError('INVALID_COURSE_CODE');
    }

    // Validate section (alphanumeric, 1-10 chars)
    const sectionRegex = /^[a-zA-Z0-9]{1,10}$/;
    if (!sectionRegex.test(section)) {
      throw new AppError('INVALID_SECTION');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * General input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  // Sanitize string inputs to prevent XSS
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '')
              .replace(/data:text\/html/gi, '')
              .replace(/vbscript:/gi, '');
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    }
    return obj;
  };

  // Sanitize request body and query parameters
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Advanced IP tracking and suspicious activity detection
 */
const ipActivityTracker = new Map();

const suspiciousActivityDetection = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  if (!ipActivityTracker.has(ip)) {
    ipActivityTracker.set(ip, {
      requests: [],
      suspiciousCount: 0,
      lastSuspiciousActivity: 0
    });
  }
  
  const activity = ipActivityTracker.get(ip);
  
  // Clean old requests (older than window)
  activity.requests = activity.requests.filter(timestamp => now - timestamp < windowMs);
  
  // Add current request
  activity.requests.push(now);
  
  // Check for suspicious patterns
  const requestsInWindow = activity.requests.length;
  const isSuspicious = requestsInWindow > 20; // More than 20 requests per minute
  
  if (isSuspicious) {
    activity.suspiciousCount++;
    activity.lastSuspiciousActivity = now;
    
    // Log suspicious activity
    console.warn(`Suspicious activity detected from IP ${ip}: ${requestsInWindow} requests in 1 minute`);
    
    // If too many suspicious activities, block temporarily
    if (activity.suspiciousCount > 3 && now - activity.lastSuspiciousActivity < 5 * 60 * 1000) {
      // Log security event
      securityLogger('SUSPICIOUS_ACTIVITY_BLOCKED', { 
        ip, 
        requestsInWindow, 
        suspiciousCount: activity.suspiciousCount 
      })(req, res, () => {});
      
      const appError = new AppError('SUSPICIOUS_ACTIVITY_BLOCKED');
      return res.status(appError.status).json(appError.toJSON());
    }
  }
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours ago
    for (const [ip, data] of ipActivityTracker.entries()) {
      if (data.lastSuspiciousActivity < cutoff && data.requests.length === 0) {
        ipActivityTracker.delete(ip);
      }
    }
  }
  
  next();
};

/**
 * Enhanced request logging for security monitoring
 */
const securityRequestLogger = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const method = req.method;
  const url = req.originalUrl;
  const timestamp = new Date().toISOString();
  
  // Log security-relevant requests
  if (method !== 'GET' || url.includes('/attendance/') || url.includes('/api/')) {
    console.log(`[SECURITY] ${timestamp} - ${ip} - ${method} ${url} - ${userAgent}`);
  }
  
  // Check for common attack patterns
  const suspiciousPatterns = [
    /\.\.\//,  // Directory traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
    /eval\(/i, // Code injection
    /exec\(/i  // Command injection
  ];
  
  const requestString = JSON.stringify(req.body) + JSON.stringify(req.query) + url;
  const hasSuspiciousPattern = suspiciousPatterns.some(pattern => pattern.test(requestString));
  
  if (hasSuspiciousPattern) {
    console.warn(`[SECURITY ALERT] ${timestamp} - Suspicious pattern detected from ${ip}: ${method} ${url}`);
  }
  
  next();
};

module.exports = {
  attendanceRateLimit,
  strictAttendanceRateLimit,
  apiRateLimit,
  facultyRateLimit,
  csrfProtection,
  csrfErrorHandler,
  attendanceCSRFProtection,
  generateCsrfToken,
  securityHeaders,
  basicSecurityHeaders,
  validateAttendanceInput,
  validateFacultyInput,
  validateSessionInput,
  sanitizeInput,
  suspiciousActivityDetection,
  securityLogger: securityRequestLogger
};