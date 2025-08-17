const QRCodeService = require('../services/QRCodeService');

describe('QRCodeService', () => {
  let qrService;
  const mockBaseUrl = 'http://localhost:3000';
  const mockSessionId = 'test-session-123';
  const mockToken = 'abc123def456';

  beforeEach(() => {
    qrService = new QRCodeService(mockBaseUrl);
    // Clear any existing timers
    qrService.stopAllRotations();
  });

  afterEach(() => {
    // Clean up any active timers
    qrService.stopAllRotations();
  });

  describe('constructor', () => {
    test('should initialize with default base URL', () => {
      const service = new QRCodeService();
      expect(service.getBaseUrl()).toBe('http://localhost:3000');
    });

    test('should initialize with custom base URL', () => {
      const customUrl = 'https://example.com';
      const service = new QRCodeService(customUrl);
      expect(service.getBaseUrl()).toBe(customUrl);
    });

    test('should initialize with empty rotation timers map', () => {
      expect(qrService.getActiveRotations()).toEqual([]);
    });
  });

  describe('generateQRCode', () => {
    test('should generate QR code successfully with valid inputs', async () => {
      const result = await qrService.generateQRCode(mockSessionId, mockToken);
      
      expect(result.success).toBe(true);
      expect(result.qrData).toBeDefined();
      expect(result.qrData.sessionId).toBe(mockSessionId);
      expect(result.qrData.token).toBe(mockToken);
      expect(result.qrData.url).toBe(`${mockBaseUrl}/attend/${mockSessionId}?token=${mockToken}`);
      expect(result.qrData.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(result.qrData.qrCodeSvg).toContain('<svg');
      expect(result.qrData.generatedAt).toBeDefined();
      expect(result.qrData.expiresAt).toBeDefined();
    });

    test('should fail when session ID is missing', async () => {
      const result = await qrService.generateQRCode('', mockToken);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session ID and token are required');
    });

    test('should fail when token is missing', async () => {
      const result = await qrService.generateQRCode(mockSessionId, '');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session ID and token are required');
    });

    test('should generate QR code with custom options', async () => {
      const customOptions = { width: 512 };
      const result = await qrService.generateQRCode(mockSessionId, mockToken, customOptions);
      
      expect(result.success).toBe(true);
      expect(result.qrData.qrCodeDataUrl).toBeDefined();
    });

    test('should set expiry time to 30 seconds from generation', async () => {
      const beforeGeneration = Date.now();
      const result = await qrService.generateQRCode(mockSessionId, mockToken);
      const afterGeneration = Date.now();
      
      const expiryTime = new Date(result.qrData.expiresAt).getTime();
      const expectedMinExpiry = beforeGeneration + 29000; // 29 seconds (allowing for execution time)
      const expectedMaxExpiry = afterGeneration + 31000; // 31 seconds (allowing for execution time)
      
      expect(expiryTime).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(expiryTime).toBeLessThanOrEqual(expectedMaxExpiry);
    });
  });

  describe('startQRRotation', () => {
    test('should start QR rotation successfully', () => {
      const mockTokenCallback = jest.fn().mockResolvedValue({
        success: true,
        qrData: { token: 'new-token-123' }
      });
      const mockQRCallback = jest.fn();

      const result = qrService.startQRRotation(
        mockSessionId,
        mockTokenCallback,
        mockQRCallback,
        100 // 100ms for testing
      );

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(mockSessionId);
      expect(result.intervalMs).toBe(100);
      
      const status = qrService.getRotationStatus(mockSessionId);
      expect(status.isActive).toBe(true);
    });

    test('should stop existing rotation when starting new one', () => {
      const mockTokenCallback = jest.fn().mockResolvedValue({
        success: true,
        qrData: { token: 'new-token-123' }
      });
      const mockQRCallback = jest.fn();

      // Start first rotation
      qrService.startQRRotation(mockSessionId, mockTokenCallback, mockQRCallback, 100);
      const firstStatus = qrService.getRotationStatus(mockSessionId);
      
      // Start second rotation (should replace first)
      qrService.startQRRotation(mockSessionId, mockTokenCallback, mockQRCallback, 200);
      const secondStatus = qrService.getRotationStatus(mockSessionId);
      
      expect(firstStatus.isActive).toBe(true);
      expect(secondStatus.isActive).toBe(true);
      expect(secondStatus.intervalMs).toBe(200);
    });

    test('should execute rotation callback at specified interval', (done) => {
      const mockTokenCallback = jest.fn().mockResolvedValue({
        success: true,
        qrData: { token: 'new-token-123' }
      });
      const mockQRCallback = jest.fn();

      qrService.startQRRotation(mockSessionId, mockTokenCallback, mockQRCallback, 50);

      setTimeout(() => {
        expect(mockTokenCallback).toHaveBeenCalledWith(mockSessionId);
        qrService.stopQRRotation(mockSessionId);
        done();
      }, 100);
    });

    test('should stop rotation when token callback fails', (done) => {
      const mockTokenCallback = jest.fn().mockResolvedValue({
        success: false,
        error: 'Token rotation failed'
      });
      const mockQRCallback = jest.fn();

      qrService.startQRRotation(mockSessionId, mockTokenCallback, mockQRCallback, 50);

      setTimeout(() => {
        const status = qrService.getRotationStatus(mockSessionId);
        expect(status.isActive).toBe(false);
        done();
      }, 100);
    });
  });

  describe('stopQRRotation', () => {
    test('should stop active rotation successfully', () => {
      const mockTokenCallback = jest.fn().mockResolvedValue({
        success: true,
        qrData: { token: 'new-token-123' }
      });
      const mockQRCallback = jest.fn();

      // Start rotation
      qrService.startQRRotation(mockSessionId, mockTokenCallback, mockQRCallback, 100);
      expect(qrService.getRotationStatus(mockSessionId).isActive).toBe(true);

      // Stop rotation
      const result = qrService.stopQRRotation(mockSessionId);
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(mockSessionId);
      expect(result.wasActive).toBe(true);
      expect(qrService.getRotationStatus(mockSessionId).isActive).toBe(false);
    });

    test('should handle stopping non-existent rotation', () => {
      const result = qrService.stopQRRotation('non-existent-session');
      
      expect(result.success).toBe(true);
      expect(result.wasActive).toBe(false);
    });
  });

  describe('getRotationStatus', () => {
    test('should return inactive status for non-existent session', () => {
      const status = qrService.getRotationStatus('non-existent');
      
      expect(status.isActive).toBe(false);
      expect(status.sessionId).toBe('non-existent');
    });

    test('should return active status with details for running rotation', () => {
      const mockTokenCallback = jest.fn().mockResolvedValue({
        success: true,
        qrData: { token: 'new-token-123' }
      });
      const mockQRCallback = jest.fn();

      qrService.startQRRotation(mockSessionId, mockTokenCallback, mockQRCallback, 100);
      const status = qrService.getRotationStatus(mockSessionId);
      
      expect(status.isActive).toBe(true);
      expect(status.sessionId).toBe(mockSessionId);
      expect(status.startedAt).toBeDefined();
      expect(status.intervalMs).toBe(100);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stopAllRotations', () => {
    test('should stop all active rotations', () => {
      const mockTokenCallback = jest.fn().mockResolvedValue({
        success: true,
        qrData: { token: 'new-token-123' }
      });
      const mockQRCallback = jest.fn();

      // Start multiple rotations
      qrService.startQRRotation('session1', mockTokenCallback, mockQRCallback, 100);
      qrService.startQRRotation('session2', mockTokenCallback, mockQRCallback, 100);
      qrService.startQRRotation('session3', mockTokenCallback, mockQRCallback, 100);

      expect(qrService.getActiveRotations()).toHaveLength(3);

      const result = qrService.stopAllRotations();
      
      expect(result.success).toBe(true);
      expect(result.stoppedCount).toBe(3);
      expect(result.stoppedSessions).toEqual(['session1', 'session2', 'session3']);
      expect(qrService.getActiveRotations()).toHaveLength(0);
    });

    test('should handle stopping when no rotations are active', () => {
      const result = qrService.stopAllRotations();
      
      expect(result.success).toBe(true);
      expect(result.stoppedCount).toBe(0);
      expect(result.stoppedSessions).toEqual([]);
    });
  });

  describe('validateQRToken', () => {
    test('should validate token successfully with valid session callback', async () => {
      const mockSessionCallback = jest.fn().mockResolvedValue({
        success: true,
        session: { id: mockSessionId, isActive: true }
      });

      const result = await qrService.validateQRToken(mockSessionId, mockToken, mockSessionCallback);
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(mockSessionId);
      expect(result.token).toBe(mockToken);
      expect(result.session).toBeDefined();
      expect(mockSessionCallback).toHaveBeenCalledWith(mockSessionId, mockToken);
    });

    test('should fail validation when session ID is missing', async () => {
      const mockSessionCallback = jest.fn();
      
      const result = await qrService.validateQRToken('', mockToken, mockSessionCallback);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session ID and token are required');
      expect(result.code).toBe('MISSING_PARAMETERS');
    });

    test('should fail validation when token is missing', async () => {
      const mockSessionCallback = jest.fn();
      
      const result = await qrService.validateQRToken(mockSessionId, '', mockSessionCallback);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session ID and token are required');
      expect(result.code).toBe('MISSING_PARAMETERS');
    });

    test('should handle session callback failure with retry option', async () => {
      const mockSessionCallback = jest.fn().mockResolvedValue({
        success: false,
        error: 'Token expired',
        canRetry: true
      });

      const result = await qrService.validateQRToken(mockSessionId, mockToken, mockSessionCallback);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Token expired');
      expect(result.code).toBe('TOKEN_EXPIRED');
      expect(result.canRetry).toBe(true);
    });

    test('should handle session callback failure without retry option', async () => {
      const mockSessionCallback = jest.fn().mockResolvedValue({
        success: false,
        error: 'Invalid session',
        canRetry: false
      });

      const result = await qrService.validateQRToken(mockSessionId, mockToken, mockSessionCallback);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid session');
      expect(result.code).toBe('INVALID_TOKEN');
      expect(result.canRetry).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    test('should generate token with default length', () => {
      const token = qrService.generateSecureToken();
      
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes * 2 (hex encoding)
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    test('should generate token with custom length', () => {
      const token = qrService.generateSecureToken(16);
      
      expect(typeof token).toBe('string');
      expect(token.length).toBe(32); // 16 bytes * 2 (hex encoding)
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    test('should generate different tokens on multiple calls', () => {
      const token1 = qrService.generateSecureToken();
      const token2 = qrService.generateSecureToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('getTokenExpiry', () => {
    test('should return expiry time with default duration', () => {
      const before = Date.now();
      const expiry = qrService.getTokenExpiry();
      const after = Date.now();
      
      const expiryTime = new Date(expiry).getTime();
      expect(expiryTime).toBeGreaterThanOrEqual(before + 29000);
      expect(expiryTime).toBeLessThanOrEqual(after + 31000);
    });

    test('should return expiry time with custom duration', () => {
      const customDuration = 60000; // 1 minute
      const before = Date.now();
      const expiry = qrService.getTokenExpiry(customDuration);
      const after = Date.now();
      
      const expiryTime = new Date(expiry).getTime();
      expect(expiryTime).toBeGreaterThanOrEqual(before + customDuration - 1000);
      expect(expiryTime).toBeLessThanOrEqual(after + customDuration + 1000);
    });
  });

  describe('isTokenExpired', () => {
    test('should return true for expired timestamp', () => {
      const pastTime = new Date(Date.now() - 1000).toISOString();
      expect(qrService.isTokenExpired(pastTime)).toBe(true);
    });

    test('should return false for future timestamp', () => {
      const futureTime = new Date(Date.now() + 1000).toISOString();
      expect(qrService.isTokenExpired(futureTime)).toBe(false);
    });

    test('should return true for null or undefined timestamp', () => {
      expect(qrService.isTokenExpired(null)).toBe(true);
      expect(qrService.isTokenExpired(undefined)).toBe(true);
      expect(qrService.isTokenExpired('')).toBe(true);
    });
  });

  describe('getActiveRotations', () => {
    test('should return empty array when no rotations are active', () => {
      const rotations = qrService.getActiveRotations();
      expect(rotations).toEqual([]);
    });

    test('should return list of active rotations', () => {
      const mockTokenCallback = jest.fn().mockResolvedValue({
        success: true,
        qrData: { token: 'new-token-123' }
      });
      const mockQRCallback = jest.fn();

      qrService.startQRRotation('session1', mockTokenCallback, mockQRCallback, 100);
      qrService.startQRRotation('session2', mockTokenCallback, mockQRCallback, 200);

      const rotations = qrService.getActiveRotations();
      
      expect(rotations).toHaveLength(2);
      expect(rotations[0].sessionId).toBe('session1');
      expect(rotations[0].intervalMs).toBe(100);
      expect(rotations[1].sessionId).toBe('session2');
      expect(rotations[1].intervalMs).toBe(200);
    });
  });

  describe('setBaseUrl and getBaseUrl', () => {
    test('should update and retrieve base URL', () => {
      const newUrl = 'https://newdomain.com';
      qrService.setBaseUrl(newUrl);
      
      expect(qrService.getBaseUrl()).toBe(newUrl);
    });

    test('should affect QR code generation URL', async () => {
      const newUrl = 'https://production.com';
      qrService.setBaseUrl(newUrl);
      
      const result = await qrService.generateQRCode(mockSessionId, mockToken);
      
      expect(result.qrData.url).toBe(`${newUrl}/attend/${mockSessionId}?token=${mockToken}`);
    });
  });
});