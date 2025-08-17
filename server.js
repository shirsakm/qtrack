require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Import services and routes
const WebSocketService = require('./services/WebSocketService');
const facultyRoutes = require('./routes/faculty');
const attendanceRoutes = require('./routes/attendance');
const { router: authRoutes, passport } = require('./routes/auth');
const { 
  apiRateLimit, 
  facultyRateLimit,
  securityHeaders, 
  generateCsrfToken,
  sanitizeInput,
  csrfErrorHandler,
  suspiciousActivityDetection,
  securityLogger 
} = require('./middleware/security');
const { 
  globalErrorHandler, 
  notFoundHandler, 
  accessLogger 
} = require('./middleware/errorHandler');
const { enhancedSanitization } = require('./middleware/validation');

// Initialize WebSocket service
const webSocketService = new WebSocketService(io);

// Make io available to routes
app.set('io', io);
app.set('webSocketService', webSocketService);

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Access logging
app.use(accessLogger);

// Security middleware - applied globally
app.use(securityHeaders);
app.use(securityLogger);
app.use(suspiciousActivityDetection);
app.use(enhancedSanitization);

// Static files with security headers
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting for different endpoints
app.use('/api/faculty', facultyRateLimit);
app.use('/api/', apiRateLimit);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Flash messages for error handling
app.use(flash());

// CSRF token generation
app.use(generateCsrfToken);

// API Routes
app.use('/api/faculty', facultyRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/attendance', attendanceRoutes); // Student-facing attendance routes
app.use('/auth', authRoutes);

// CSRF error handler (must be after routes that use CSRF protection)
app.use(csrfErrorHandler);

// Basic route for testing
app.get('/', (req, res) => {
  res.send('QR Attendance System - Server Running');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeRooms: webSocketService.getActiveRooms()
  });
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
}

module.exports = { app, server, io };