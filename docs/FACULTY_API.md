# Faculty Dashboard API Documentation

This document describes the REST API endpoints for the faculty dashboard backend.

## Base URL
```
http://localhost:3000/api/faculty
```

## Authentication
All endpoints require a `facultyId` parameter for authorization. In a production environment, this would be replaced with proper JWT or session-based authentication.

## Endpoints

### 1. Start Attendance Session
**POST** `/sessions/start`

Start a new attendance session and generate initial QR code.

**Request Body:**
```json
{
  "facultyId": "string",
  "courseName": "string",
  "courseCode": "string",
  "section": "string"
}
```

**Response (201):**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "courseName": "Computer Science Fundamentals",
    "courseCode": "CSE101",
    "section": "A",
    "startTime": "2024-01-15T10:00:00.000Z",
    "isActive": true
  },
  "qrData": {
    "sessionId": "uuid",
    "token": "secure-token",
    "url": "http://localhost:3000/attend/uuid?token=secure-token",
    "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "qrCodeSvg": "<svg>...</svg>",
    "generatedAt": "2024-01-15T10:00:00.000Z",
    "expiresAt": "2024-01-15T10:00:30.000Z"
  }
}
```

### 2. End Attendance Session
**POST** `/sessions/:sessionId/end`

End an active attendance session.

**Request Body:**
```json
{
  "facultyId": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "courseName": "Computer Science Fundamentals",
    "courseCode": "CSE101",
    "section": "A",
    "startTime": "2024-01-15T10:00:00.000Z",
    "endTime": "2024-01-15T11:00:00.000Z",
    "isActive": false
  },
  "message": "Session ended successfully"
}
```

### 3. Get Session Status
**GET** `/sessions/:sessionId/status?facultyId=string`

Get current session status and QR code data.

**Response (200):**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "courseName": "Computer Science Fundamentals",
    "courseCode": "CSE101",
    "section": "A",
    "startTime": "2024-01-15T10:00:00.000Z",
    "endTime": null,
    "isActive": true,
    "attendanceCount": 15
  },
  "qrData": {
    "sessionId": "uuid",
    "token": "current-token",
    "url": "http://localhost:3000/attend/uuid?token=current-token",
    "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "qrCodeSvg": "<svg>...</svg>",
    "generatedAt": "2024-01-15T10:00:00.000Z",
    "expiresAt": "2024-01-15T10:00:30.000Z"
  }
}
```

### 4. Get Real-time Attendance Data
**GET** `/sessions/:sessionId/attendance?facultyId=string`

Get current attendance data for a session.

**Response (200):**
```json
{
  "success": true,
  "sessionId": "uuid",
  "attendance": {
    "present": [
      {
        "studentEmail": "john.doe.cse28@heritageit.edu.in",
        "studentName": "John Doe",
        "rollNumber": "CSE28002",
        "branch": "CSE",
        "year": "2028",
        "timestamp": "2024-01-15T10:05:00.000Z",
        "ipAddress": "192.168.1.100"
      }
    ],
    "summary": {
      "totalStudents": 30,
      "presentCount": 15,
      "absentCount": 15,
      "attendancePercentage": 50.0
    }
  }
}
```

### 5. Export Attendance Data
**GET** `/sessions/:sessionId/export?facultyId=string`

Export complete attendance data in JSON format.

**Response (200):**
```json
{
  "sessionInfo": {
    "id": "uuid",
    "courseName": "Computer Science Fundamentals",
    "courseCode": "CSE101",
    "section": "A",
    "startTime": "2024-01-15T10:00:00.000Z",
    "endTime": "2024-01-15T11:00:00.000Z",
    "isActive": false
  },
  "attendance": {
    "present": [
      {
        "email": "john.doe.cse28@heritageit.edu.in",
        "name": "John Doe",
        "rollNumber": "CSE28002",
        "branch": "CSE",
        "year": "2028",
        "timestamp": "2024-01-15T10:05:00.000Z"
      }
    ],
    "absent": [
      {
        "email": "jane.smith.cse28@heritageit.edu.in",
        "name": "Jane Smith",
        "rollNumber": "CSE28003",
        "branch": "CSE",
        "year": "2028"
      }
    ]
  },
  "summary": {
    "totalStudents": 30,
    "presentCount": 15,
    "absentCount": 15,
    "attendancePercentage": 50.0
  },
  "exportedAt": "2024-01-15T11:00:00.000Z"
}
```

### 6. Get Faculty Session History
**GET** `/:facultyId/sessions?activeOnly=boolean&limit=number`

Get faculty's session history.

**Query Parameters:**
- `activeOnly` (optional): Return only active sessions
- `limit` (optional): Limit number of results

**Response (200):**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "uuid",
      "courseName": "Computer Science Fundamentals",
      "courseCode": "CSE101",
      "section": "A",
      "startTime": "2024-01-15T10:00:00.000Z",
      "endTime": "2024-01-15T11:00:00.000Z",
      "isActive": false,
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

### 7. Manually Rotate QR Code
**POST** `/sessions/:sessionId/qr/rotate`

Manually rotate QR code for an active session.

**Request Body:**
```json
{
  "facultyId": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "qrData": {
    "sessionId": "uuid",
    "token": "new-token",
    "url": "http://localhost:3000/attend/uuid?token=new-token",
    "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "qrCodeSvg": "<svg>...</svg>",
    "generatedAt": "2024-01-15T10:00:30.000Z",
    "expiresAt": "2024-01-15T10:01:00.000Z"
  }
}
```

## WebSocket Events

The API also supports real-time updates via WebSocket connections.

### Client Events (Sent to Server)
- `join-faculty-room`: Join faculty-specific room for updates
- `leave-faculty-room`: Leave faculty room
- `join-session-room`: Join session-specific room
- `leave-session-room`: Leave session room
- `ping`: Health check

### Server Events (Sent to Client)
- `qr-update`: New QR code generated
- `attendance-update`: New attendance marked
- `session-status-change`: Session started/ended
- `error`: Error occurred
- `system-message`: System-wide message

### Example WebSocket Usage
```javascript
const socket = io();

// Join faculty room
socket.emit('join-faculty-room', { facultyId: 'faculty-123' });

// Listen for QR updates
socket.on('qr-update', (data) => {
  console.log('New QR code:', data.qrData);
});

// Listen for attendance updates
socket.on('attendance-update', (data) => {
  console.log('New attendance:', data.attendance);
});
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400`: Bad Request (missing/invalid parameters)
- `401`: Unauthorized (invalid faculty ID)
- `404`: Not Found (session not found)
- `409`: Conflict (duplicate attendance)
- `500`: Internal Server Error

## Rate Limiting

The API implements rate limiting to prevent abuse:
- Attendance marking: 10 requests per minute per IP
- Other endpoints: 100 requests per minute per IP

## Health Check

**GET** `/api/health`

Check API health status.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "uptime": 3600,
  "activeRooms": [
    {
      "name": "faculty-123",
      "clientCount": 2
    }
  ]
}
```