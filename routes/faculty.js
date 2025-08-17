const express = require('express');
const router = express.Router();
const SessionService = require('../services/SessionService');
const databaseService = require('../services/DatabaseService');
const Attendance = require('../models/Attendance');
const { 
  csrfProtection, 
  validateFacultyInput, 
  validateSessionInput,
  basicSecurityHeaders 
} = require('../middleware/security');

// Initialize services (DatabaseService is a singleton)
let sessionService;
let attendanceModel;

// Initialize services when database is ready
const initializeServices = async () => {
  if (!databaseService.isInitialized) {
    await databaseService.initialize();
  }
  
  if (!sessionService) {
    sessionService = new SessionService(databaseService.getDatabase());
  }
  
  if (!attendanceModel) {
    attendanceModel = new Attendance(databaseService.getDatabase());
  }
};

/**
 * POST /api/faculty/sessions/start
 * Start a new attendance session
 */
router.post('/sessions/start', basicSecurityHeaders, csrfProtection, validateSessionInput, async (req, res) => {
  try {
    await initializeServices();
    const { facultyId, courseName, courseCode, section } = req.body;

    // Validate required fields
    if (!facultyId || !courseName || !courseCode || !section) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: facultyId, courseName, courseCode, section'
      });
    }

    // Start the session
    const result = await sessionService.startSession({
      facultyId,
      courseName,
      courseCode,
      section
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Start QR rotation with WebSocket callback
    const qrUpdateCallback = (sessionId, qrData) => {
      // Emit QR update to faculty dashboard
      req.app.get('io').to(`faculty-${facultyId}`).emit('qr-update', {
        sessionId,
        qrData
      });
    };

    // Only start QR rotation in non-test environment
    if (process.env.NODE_ENV !== 'test') {
      await sessionService.startQRRotation(result.session.id, facultyId, qrUpdateCallback);
    }

    res.status(201).json({
      success: true,
      session: {
        id: result.session.id,
        courseName: result.session.course_name,
        courseCode: result.session.course_code,
        section: result.session.section,
        startTime: result.session.start_time,
        isActive: result.session.is_active === 1
      },
      qrData: result.qrData
    });

  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/faculty/sessions/:sessionId/end
 * End an attendance session
 */
router.post('/sessions/:sessionId/end', basicSecurityHeaders, csrfProtection, validateFacultyInput, async (req, res) => {
  try {
    await initializeServices();
    const { sessionId } = req.params;
    const { facultyId } = req.body;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        error: 'Faculty ID is required'
      });
    }

    const result = await sessionService.endSession(sessionId, facultyId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Notify faculty dashboard that session ended
    req.app.get('io').to(`faculty-${facultyId}`).emit('session-ended', {
      sessionId,
      endTime: result.session.end_time
    });

    res.json({
      success: true,
      session: {
        id: result.session.id,
        courseName: result.session.course_name,
        courseCode: result.session.course_code,
        section: result.session.section,
        startTime: result.session.start_time,
        endTime: result.session.end_time,
        isActive: result.session.is_active === 1
      },
      message: result.message
    });

  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/faculty/sessions/:sessionId/status
 * Get current session status and QR code data
 */
router.get('/sessions/:sessionId/status', async (req, res) => {
  try {
    await initializeServices();
    const { sessionId } = req.params;
    const { facultyId } = req.query;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        error: 'Faculty ID is required'
      });
    }

    const result = await sessionService.getSessionStatus(sessionId, facultyId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/faculty/sessions/:sessionId/attendance
 * Get real-time attendance data for a session
 */
router.get('/sessions/:sessionId/attendance', async (req, res) => {
  try {
    await initializeServices();
    const { sessionId } = req.params;
    const { facultyId } = req.query;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        error: 'Faculty ID is required'
      });
    }

    // Verify session belongs to faculty
    const sessionStatus = await sessionService.getSessionStatus(sessionId, facultyId);
    if (!sessionStatus.success) {
      return res.status(404).json(sessionStatus);
    }

    // Get attendance summary
    const attendanceSummary = await attendanceModel.getSessionSummary(sessionId);

    res.json({
      success: true,
      sessionId,
      attendance: {
        present: attendanceSummary.present.map(record => ({
          studentEmail: record.student_email,
          studentName: record.student_name,
          rollNumber: record.roll_number,
          branch: record.branch,
          year: record.year,
          timestamp: record.timestamp,
          ipAddress: record.ip_address
        })),
        summary: attendanceSummary.summary
      }
    });

  } catch (error) {
    console.error('Error getting attendance data:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/faculty/sessions/:sessionId/export
 * Export attendance data in JSON format
 */
router.get('/sessions/:sessionId/export', async (req, res) => {
  try {
    await initializeServices();
    const { sessionId } = req.params;
    const { facultyId } = req.query;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        error: 'Faculty ID is required'
      });
    }

    // Verify session belongs to faculty
    const sessionStatus = await sessionService.getSessionStatus(sessionId, facultyId);
    if (!sessionStatus.success) {
      return res.status(404).json(sessionStatus);
    }

    // Get complete attendance summary
    const attendanceSummary = await attendanceModel.getSessionSummary(sessionId);

    const exportData = {
      sessionInfo: {
        id: sessionStatus.session.id,
        courseName: sessionStatus.session.courseName,
        courseCode: sessionStatus.session.courseCode,
        section: sessionStatus.session.section,
        startTime: sessionStatus.session.startTime,
        endTime: sessionStatus.session.endTime,
        isActive: sessionStatus.session.isActive
      },
      attendance: {
        present: attendanceSummary.present.map(record => ({
          email: record.student_email,
          name: record.student_name,
          rollNumber: record.roll_number,
          branch: record.branch,
          year: record.year,
          timestamp: record.timestamp
        })),
        absent: attendanceSummary.absent.map(student => ({
          email: student.email,
          name: student.name,
          rollNumber: student.roll_number,
          branch: student.branch,
          year: student.year
        }))
      },
      summary: {
        totalStudents: attendanceSummary.summary.totalStudents,
        presentCount: attendanceSummary.summary.presentCount,
        absentCount: attendanceSummary.summary.absentCount,
        attendancePercentage: attendanceSummary.summary.attendancePercentage
      },
      exportedAt: new Date().toISOString()
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${sessionId}-${Date.now()}.json"`);
    
    res.json(exportData);

  } catch (error) {
    console.error('Error exporting attendance data:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/faculty/:facultyId/sessions
 * Get faculty's session history
 */
router.get('/:facultyId/sessions', async (req, res) => {
  try {
    await initializeServices();
    const { facultyId } = req.params;
    const { activeOnly, limit } = req.query;

    const options = {
      activeOnly: activeOnly === 'true',
      limit: limit ? parseInt(limit) : undefined
    };

    const result = await sessionService.getFacultySessionHistory(facultyId, options);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('Error getting faculty sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/faculty/sessions/:sessionId/qr/rotate
 * Manually rotate QR code for a session
 */
router.post('/sessions/:sessionId/qr/rotate', basicSecurityHeaders, csrfProtection, validateFacultyInput, async (req, res) => {
  try {
    await initializeServices();
    const { sessionId } = req.params;
    const { facultyId } = req.body;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        error: 'Faculty ID is required'
      });
    }

    const result = await sessionService.rotateQRToken(sessionId, facultyId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Notify faculty dashboard of manual QR rotation
    req.app.get('io').to(`faculty-${facultyId}`).emit('qr-update', {
      sessionId,
      qrData: result.qrData,
      manual: true
    });

    res.json(result);

  } catch (error) {
    console.error('Error rotating QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;