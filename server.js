require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const flash = require('connect-flash');
const SQLiteStore = require('connect-sqlite3')(session);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Trust the first proxy (e.g., Render/Heroku/Nginx) so req.ip and req.secure are correct
// This is required for express-rate-limit and secure cookies behind HTTPS terminators
app.set('trust proxy', process.env.TRUST_PROXY ? parseInt(process.env.TRUST_PROXY, 10) : 1);

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
  saveUninitialized: true, // Changed to true for CSRF to work
  // Honor X-Forwarded-* headers when setting secure cookies behind a proxy
  proxy: true,
  store: new SQLiteStore({
    // Store sessions in a file under config/ to persist during runtime
    dir: process.env.SESSION_DIR || path.join(__dirname, 'config'),
    db: process.env.SESSION_DB || 'sessions.sqlite',
    // TTL in ms (defaults ~1 day). Keep aligned with cookie maxAge
    ttl: 24 * 60 * 60 * 1000
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax' // Allow same-site requests
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Flash messages for error handling
app.use(flash());

// CSRF token generation
app.use(generateCsrfToken);

// Add CSRF token to all responses
app.use((req, res, next) => {
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// QR Code attendance route (must be before other routes)
app.get('/attend/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { token } = req.query;
  
  // Redirect to attendance marking route with session and token
  res.redirect(`/attendance/mark?session=${sessionId}&token=${token}`);
});

// API Routes
app.use('/api/faculty', facultyRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/attendance', attendanceRoutes); // Student-facing attendance routes
app.use('/auth', authRoutes);

// CSRF error handler (must be after routes that use CSRF protection)
app.use(csrfErrorHandler);

// Basic route for testing
app.get('/', (req, res) => {
  res.send(`
    <h1>🎯 QR Attendance System</h1>
    <p><strong>Status:</strong> Server Running</p>
    <p><strong>Environment:</strong> ${process.env.NODE_ENV}</p>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    <h2>Available Endpoints:</h2>
    <ul>
      <li><a href="/faculty-dashboard.html">Faculty Dashboard</a></li>
      <li><a href="/api/health">Health Check</a></li>
      <li><a href="/api/csrf-token">CSRF Token</a></li>
    </ul>
    <h2>API Routes:</h2>
    <ul>
      <li>POST /api/faculty/sessions/start</li>
      <li>POST /api/faculty/sessions/:id/end</li>
      <li>GET /api/faculty/sessions/:id/status</li>
      <li>POST /api/attendance/mark</li>
      <li>GET /auth/google</li>
    </ul>
  `);
});

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  // Prevent caching to avoid stale tokens
  res.set('Cache-Control', 'no-store');
  // Also surface in a response header for debugging/tools
  res.set('X-CSRF-Token', req.session.csrfToken || '');
  res.json({ 
    csrfToken: req.session.csrfToken,
    success: true 
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const databaseService = require('./services/DatabaseService');
    const dbHealth = await databaseService.healthCheck();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      activeRooms: webSocketService.getActiveRooms(),
      environment: process.env.NODE_ENV,
      routes: {
        faculty: 'Available',
        attendance: 'Available',
        auth: 'Available'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Import database service for cleanup
    const databaseService = require('./services/DatabaseService');
    
    // Initialize database if not already done
    if (!databaseService.isInitialized) {
      await databaseService.initialize();
    }
    
    // Close all active sessions
    console.log('Closing all active sessions...');
    const db = databaseService.getDatabase();
    const result = await db.run(`
      UPDATE sessions 
      SET is_active = 0, end_time = datetime('now') 
      WHERE is_active = 1
    `);
    
    console.log(`Closed ${result.changes} active session(s)`);
    
    // Close database connection
    if (databaseService.isInitialized) {
      databaseService.close();
      console.log('Database connection closed');
    }
    
    // Close server
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.log('Force exiting...');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Initialize database on startup
async function initializeApp() {
  try {
    const databaseService = require('./services/DatabaseService');
    await databaseService.initialize();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializeApp().then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log('Press Ctrl+C to stop the server gracefully');
    });
  }).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = { app, server, io };