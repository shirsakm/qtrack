class WebSocketService {
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Handle faculty dashboard connection
      socket.on('join-faculty-room', (data) => {
        const { facultyId } = data;
        if (facultyId) {
          socket.join(`faculty-${facultyId}`);
          console.log(`Faculty ${facultyId} joined room: faculty-${facultyId}`);
          
          socket.emit('joined-room', {
            room: `faculty-${facultyId}`,
            message: 'Successfully joined faculty dashboard room'
          });
        }
      });

      // Handle leaving faculty room
      socket.on('leave-faculty-room', (data) => {
        const { facultyId } = data;
        if (facultyId) {
          socket.leave(`faculty-${facultyId}`);
          console.log(`Faculty ${facultyId} left room: faculty-${facultyId}`);
        }
      });

      // Handle session room joining (for specific session updates)
      socket.on('join-session-room', (data) => {
        const { sessionId, facultyId } = data;
        if (sessionId && facultyId) {
          socket.join(`session-${sessionId}`);
          console.log(`Faculty ${facultyId} joined session room: session-${sessionId}`);
          
          socket.emit('joined-room', {
            room: `session-${sessionId}`,
            message: 'Successfully joined session room'
          });
        }
      });

      // Handle leaving session room
      socket.on('leave-session-room', (data) => {
        const { sessionId } = data;
        if (sessionId) {
          socket.leave(`session-${sessionId}`);
          console.log(`Client left session room: session-${sessionId}`);
        }
      });

      // Handle ping for connection health check
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  /**
   * Broadcast QR code update to faculty dashboard
   * @param {string} facultyId - Faculty ID
   * @param {string} sessionId - Session ID
   * @param {Object} qrData - QR code data
   */
  broadcastQRUpdate(facultyId, sessionId, qrData) {
    this.io.to(`faculty-${facultyId}`).emit('qr-update', {
      sessionId,
      qrData,
      timestamp: new Date().toISOString()
    });

    // Also broadcast to session-specific room
    this.io.to(`session-${sessionId}`).emit('qr-update', {
      sessionId,
      qrData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast attendance update to faculty dashboard
   * @param {string} facultyId - Faculty ID
   * @param {string} sessionId - Session ID
   * @param {Object} attendanceData - Attendance data
   */
  broadcastAttendanceUpdate(facultyId, sessionId, attendanceData) {
    const updateData = {
      sessionId,
      attendance: attendanceData,
      timestamp: new Date().toISOString()
    };

    this.io.to(`faculty-${facultyId}`).emit('attendance-update', updateData);
    this.io.to(`session-${sessionId}`).emit('attendance-update', updateData);
  }

  /**
   * Broadcast session status change
   * @param {string} facultyId - Faculty ID
   * @param {string} sessionId - Session ID
   * @param {string} status - Session status (started, ended, etc.)
   * @param {Object} sessionData - Session data
   */
  broadcastSessionStatusChange(facultyId, sessionId, status, sessionData = {}) {
    const statusData = {
      sessionId,
      status,
      sessionData,
      timestamp: new Date().toISOString()
    };

    this.io.to(`faculty-${facultyId}`).emit('session-status-change', statusData);
    this.io.to(`session-${sessionId}`).emit('session-status-change', statusData);
  }

  /**
   * Broadcast error to specific faculty
   * @param {string} facultyId - Faculty ID
   * @param {string} error - Error message
   * @param {Object} context - Error context
   */
  broadcastError(facultyId, error, context = {}) {
    this.io.to(`faculty-${facultyId}`).emit('error', {
      error,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get connected clients count for a room
   * @param {string} room - Room name
   * @returns {number} Number of connected clients
   */
  getRoomClientCount(room) {
    const roomClients = this.io.sockets.adapter.rooms.get(room);
    return roomClients ? roomClients.size : 0;
  }

  /**
   * Get all active rooms
   * @returns {Array} List of active rooms
   */
  getActiveRooms() {
    const rooms = [];
    for (const [roomName, roomClients] of this.io.sockets.adapter.rooms) {
      if (!roomClients.has(roomName)) { // Skip socket ID rooms
        rooms.push({
          name: roomName,
          clientCount: roomClients.size
        });
      }
    }
    return rooms;
  }

  /**
   * Broadcast system message to all connected clients
   * @param {string} message - System message
   * @param {string} type - Message type (info, warning, error)
   */
  broadcastSystemMessage(message, type = 'info') {
    this.io.emit('system-message', {
      message,
      type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send direct message to a specific socket
   * @param {string} socketId - Socket ID
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  sendToSocket(socketId, event, data) {
    this.io.to(socketId).emit(event, data);
  }
}

module.exports = WebSocketService;