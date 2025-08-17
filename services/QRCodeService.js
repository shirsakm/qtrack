const QRCode = require('qrcode');
const crypto = require('crypto');

class QRCodeService {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.activeRotationTimers = new Map(); // Track active rotation timers
  }

  /**
   * Generate QR code for a session with embedded token
   * @param {string} sessionId - Session ID
   * @param {string} token - Secure token for the session
   * @param {Object} options - QR code generation options
   * @returns {Promise<Object>} QR code data and metadata
   */
  async generateQRCode(sessionId, token, options = {}) {
    try {
      // Validate inputs
      if (!sessionId || !token) {
        throw new Error('Session ID and token are required');
      }

      // Create attendance URL with session ID and token
      const attendanceUrl = `${this.baseUrl}/attend/${sessionId}?token=${token}`;
      
      // QR code generation options
      const qrOptions = {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: options.width || 256,
        ...options
      };

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(attendanceUrl, qrOptions);
      
      // Generate QR code as SVG for better scalability
      const qrCodeSvg = await QRCode.toString(attendanceUrl, {
        ...qrOptions,
        type: 'svg'
      });

      return {
        success: true,
        qrData: {
          sessionId,
          token,
          url: attendanceUrl,
          qrCodeDataURL: qrCodeDataUrl, // Use consistent naming
          qrCodeSvg,
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30000).toISOString() // 30 seconds
        }
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
   * @param {Function} tokenRotationCallback - Callback to rotate session token
   * @param {Function} qrUpdateCallback - Callback to broadcast new QR code
   * @param {number} intervalMs - Rotation interval in milliseconds (default: 30000)
   * @returns {Object} Rotation control object
   */
  startQRRotation(sessionId, tokenRotationCallback, qrUpdateCallback, intervalMs = 30000) {
    try {
      // Clear any existing rotation for this session
      this.stopQRRotation(sessionId);

      const rotationTimer = setInterval(async () => {
        try {
          // Rotate the session token
          const tokenResult = await tokenRotationCallback(sessionId);
          
          if (!tokenResult.success) {
            console.error(`Failed to rotate token for session ${sessionId}:`, tokenResult.error);
            this.stopQRRotation(sessionId);
            return;
          }

          // Generate new QR code with the new token
          const qrResult = await this.generateQRCode(sessionId, tokenResult.qrData.token);
          
          if (!qrResult.success) {
            console.error(`Failed to generate QR code for session ${sessionId}:`, qrResult.error);
            return;
          }

          // Broadcast the new QR code
          if (qrUpdateCallback) {
            qrUpdateCallback(sessionId, qrResult.qrData);
          }

          console.log(`QR code rotated for session ${sessionId} at ${new Date().toISOString()}`);
        } catch (error) {
          console.error(`Error during QR rotation for session ${sessionId}:`, error.message);
          this.stopQRRotation(sessionId);
        }
      }, intervalMs);

      // Store the timer reference
      this.activeRotationTimers.set(sessionId, {
        timer: rotationTimer,
        startedAt: new Date().toISOString(),
        intervalMs
      });

      return {
        success: true,
        sessionId,
        message: `QR rotation started for session ${sessionId}`,
        intervalMs
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop QR code rotation for a session
   * @param {string} sessionId - Session ID
   * @returns {Object} Stop result
   */
  stopQRRotation(sessionId) {
    try {
      const rotationData = this.activeRotationTimers.get(sessionId);
      
      if (rotationData) {
        clearInterval(rotationData.timer);
        this.activeRotationTimers.delete(sessionId);
        
        return {
          success: true,
          sessionId,
          message: `QR rotation stopped for session ${sessionId}`,
          wasActive: true
        };
      }

      return {
        success: true,
        sessionId,
        message: `No active rotation found for session ${sessionId}`,
        wasActive: false
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get rotation status for a session
   * @param {string} sessionId - Session ID
   * @returns {Object} Rotation status
   */
  getRotationStatus(sessionId) {
    const rotationData = this.activeRotationTimers.get(sessionId);
    
    if (!rotationData) {
      return {
        isActive: false,
        sessionId
      };
    }

    return {
      isActive: true,
      sessionId,
      startedAt: rotationData.startedAt,
      intervalMs: rotationData.intervalMs,
      uptime: Date.now() - new Date(rotationData.startedAt).getTime()
    };
  }

  /**
   * Stop all active rotations (useful for cleanup)
   * @returns {Object} Cleanup result
   */
  stopAllRotations() {
    try {
      const stoppedSessions = [];
      
      for (const [sessionId, rotationData] of this.activeRotationTimers.entries()) {
        clearInterval(rotationData.timer);
        stoppedSessions.push(sessionId);
      }
      
      this.activeRotationTimers.clear();
      
      return {
        success: true,
        stoppedCount: stoppedSessions.length,
        stoppedSessions,
        message: `Stopped rotation for ${stoppedSessions.length} sessions`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate QR code token and check expiry
   * @param {string} sessionId - Session ID
   * @param {string} token - Token to validate
   * @param {Function} sessionValidationCallback - Callback to validate against session
   * @returns {Promise<Object>} Validation result
   */
  async validateQRToken(sessionId, token, sessionValidationCallback) {
    try {
      if (!sessionId || !token) {
        return {
          success: false,
          error: 'Session ID and token are required',
          code: 'MISSING_PARAMETERS'
        };
      }

      // Use the session validation callback to check against database
      const sessionValidation = await sessionValidationCallback(sessionId, token);
      
      if (!sessionValidation.success) {
        return {
          success: false,
          error: sessionValidation.error,
          code: sessionValidation.canRetry ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          canRetry: sessionValidation.canRetry || false
        };
      }

      return {
        success: true,
        sessionId,
        token,
        session: sessionValidation.session,
        message: 'QR token is valid'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Generate a cryptographically secure token
   * @param {number} length - Token length in bytes (default: 32)
   * @returns {string} Secure random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Get token expiry timestamp
   * @param {number} durationMs - Duration in milliseconds (default: 30000)
   * @returns {string} ISO timestamp for token expiry
   */
  getTokenExpiry(durationMs = 30000) {
    return new Date(Date.now() + durationMs).toISOString();
  }

  /**
   * Check if a token timestamp is expired
   * @param {string} expiryTimestamp - ISO timestamp
   * @returns {boolean} True if expired
   */
  isTokenExpired(expiryTimestamp) {
    if (!expiryTimestamp) return true;
    return new Date(expiryTimestamp) <= new Date();
  }

  /**
   * Get all active rotation sessions
   * @returns {Array} List of active rotation sessions
   */
  getActiveRotations() {
    const activeRotations = [];
    
    for (const [sessionId, rotationData] of this.activeRotationTimers.entries()) {
      activeRotations.push({
        sessionId,
        startedAt: rotationData.startedAt,
        intervalMs: rotationData.intervalMs,
        uptime: Date.now() - new Date(rotationData.startedAt).getTime()
      });
    }
    
    return activeRotations;
  }

  /**
   * Set base URL for QR code generation
   * @param {string} baseUrl - Base URL for the application
   */
  setBaseUrl(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get current base URL
   * @returns {string} Current base URL
   */
  getBaseUrl() {
    return this.baseUrl;
  }
}

module.exports = QRCodeService;