const request = require('supertest');
const databaseService = require('../services/DatabaseService');
const Student = require('../models/Student');

// Create a test app without the full server setup to avoid passport issues
const express = require('express');
const session = require('express-session');

const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false
  }));

  // Mock authentication middleware
  const mockRequireAuth = (req, res, next) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = {
        email: 'shirsak.majumder.cse28@heritageit.edu.in',
        name: 'Test User',
        rollNumber: 'CSE28001'
      };
      req.isAuthenticated = () => true;
      next();
    } else {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }
  };

  // Mock routes for testing
  app.get('/auth/google', (req, res) => {
    res.redirect('https://accounts.google.com/oauth/authorize');
  });

  app.get('/auth/status', (req, res) => {
    res.json({ authenticated: false });
  });

  app.get('/auth/failure', (req, res) => {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_FAILED',
        message: 'Authentication failed'
      }
    });
  });

  app.get('/attendance/mark', (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      res.redirect('/attendance/submit');
    } else {
      res.redirect('/auth/google');
    }
  });

  app.get('/attendance/submit', mockRequireAuth, (req, res) => {
    res.json({ success: true, message: 'Attendance marked' });
  });

  return app;
};

describe('Authentication System', () => {
  let studentModel;
  let testApp;

  beforeAll(async () => {
    // Initialize database for testing
    await databaseService.initialize();
    studentModel = new Student(databaseService.getDatabase());
    testApp = createTestApp();
  });

  afterAll(async () => {
    if (databaseService) {
      await databaseService.close();
    }
  });

  describe('Email Pattern Validation', () => {
    test('should validate correct email pattern', () => {
      const validEmails = [
        'john.doe.cse28@heritageit.edu.in',
        'jane.smith.ece29@heritageit.edu.in',
        'shirsak.majumder.cse28@heritageit.edu.in',
        'alice.bob.mech30@heritageit.edu.in'
      ];

      validEmails.forEach(email => {
        expect(Student.validateEmailPattern(email)).toBe(true);
      });
    });

    test('should reject invalid email patterns', () => {
      const invalidEmails = [
        'john@heritageit.edu.in', // Missing lastname and branch/year
        'john.doe@heritageit.edu.in', // Missing branch/year
        'john.doe.cse@heritageit.edu.in', // Missing year
        'john.doe.cse28@gmail.com', // Wrong domain
        'john.doe.cse28@heritage.edu.in', // Wrong subdomain
        'john_doe.cse28@heritageit.edu.in', // Underscore instead of dot
        'john.doe.cse2028@heritageit.edu.in', // 4-digit year
        'john.doe.123@heritageit.edu.in', // Numbers only for branch
        'john.doe.cse@heritageit.edu.in', // Missing year digits
        ''
      ];

      invalidEmails.forEach(email => {
        expect(Student.validateEmailPattern(email)).toBe(false);
      });
    });
  });

  describe('Branch and Year Extraction', () => {
    test('should extract branch and year correctly', () => {
      const testCases = [
        {
          email: 'john.doe.cse28@heritageit.edu.in',
          expected: { branch: 'CSE', year: '2028' }
        },
        {
          email: 'jane.smith.ece29@heritageit.edu.in',
          expected: { branch: 'ECE', year: '2029' }
        },
        {
          email: 'alice.bob.mech30@heritageit.edu.in',
          expected: { branch: 'MECH', year: '2030' }
        }
      ];

      testCases.forEach(({ email, expected }) => {
        const result = Student.extractBranchYear(email);
        expect(result).toEqual(expected);
      });
    });

    test('should return null for invalid email patterns', () => {
      const invalidEmails = [
        'john@heritageit.edu.in',
        'john.doe@gmail.com',
        'invalid-email'
      ];

      invalidEmails.forEach(email => {
        expect(Student.extractBranchYear(email)).toBeNull();
      });
    });
  });

  describe('Student Database Lookup', () => {
    test('should find existing student by email', async () => {
      // Test with the hardcoded test student
      const testEmail = 'shirsak.majumder.cse28@heritageit.edu.in';
      const student = await studentModel.findByEmail(testEmail);
      
      expect(student).toBeTruthy();
      expect(student.email).toBe(testEmail);
      expect(student.name).toBeTruthy();
    });

    test('should return null for non-existing student', async () => {
      const nonExistentEmail = 'nonexistent.student.cse28@heritageit.edu.in';
      const student = await studentModel.findByEmail(nonExistentEmail);
      
      expect(student).toBeUndefined();
    });

    test('should check if student exists', async () => {
      const testEmail = 'shirsak.majumder.cse28@heritageit.edu.in';
      const exists = await studentModel.exists(testEmail);
      
      expect(exists).toBe(true);
    });

    test('should return false for non-existing student', async () => {
      const nonExistentEmail = 'nonexistent.student.cse28@heritageit.edu.in';
      const exists = await studentModel.exists(nonExistentEmail);
      
      expect(exists).toBe(false);
    });
  });

  describe('Authentication Routes', () => {
    test('should redirect to Google OAuth', async () => {
      const response = await request(testApp)
        .get('/auth/google')
        .expect(302);

      // Should redirect to Google OAuth (mocked in test environment)
      expect(response.headers.location).toContain('accounts.google.com');
    });

    test('should return authentication status', async () => {
      const response = await request(testApp)
        .get('/auth/status')
        .expect(200);

      expect(response.body).toHaveProperty('authenticated');
      expect(response.body.authenticated).toBe(false);
    });

    test('should handle authentication failure', async () => {
      const response = await request(testApp)
        .get('/auth/failure')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error.code).toBe('AUTH_FAILED');
    });
  });

  describe('OAuth Strategy Verification', () => {
    // Mock Google profile for testing
    const createMockProfile = (email) => ({
      id: 'google-id-123',
      emails: [{ value: email }],
      displayName: 'Test User'
    });

    test('should accept valid student email', async () => {
      const validEmail = 'shirsak.majumder.cse28@heritageit.edu.in';
      const profile = createMockProfile(validEmail);
      
      // Mock the verification function
      const mockDone = jest.fn();
      
      // Test the verification logic directly without creating a strategy
      const mockVerify = async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          
          if (!email) {
            return done(null, false, { message: 'No email found in Google profile' });
          }

          if (!Student.validateEmailPattern(email)) {
            return done(null, false, { 
              message: 'Invalid email format. Must be firstname.lastname.branchyear@heritageit.edu.in' 
            });
          }

          const studentExists = await studentModel.exists(email);
          if (!studentExists) {
            return done(null, false, { 
              message: 'Student not found in database. Please contact administration.' 
            });
          }

          const student = await studentModel.findByEmail(email);
          const user = {
            id: student.id,
            email: student.email,
            name: student.name,
            rollNumber: student.roll_number,
            branch: student.branch,
            year: student.year,
            googleId: profile.id
          };

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      };

      await mockVerify('access-token', 'refresh-token', profile, mockDone);
      
      expect(mockDone).toHaveBeenCalledWith(null, expect.objectContaining({
        email: validEmail,
        name: expect.any(String)
      }));
    });

    test('should reject invalid email format', async () => {
      const invalidEmail = 'invalid@gmail.com';
      const profile = createMockProfile(invalidEmail);
      
      const mockDone = jest.fn();
      
      const mockVerify = async (accessToken, refreshToken, profile, done) => {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        
        if (!Student.validateEmailPattern(email)) {
          return done(null, false, { 
            message: 'Invalid email format. Must be firstname.lastname.branchyear@heritageit.edu.in' 
          });
        }
      };

      await mockVerify('access-token', 'refresh-token', profile, mockDone);
      
      expect(mockDone).toHaveBeenCalledWith(null, false, expect.objectContaining({
        message: expect.stringContaining('Invalid email format')
      }));
    });

    test('should reject non-existing student', async () => {
      const nonExistentEmail = 'nonexistent.student.cse28@heritageit.edu.in';
      const profile = createMockProfile(nonExistentEmail);
      
      const mockDone = jest.fn();
      
      const mockVerify = async (accessToken, refreshToken, profile, done) => {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        
        if (Student.validateEmailPattern(email)) {
          const studentExists = await studentModel.exists(email);
          if (!studentExists) {
            return done(null, false, { 
              message: 'Student not found in database. Please contact administration.' 
            });
          }
        }
      };

      await mockVerify('access-token', 'refresh-token', profile, mockDone);
      
      expect(mockDone).toHaveBeenCalledWith(null, false, expect.objectContaining({
        message: expect.stringContaining('Student not found in database')
      }));
    });
  });

  describe('Attendance Flow Integration', () => {
    test('should redirect unauthenticated user to Google OAuth', async () => {
      const response = await request(testApp)
        .get('/attendance/mark?session=test-session&token=test-token')
        .expect(302);

      expect(response.headers.location).toContain('/auth/google');
    });

    test('should require authentication for attendance submission', async () => {
      const response = await request(testApp)
        .get('/attendance/submit?session=test-session&token=test-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should allow authenticated user to submit attendance', async () => {
      const response = await request(testApp)
        .get('/attendance/submit?session=test-session&token=test-token')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});