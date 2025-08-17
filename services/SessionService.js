const Session = require('../models/Session');
const QRCodeService = require('./QRCodeService');

class SessionService {
  constructor(database, baseUrl = 'http://localhost:3000') {
    this.sessionModel = new Session(database);
    this.qrCodeService = new QRCodeService(baseUrl);
  }

  /**
   * Start a new attendance session
   * @param {Object} sessionData - Session configuration
   * @param {string} sessionData.facultyId - Faculty identifier
   * @param {string} sessionData.courseName - Course name
   * @param {string} sessionData.courseCode - Course code
   * @param {string} sessionData.section - Section identifier
   * @returns {Promise<Object>} Created session with initial QR token and QR code
   */
  async startSession(sessionData) {
    try {
      // Validate required fields
      this.validateSessionData(sessionData);

      // Check if faculty already has an active session
      const activeSessions = await this.sessionModel.findActiveByfaculty(sessionData.facultyId);
      if (activeSessions.length > 0) {
        throw new Error('Faculty already has an active session. Please end the current session first.');
      }

      // Create new session
      const session = await this.sessionModel.create(sessionData);
      
      // Generate initial QR code
      const qrResult = await this.qrCodeService.generateQRCode(session.id, session.current_token);
      
      if (!qrResult.success) {
        throw new Error(`Failed to generate QR code: ${qrResult.error}`);
      }

      return {
        success: true,
        session: session,
        qrData: qrResult.qrData
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * End an attendance session
   * @param {string} sessionId - Session ID to end
   * @param {string} facultyId - Faculty ID for authorization
   * @returns {Promise<Object>} Result of session termination
   */
  async endSession(sessionId, facultyId) {
    try {
      // Verify session exists and belongs to faculty
      const session = await this.sessionModel.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.faculty_id !== facultyId) {
        throw new Error('Unauthorized: Session does not belong to this faculty');
      }

      if (!session.is_active) {
        throw new Error('Session is already ended');
      }

      // Stop QR code rotation for this session
      this.qrCodeService.stopQRRotation(sessionId);

      // End the session
      const endedSession = await this.sessionModel.endSession(sessionId);
      
      return {
        success: true,
        session: endedSession,
        message: 'Session ended successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current session status and QR data
   * @param {string} sessionId - Session ID
   * @param {string} facultyId - Faculty ID for authorization
   * @returns {Promise<Object>} Session status and QR information
   */
  async getSessionStatus(sessionId, facultyId) {
    try {
      const session = await this.sessionModel.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.faculty_id !== facultyId) {
        throw new Error('Unauthorized: Session does not belong to this faculty');
      }

      // Get session with attendance statistics
      const sessionWithStats = await this.sessionModel.getSessionWithStats(sessionId);

      const response = {
        success: true,
        session: {
          id: session.id,
          courseName: session.course_name,
          courseCode: session.course_code,
          section: session.section,
          startTime: session.start_time,
          endTime: session.end_time,
          isActive: session.is_active === 1,
          attendanceCount: sessionWithStats.attendance_count
        }
      };

      // Include QR data if session is active
      if (session.is_active === 1) {
        const qrResult = await this.qrCodeService.generateQRCode(session.id, session.current_token);
        
        if (qrResult.success) {
          response.qrData = qrResult.qrData;
        } else {
          response.qrData = {
            sessionId: session.id,
            token: session.current_token,
            expiresAt: session.token_expiry,
            isExpired: this.sessionModel.isTokenExpired(session.token_expiry),
            error: 'Failed to generate QR code'
          };
        }
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Rotate QR code token for active session
   * @param {string} sessionId - Session ID
   * @param {string} facultyId - Faculty ID for authorization
   * @returns {Promise<Object>} New QR token data
   */
  async rotateQRToken(sessionId, facultyId) {
    try {
      const session = await this.sessionModel.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.faculty_id !== facultyId) {
        throw new Error('Unauthorized: Session does not belong to this faculty');
      }

      if (!session.is_active) {
        throw new Error('Cannot rotate token for inactive session');
      }

      // Rotate the token
      const updatedSession = await this.sessionModel.rotateToken(sessionId);

      // Generate new QR code with the rotated token
      const qrResult = await this.qrCodeService.generateQRCode(sessionId, updatedSession.current_token);
      
      if (!qrResult.success) {
        throw new Error(`Failed to generate QR code after token rotation: ${qrResult.error}`);
      }

      return {
        success: true,
        qrData: qrResult.qrData
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if session exists
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} Whether session exists
   */
  async sessionExists(sessionId) {
    try {
      const session = await this.sessionModel.findById(sessionId);
      return !!session;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate session token for attendance marking
   * @param {string} sessionId - Session ID
   * @param {string} token - Token to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateAttendanceToken(sessionId, token) {
    try {
      const validation = await this.sessionModel.validateSessionToken(sessionId, token);
      
      if (!validation.valid) {
        return {
          success: false,
          error: validation.reason,
          canRetry: validation.reason === 'Token expired'
        };
      }

      return {
        success: true,
        session: validation.session,
        message: 'Token is valid for attendance marking'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        canRetry: false
      };
    }
  }

  /**
   * Get faculty's session history
   * @param {string} facultyId - Faculty ID
   * @param {Object} options - Query options
   * @param {boolean} options.activeOnly - Return only active sessions
   * @param {number} options.limit - Limit number of results
   * @returns {Promise<Object>} Session history
   */
  async getFacultySessionHistory(facultyId, options = {}) {
    try {
      let sessions;
      
      if (options.activeOnly) {
        sessions = await this.sessionModel.findActiveByfaculty(facultyId);
      } else {
        sessions = await this.sessionModel.findByFaculty(facultyId);
      }

      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        sessions = sessions.slice(0, options.limit);
      }

      return {
        success: true,
        sessions: sessions.map(session => ({
          id: session.id,
          courseName: session.course_name,
          courseCode: session.course_code,
          section: session.section,
          startTime: session.start_time,
          endTime: session.end_time,
          isActive: session.is_active === 1,
          createdAt: session.created_at
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start automatic QR code rotation for a session
   * @param {string} sessionId - Session ID
   * @param {string} facultyId - Faculty ID for authorization
   * @param {Function} qrUpdateCallback - Callback for broadcasting QR updates
   * @returns {Promise<Object>} Rotation start result
   */
  async startQRRotation(sessionId, facultyId, qrUpdateCallback) {
    try {
      // Verify session exists and belongs to faculty
      const session = await this.sessionModel.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.faculty_id !== facultyId) {
        throw new Error('Unauthorized: Session does not belong to this faculty');
      }

      if (!session.is_active) {
        throw new Error('Cannot start rotation for inactive session');
      }

      // Create token rotation callback
      const tokenRotationCallback = async (sessionId) => {
        return await this.rotateQRToken(sessionId, facultyId);
      };

      // Start QR rotation
      const rotationResult = this.qrCodeService.startQRRotation(
        sessionId,
        tokenRotationCallback,
        qrUpdateCallback
      );

      return rotationResult;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop automatic QR code rotation for a session
   * @param {string} sessionId - Session ID
   * @returns {Object} Rotation stop result
   */
  stopQRRotation(sessionId) {
    return this.qrCodeService.stopQRRotation(sessionId);
  }

  /**
   * Get QR rotation status for a session
   * @param {string} sessionId - Session ID
   * @returns {Object} Rotation status
   */
  getQRRotationStatus(sessionId) {
    return this.qrCodeService.getRotationStatus(sessionId);
  }

  /**
   * Cleanup expired tokens across all active sessions
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupExpiredTokens() {
    try {
      const cleanedCount = await this.sessionModel.cleanupExpiredTokens();
      
      return {
        success: true,
        cleanedCount: cleanedCount,
        message: `Cleaned up ${cleanedCount} expired tokens`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Set base URL for QR code generation
   * @param {string} baseUrl - Base URL for the application
   */
  setQRBaseUrl(baseUrl) {
    this.qrCodeService.setBaseUrl(baseUrl);
  }

  /**
   * Get current base URL for QR code generation
   * @returns {string} Current base URL
   */
  getQRBaseUrl() {
    return this.qrCodeService.getBaseUrl();
  }

  /**
   * Validate session data for creation
   * @param {Object} sessionData - Session data to validate
   * @throws {Error} If validation fails
   */
  validateSessionData(sessionData) {
    const required = ['facultyId', 'courseName', 'courseCode', 'section'];
    
    for (const field of required) {
      if (!sessionData[field] || typeof sessionData[field] !== 'string' || sessionData[field].trim() === '') {
        throw new Error(`${field} is required and must be a non-empty string`);
      }
    }

    // Validate course code format (basic validation)
    if (!/^[A-Z]{2,4}\d{3}$/.test(sessionData.courseCode)) {
      throw new Error('Course code must be in format like CSE201, MATH101, etc.');
    }

    // Validate section format
    if (!/^[A-Z]$/.test(sessionData.section)) {
      throw new Error('Section must be a single uppercase letter (A, B, C, etc.)');
    }
  }
}

module.exports = SessionService;