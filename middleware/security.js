const rateLimit = require('express-rate-limit');

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
 * CSRF protection middleware
 * Simple token-based CSRF protection for state-changing operations
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET requests and API endpoints with valid session tokens
  if (req.method === 'GET' || req.path.startsWith('/api/attendance/session/')) {
    return next();
  }

  // For attendance marking, the session token serves as CSRF protection
  if (req.path.includes('/attendance/mark') && req.body.token) {
    return next();
  }

  // For other POST requests, check for CSRF token in headers
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionCsrf = req.session.csrfToken;

  if (!csrfToken || !sessionCsrf || csrfToken !== sessionCsrf) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'Invalid CSRF token'
      }
    });
  }

  next();
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
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

/**
 * Input validation middleware
 */
const validateAttendanceInput = (req, res, next) => {
  const { sessionId, studentEmail, token } = req.body;

  // Validate required fields
  if (!sessionId || !studentEmail || !token) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Missing required fields: sessionId, studentEmail, token'
      }
    });
  }

  // Validate sessionId format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_SESSION_ID',
        message: 'Invalid session ID format'
      }
    });
  }

  // Validate email format
  const emailRegex = /^[a-zA-Z]+\.[a-zA-Z]+\.[a-zA-Z]+\d{2}@heritageit\.edu\.in$/;
  if (!emailRegex.test(studentEmail)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_EMAIL_FORMAT',
        message: 'Invalid email format. Must be firstname.lastname.branchyear@heritageit.edu.in'
      }
    });
  }

  // Validate token format (should be alphanumeric)
  const tokenRegex = /^[a-zA-Z0-9]{32,}$/;
  if (!tokenRegex.test(token)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN_FORMAT',
        message: 'Invalid token format'
      }
    });
  }

  next();
};

module.exports = {
  attendanceRateLimit,
  apiRateLimit,
  csrfProtection,
  generateCsrfToken,
  securityHeaders,
  validateAttendanceInput
};