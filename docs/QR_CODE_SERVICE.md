# QR Code Service Documentation

## Overview

The QR Code Service provides secure, time-limited QR code generation and automatic rotation functionality for the attendance system. It integrates seamlessly with the session management system to provide anti-proxy measures through rotating QR codes.

## Features

- **Cryptographically Secure Token Generation**: Uses Node.js crypto module for secure random token generation
- **QR Code Generation**: Creates QR codes in both PNG (data URL) and SVG formats
- **Automatic 30-Second Rotation**: Implements automatic QR code rotation with configurable intervals
- **Token Validation**: Provides comprehensive token validation with expiry checking
- **Integration Ready**: Seamlessly integrates with the existing SessionService

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   SessionService │────│  QRCodeService   │────│  QR Code Library│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼────┐             ┌────▼────┐             ┌────▼────┐
    │ Session │             │ Crypto  │             │ QRCode  │
    │ Model   │             │ Module  │             │ PNG/SVG │
    └─────────┘             └─────────┘             └─────────┘
```

## Core Components

### QRCodeService Class

The main service class that handles all QR code operations.

#### Constructor
```javascript
const qrService = new QRCodeService(baseUrl = 'http://localhost:3000');
```

#### Key Methods

##### generateQRCode(sessionId, token, options)
Generates a QR code for a session with embedded token.

**Parameters:**
- `sessionId` (string): Unique session identifier
- `token` (string): Cryptographically secure token
- `options` (object): QR code generation options

**Returns:**
```javascript
{
  success: true,
  qrData: {
    sessionId: "session-id",
    token: "secure-token",
    url: "http://localhost:3000/attend/session-id?token=secure-token",
    qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    qrCodeSvg: "<svg xmlns='http://www.w3.org/2000/svg'>...</svg>",
    generatedAt: "2025-08-17T10:32:59.440Z",
    expiresAt: "2025-08-17T10:33:29.440Z"
  }
}
```

##### startQRRotation(sessionId, tokenRotationCallback, qrUpdateCallback, intervalMs)
Starts automatic QR code rotation for a session.

**Parameters:**
- `sessionId` (string): Session identifier
- `tokenRotationCallback` (function): Callback to rotate session token
- `qrUpdateCallback` (function): Callback to broadcast new QR code
- `intervalMs` (number): Rotation interval (default: 30000ms)

**Example:**
```javascript
const rotationResult = qrService.startQRRotation(
  sessionId,
  async (sessionId) => await sessionService.rotateQRToken(sessionId, facultyId),
  (sessionId, qrData) => {
    // Broadcast new QR code via WebSocket
    io.to(sessionId).emit('qr-update', qrData);
  }
);
```

##### stopQRRotation(sessionId)
Stops automatic QR code rotation for a session.

##### validateQRToken(sessionId, token, sessionValidationCallback)
Validates a QR code token against session data.

## Security Features

### Token Generation
- Uses `crypto.randomBytes(32)` for cryptographically secure tokens
- Tokens are 64-character hexadecimal strings
- Each token is unique and unpredictable

### Token Expiry
- Default expiry: 30 seconds from generation
- Configurable expiry duration
- Automatic cleanup of expired tokens

### Validation Chain
1. **Parameter Validation**: Ensures session ID and token are provided
2. **Session Validation**: Verifies session exists and is active
3. **Token Matching**: Compares provided token with current session token
4. **Expiry Check**: Validates token hasn't expired

## Integration with SessionService

The QRCodeService is integrated into the SessionService to provide a unified interface:

```javascript
// SessionService methods that use QRCodeService
await sessionService.startSession(sessionData);        // Creates session + QR code
await sessionService.rotateQRToken(sessionId, facultyId); // Rotates token + generates new QR
await sessionService.startQRRotation(sessionId, facultyId, callback); // Starts auto-rotation
sessionService.stopQRRotation(sessionId);              // Stops auto-rotation
```

## QR Code Format

### URL Structure
```
http://localhost:3000/attend/{sessionId}?token={secureToken}
```

### QR Code Options
```javascript
{
  errorCorrectionLevel: 'M',    // Medium error correction
  type: 'image/png',            // PNG format for data URL
  quality: 0.92,                // High quality
  margin: 1,                    // Minimal margin
  width: 256,                   // Default width in pixels
  color: {
    dark: '#000000',            // Black foreground
    light: '#FFFFFF'            // White background
  }
}
```

## Usage Examples

### Basic QR Code Generation
```javascript
const qrService = new QRCodeService('https://myapp.com');
const result = await qrService.generateQRCode('session-123', 'secure-token-456');

