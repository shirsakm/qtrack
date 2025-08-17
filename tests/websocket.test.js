const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const WebSocketService = require('../services/WebSocketService');

describe('WebSocket Service', () => {
  let io, serverSocket, clientSocket, webSocketService;
  let httpServer;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    webSocketService = new WebSocketService(io);
    
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  describe('Room Management', () => {
    test('should join faculty room successfully', (done) => {
      const handleJoinedRoom = (data) => {
        expect(data.room).toBe('faculty-test-faculty-123');
        expect(data.message).toContain('Successfully joined faculty dashboard room');
        clientSocket.off('joined-room', handleJoinedRoom);
        done();
      };
      
      clientSocket.on('joined-room', handleJoinedRoom);
      clientSocket.emit('join-faculty-room', { facultyId: 'test-faculty-123' });
    });

    test('should join session room successfully', (done) => {
      const sessionId = 'test-session-456';
      const facultyId = 'test-faculty-123';
      
      const handleJoinedRoom = (data) => {
        expect(data.room).toBe(`session-${sessionId}`);
        expect(data.message).toContain('Successfully joined session room');
        clientSocket.off('joined-room', handleJoinedRoom);
        done();
      };
      
      clientSocket.on('joined-room', handleJoinedRoom);
      clientSocket.emit('join-session-room', { sessionId, facultyId });
    });

    test('should leave faculty room successfully', () => {
      clientSocket.emit('leave-faculty-room', { facultyId: 'test-faculty-123' });
      // No response expected for leave operations
    });

    test('should respond to ping with pong', (done) => {
      const handlePong = (data) => {
        expect(data).toHaveProperty('timestamp');
        expect(new Date(data.timestamp)).toBeInstanceOf(Date);
        clientSocket.off('pong', handlePong);
        done();
      };
      
      clientSocket.on('pong', handlePong);
      clientSocket.emit('ping');
    });
  });

  describe('Broadcasting', () => {
    beforeEach((done) => {
      // Join faculty room before each test
      const handleJoinedRoom = () => {
        clientSocket.off('joined-room', handleJoinedRoom);
        done();
      };
      
      clientSocket.on('joined-room', handleJoinedRoom);
      clientSocket.emit('join-faculty-room', { facultyId: 'test-faculty-123' });
    });

    test('should broadcast QR update to faculty room', (done) => {
      const facultyId = 'test-faculty-123';
      const sessionId = 'test-session-456';
      const qrData = {
        sessionId,
        token: 'test-token',
        qrCodeDataUrl: 'data:image/png;base64,test'
      };

      let eventReceived = false;
      clientSocket.on('qr-update', (data) => {
        if (eventReceived) return; // Ignore duplicate events
        eventReceived = true;
        
        expect(data.sessionId).toBe(sessionId);
        expect(data.qrData).toEqual(qrData);
        expect(data).toHaveProperty('timestamp');
        done();
      });

      webSocketService.broadcastQRUpdate(facultyId, sessionId, qrData);
    });

    test('should broadcast attendance update to faculty room', (done) => {
      const facultyId = 'test-faculty-123';
      const sessionId = 'test-session-456';
      const attendanceData = {
        newAttendance: {
          studentEmail: 'test@heritageit.edu.in',
          studentName: 'Test Student',
          timestamp: new Date().toISOString()
        },
        summary: {
          totalStudents: 30,
          presentCount: 15,
          absentCount: 15,
          attendancePercentage: 50
        }
      };

      let eventReceived = false;
      clientSocket.on('attendance-update', (data) => {
        if (eventReceived) return; // Ignore duplicate events
        eventReceived = true;
        
        expect(data.sessionId).toBe(sessionId);
        expect(data.attendance).toEqual(attendanceData);
        expect(data).toHaveProperty('timestamp');
        done();
      });

      webSocketService.broadcastAttendanceUpdate(facultyId, sessionId, attendanceData);
    });

    test('should broadcast session status change', (done) => {
      const facultyId = 'test-faculty-123';
      const sessionId = 'test-session-456';
      const status = 'ended';
      const sessionData = {
        endTime: new Date().toISOString()
      };

      let eventReceived = false;
      clientSocket.on('session-status-change', (data) => {
        if (eventReceived) return; // Ignore duplicate events
        eventReceived = true;
        
        expect(data.sessionId).toBe(sessionId);
        expect(data.status).toBe(status);
        expect(data.sessionData).toEqual(sessionData);
        expect(data).toHaveProperty('timestamp');
        done();
      });

      webSocketService.broadcastSessionStatusChange(facultyId, sessionId, status, sessionData);
    });

    test('should broadcast error to faculty room', (done) => {
      const facultyId = 'test-faculty-123';
      const error = 'Test error message';
      const context = { sessionId: 'test-session-456' };

      clientSocket.on('error', (data) => {
        expect(data.error).toBe(error);
        expect(data.context).toEqual(context);
        expect(data).toHaveProperty('timestamp');
        done();
      });

      webSocketService.broadcastError(facultyId, error, context);
    });

    test('should broadcast system message to all clients', (done) => {
      const message = 'System maintenance in 5 minutes';
      const type = 'warning';

      clientSocket.on('system-message', (data) => {
        expect(data.message).toBe(message);
        expect(data.type).toBe(type);
        expect(data).toHaveProperty('timestamp');
        done();
      });

      webSocketService.broadcastSystemMessage(message, type);
    });
  });

  describe('Room Information', () => {
    test('should get room client count', () => {
      // This test depends on the current state, so we'll test the method exists
      const count = webSocketService.getRoomClientCount('faculty-test-faculty-123');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should get active rooms', () => {
      const rooms = webSocketService.getActiveRooms();
      expect(Array.isArray(rooms)).toBe(true);
      
      if (rooms.length > 0) {
        expect(rooms[0]).toHaveProperty('name');
        expect(rooms[0]).toHaveProperty('clientCount');
      }
    });
  });

  describe('Direct Messaging', () => {
    test('should send direct message to specific socket', (done) => {
      const event = 'direct-message';
      const data = { message: 'Hello specific client' };

      clientSocket.on(event, (receivedData) => {
        expect(receivedData).toEqual(data);
        done();
      });

      webSocketService.sendToSocket(clientSocket.id, event, data);
    });
  });
});