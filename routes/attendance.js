const express = require('express');
const router = express.Router();
const databaseService = require('../services/DatabaseService');
const Attendance = require('../models/Attendance');
const SessionService = require('../services/SessionService');
const { requireAuth } = require('./auth');
const { 
  attendanceRateLimit,
  strictAttendanceRateLimit,
  validateAttendanceInput,
  attendanceCSRFProtection,
  basicSecurityHeaders 
} = require('../middleware/security');

// Initialize services (DatabaseService is a singleton)
let attendanceModel;
let sessionService;

// Initialize services when database is ready
const initializeServices = async () => {
  if (!databaseService.isInitialized) {
    await databaseService.initialize();
  }
  
  if (!attendanceModel) {
    attendanceModel = new Attendance(databaseService.getDatabase());
  }
  
  if (!sessionService) {
    sessionService = new SessionService(databaseService.getDatabase());
  }
};

/**
 * GET /attendance/mark
 * Landing page for QR code - initiates authentication flow
 */
router.get('/mark', async (req, res) => {
  try {
    await initializeServices();
    const { session: sessionId, token } = req.query;

    // Validate required parameters
    if (!sessionId || !token) {
      const errorUrl = `/attendance-error.html?code=MISSING_PARAMETERS&message=${encodeURIComponent('Invalid QR code or missing session information')}`;
      return res.redirect(errorUrl);
    }

    // Validate session and token
    const tokenValidation = await sessionService.validateAttendanceToken(sessionId, token);
    if (!tokenValidation.success) {
      const errorUrl = `/attendance-error.html?code=SESSION_EXPIRED&message=${encodeURIComponent('The attendance session has expired or the QR code is no longer valid')}&session=${sessionId}&token=${token}`;
      return res.redirect(errorUrl);
    }

    // Check if user is already authenticated
    if (req.isAuthenticated()) {
      // User is authenticated, proceed to mark attendance
      return res.redirect(`/attendance/submit?session=${sessionId}&token=${token}`);
    }

    // Store session info for after authentication
    req.session.pendingSessionId = sessionId;
    req.session.pendingToken = token;

    // Redirect to Google OAuth with session state
    res.redirect(`/auth/google?state=${sessionId}`);

  } catch (error) {
    console.error('Error in attendance landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

/**
 * GET /attendance/submit
 * Submit attendance after authentication (requires auth)
 */
router.get('/submit', requireAuth, async (req, res) => {
  try {
    await initializeServices();
    const { session: sessionId, token } = req.query;
    const studentEmail = req.user.email;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Use token from query or session
    const attendanceToken = token || req.session.pendingToken;
    
    // Clear pending session data
    delete req.session.pendingSessionId;
    delete req.session.pendingToken;

    // Validate required fields
    if (!sessionId || !attendanceToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing session ID or token'
        }
      });
    }

    // Validate session token
    const tokenValidation = await sessionService.validateAttendanceToken(sessionId, attendanceToken);
    if (!tokenValidation.success) {
      return res.status(400).json(tokenValidation);
    }

    // Check if student has already marked attendance
    const hasMarked = await attendanceModel.hasMarkedAttendance(sessionId, studentEmail);
    if (hasMarked) {
      const errorUrl = `/attendance-error.html?code=ALREADY_MARKED&message=${encodeURIComponent('You have already marked attendance for this session')}`;
      return res.redirect(errorUrl);
    }

    // Mark attendance
    const attendanceRecord = await attendanceModel.markAttendance(sessionId, studentEmail, {
      ipAddress,
      userAgent
    });

    // Get updated attendance summary for real-time updates
    const attendanceSummary = await attendanceModel.getSessionSummary(sessionId);

    // Get session info to find faculty ID for WebSocket broadcast
    const session = tokenValidation.session;
    const webSocketService = req.app.get('webSocketService');

    // Broadcast attendance update to faculty dashboard
    webSocketService.broadcastAttendanceUpdate(
      session.faculty_id,
      sessionId,
      {
        newAttendance: {
          studentEmail: attendanceRecord.student_email,
          studentName: attendanceRecord.student_name,
          timestamp: attendanceRecord.timestamp,
          ipAddress: attendanceRecord.ip_address
        },
        summary: attendanceSummary.summary
      }
    );

    // Redirect to success page with student details
    const successUrl = `/attendance-success.html?name=${encodeURIComponent(req.user.name)}&email=${encodeURIComponent(req.user.email)}&roll=${encodeURIComponent(req.user.rollNumber)}`;
    res.redirect(successUrl);

  } catch (error) {
    console.error('Error submitting attendance:', error);
    
    if (error.message.includes('already marked')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_MARKED',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

/**
 * POST /attendance/mark-secure
 * Enhanced security version of attendance marking with strict validation
 */
router.post('/mark-secure', basicSecurityHeaders, strictAttendanceRateLimit, attendanceCSRFProtection, validateAttendanceInput, async (req, res) => {
  try {
    await initializeServices();
    const { sessionId, studentEmail, token } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Validate session token
    const tokenValidation = await sessionService.validateAttendanceToken(sessionId, token);
    if (!tokenValidation.success) {
      return res.status(400).json(tokenValidation);
    }

    // Check if student has already marked attendance
    const hasMarked = await attendanceModel.hasMarkedAttendance(sessionId, studentEmail);
    if (hasMarked) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_MARKED',
          message: 'Attendance already marked for this session'
        }
      });
    }

    // Mark attendance
    const attendanceRecord = await attendanceModel.markAttendance(sessionId, studentEmail, {
      ipAddress,
      userAgent
    });

    // Get updated attendance summary for real-time updates
    const attendanceSummary = await attendanceModel.getSessionSummary(sessionId);

    // Get session info to find faculty ID for WebSocket broadcast
    const session = tokenValidation.session;
    const webSocketService = req.app.get('webSocketService');

    // Broadcast attendance update to faculty dashboard
    webSocketService.broadcastAttendanceUpdate(
      session.faculty_id,
      sessionId,
      {
        newAttendance: {
          studentEmail: attendanceRecord.student_email,
          studentName: attendanceRecord.student_name,
          timestamp: attendanceRecord.timestamp,
          ipAddress: attendanceRecord.ip_address
        },
        summary: attendanceSummary.summary
      }
    );

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      attendance: {
        id: attendanceRecord.id,
        sessionId: attendanceRecord.session_id,
        studentEmail: attendanceRecord.student_email,
        studentName: attendanceRecord.student_name,
        timestamp: attendanceRecord.timestamp
      }
    });

  } catch (error) {
    console.error('Error marking attendance:', error);
    
    if (error.message.includes('already marked')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_MARKED',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

/**
 * POST /api/attendance/mark
 * Mark attendance for a student (called when student scans QR and authenticates)
 */
router.post('/mark', basicSecurityHeaders, attendanceRateLimit, attendanceCSRFProtection, async (req, res) => {
  try {
    await initializeServices();
    const { sessionId, studentEmail, token } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Validate required fields
    if (!sessionId || !studentEmail || !token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, studentEmail, token'
      });
    }

    // Validate session token
    const tokenValidation = await sessionService.validateAttendanceToken(sessionId, token);
    if (!tokenValidation.success) {
      return res.status(400).json({
        success: false,
        error: tokenValidation.error
      });
    }

    // Check if student has already marked attendance
    const hasMarked = await attendanceModel.hasMarkedAttendance(sessionId, studentEmail);
    if (hasMarked) {
      return res.status(409).json({
        success: false,
        error: 'Attendance already marked for this session'
      });
    }

    // Mark attendance
    const attendanceRecord = await attendanceModel.markAttendance(sessionId, studentEmail, {
      ipAddress,
      userAgent
    });

    // Get updated attendance summary for real-time updates
    const attendanceSummary = await attendanceModel.getSessionSummary(sessionId);

    // Get session info to find faculty ID for WebSocket broadcast
    const session = tokenValidation.session;
    const webSocketService = req.app.get('webSocketService');

    // Broadcast attendance update to faculty dashboard
    webSocketService.broadcastAttendanceUpdate(
      session.faculty_id,
      sessionId,
      {
        newAttendance: {
          studentEmail: attendanceRecord.student_email,
          studentName: attendanceRecord.student_name,
          timestamp: attendanceRecord.timestamp,
          ipAddress: attendanceRecord.ip_address
        },
        summary: attendanceSummary.summary
      }
    );

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      attendance: {
        id: attendanceRecord.id,
        sessionId: attendanceRecord.session_id,
        studentEmail: attendanceRecord.student_email,
        studentName: attendanceRecord.student_name,
        timestamp: attendanceRecord.timestamp
      }
    });

  } catch (error) {
    console.error('Error marking attendance:', error);
    
    if (error.message.includes('already marked')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/attendance/session/:sessionId
 * Get attendance for a specific session (public endpoint for verification)
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    await initializeServices();
    const { sessionId } = req.params;
    const { token } = req.query;

    // Check if session exists
    const sessionExists = await sessionService.sessionExists(sessionId);
    if (!sessionExists) {
      return res.status(500).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Validate session token if provided
    if (token) {
      const tokenValidation = await sessionService.validateAttendanceToken(sessionId, token);
      if (!tokenValidation.success) {
        return res.status(400).json({
          success: false,
          error: tokenValidation.error
        });
      }
    }

    // Get attendance summary
    const attendanceSummary = await attendanceModel.getSessionSummary(sessionId);

    res.json({
      success: true,
      sessionId,
      attendance: {
        presentCount: attendanceSummary.summary.presentCount,
        totalStudents: attendanceSummary.summary.totalStudents,
        attendancePercentage: attendanceSummary.summary.attendancePercentage
      }
    });

  } catch (error) {
    console.error('Error getting session attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;