if (result.success) {
  console.log('QR Code URL:', result.qrData.url);
  console.log('QR Code Image:', result.qrData.qrCodeDataUrl);
}
```

### Automatic Rotation Setup
```javascript
// Token rotation callback
const tokenCallback = async (sessionId) => {
  return await sessionService.rotateQRToken(sessionId, facultyId);
};

// QR update callback for real-time updates
const updateCallback = (sessionId, qrData) => {
  io.to(`session-${sessionId}`).emit('qr-update', {
    qrCodeDataUrl: qrData.qrCodeDataUrl,
    expiresAt: qrData.expiresAt
  });
};

// Start rotation
const result = qrService.startQRRotation(
  sessionId,
  tokenCallback,
  updateCallback,
  30000 // 30 seconds
);
```

### Token Validation
```javascript
const validationResult = await qrService.validateQRToken(
  sessionId,
  token,
  async (sessionId, token) => {
    return await sessionService.validateAttendanceToken(sessionId, token);
  }
);

if (validationResult.success) {
  // Token is valid, proceed with attendance marking
} else {
  // Handle validation error
  console.error('Validation failed:', validationResult.error);
}
```

## Error Handling

### Common Error Codes
- `MISSING_PARAMETERS`: Session ID or token not provided
- `TOKEN_EXPIRED`: Token has expired (can retry with new token)
- `INVALID_TOKEN`: Token is invalid or session not found
- `VALIDATION_ERROR`: General validation error

### Error Response Format
```javascript
{
  success: false,
  error: "Human readable error message",
  code: "ERROR_CODE",
  canRetry: true/false  // Whether the operation can be retried
}
```

## Performance Considerations

### Memory Management
- Rotation timers are automatically cleaned up when stopped
- Use `stopAllRotations()` for bulk cleanup during shutdown

### Concurrent Sessions
- Each session maintains its own rotation timer
- No interference between multiple active sessions
- Efficient timer management with Map-based storage

### QR Code Generation
- PNG generation: ~500-700ms for complex QR codes
- SVG generation: ~100-200ms (faster, scalable)
- Consider caching for frequently accessed QR codes

## Testing

### Unit Tests
The service includes comprehensive unit tests covering:
- QR code generation with various parameters
- Automatic rotation functionality
- Token validation logic
- Error handling scenarios
- Security token generation

### Running Tests
```bash
npm test -- --testPathPattern=QRCodeService.test.js
```

### Demo Script
Run the interactive demo to see the service in action:
```bash
node scripts/qr-demo.js
```

## Configuration

### Environment Variables
```bash
# Base URL for QR code generation
QR_BASE_URL=https://yourdomain.com

# Default rotation interval (milliseconds)
QR_ROTATION_INTERVAL=30000

# Token expiry duration (milliseconds)
QR_TOKEN_EXPIRY=30000
```

### Runtime Configuration
```javascript
// Update base URL
qrService.setBaseUrl('https://production.com');

// Custom rotation interval
qrService.startQRRotation(sessionId, tokenCallback, updateCallback, 60000); // 1 minute
```

## Best Practices

1. **Always validate tokens** before marking attendance
2. **Use HTTPS** in production for secure QR code URLs
3. **Implement rate limiting** on attendance endpoints
4. **Clean up rotations** when sessions end
5. **Monitor rotation failures** and implement retry logic
6. **Use WebSockets** for real-time QR code updates
7. **Cache QR codes** when appropriate to improve performance

## Troubleshooting

### Common Issues

**QR Code Not Updating**
- Check if rotation is active: `getRotationStatus(sessionId)`
- Verify callback functions are working correctly
- Ensure session is still active

**Token Validation Failing**
- Check token expiry time
- Verify session is active
- Ensure token matches current session token

**Memory Leaks**
- Always call `stopQRRotation()` when ending sessions
- Use `stopAllRotations()` during application shutdown

### Debug Logging
Enable debug logging to troubleshoot issues:
```javascript
// The service logs rotation events and errors to console
// Check console output for rotation confirmations and error messages
```

## Future Enhancements

- **Location-based validation**: GPS verification for physical presence
- **Custom QR code styling**: Branded QR codes with logos
- **Batch QR generation**: Generate multiple QR codes simultaneously
- **QR code analytics**: Track scan rates and usage patterns
- **Advanced error recovery**: Automatic retry mechanisms for failed rotations