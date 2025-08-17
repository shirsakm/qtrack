const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const databaseService = require('../services/DatabaseService');
const Student = require('../models/Student');
const { csrfProtection, basicSecurityHeaders } = require('../middleware/security');

const router = express.Router();

// Initialize services when needed
let studentModel;

const initializeServices = async () => {
  if (!databaseService.isInitialized) {
    await databaseService.initialize();
  }
  
  if (!studentModel) {
    studentModel = new Student(databaseService.getDatabase());
  }
};

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Initialize services
    await initializeServices();
    
    // Extract email from Google profile
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    console.log('🔍 OAuth Debug - Email from Google:', email);
    
    if (!email) {
      console.log('❌ OAuth Debug - No email found in Google profile');
      return done(null, false, { message: 'No email found in Google profile' });
    }

    // Validate email pattern for heritageit.edu.in domain
    const isValidPattern = Student.validateEmailPattern(email);
    console.log('🔍 OAuth Debug - Email pattern valid:', isValidPattern);
    
    if (!isValidPattern) {
      console.log('❌ OAuth Debug - Invalid email pattern:', email);
      return done(null, false, { 
        message: 'Invalid email format. Must be firstname.lastname.branchyear@heritageit.edu.in' 
      });
    }

    // Check if student exists in database
    const studentExists = await studentModel.exists(email);
    console.log('🔍 OAuth Debug - Student exists in DB:', studentExists);
    
    if (!studentExists) {
      console.log('❌ OAuth Debug - Student not found in database:', email);
      return done(null, false, { 
        message: 'Student not found in database. Please contact administration.' 
      });
    }

    // Get student details
    const student = await studentModel.findByEmail(email);
    console.log('🔍 OAuth Debug - Student found:', student ? student.name : 'null');
    
    // Create user object for session
    const user = {
      id: student.roll_number, // Use roll number as ID
      email: student.email,
      name: student.name,
      rollNumber: student.roll_number,
      branch: student.branch,
      year: student.year,
      googleId: profile.id
    };

    console.log('✅ OAuth Debug - Authentication successful for:', user.name);
    return done(null, user);
  } catch (error) {
    console.error('❌ OAuth authentication error:', error);
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.email); // Use email as the identifier
});

// Deserialize user from session
passport.deserializeUser(async (email, done) => {
  try {
    await initializeServices();
    const student = await studentModel.findByEmail(email);
    if (student) {
      const user = {
        id: student.roll_number, // Use roll number as ID
        email: student.email,
        name: student.name,
        rollNumber: student.roll_number,
        branch: student.branch,
        year: student.year
      };
      done(null, user);
    } else {
      done(null, false);
    }
  } catch (error) {
    done(error, null);
  }
});

// Routes

// Initiate Google OAuth
router.get('/google', basicSecurityHeaders,
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// Google OAuth callback
router.get('/google/callback', basicSecurityHeaders,
  passport.authenticate('google', { 
    failureRedirect: '/auth/failure',
    failureFlash: true 
  }),
  (req, res) => {
    // Successful authentication
    console.log('🔍 OAuth Callback Debug - State:', req.query.state);
    console.log('🔍 OAuth Callback Debug - Pending Session:', req.session.pendingSessionId);
    console.log('🔍 OAuth Callback Debug - Pending Token:', req.session.pendingToken);
    
    // Check if there's a session parameter to redirect to attendance marking
    const sessionId = req.query.state || req.session.pendingSessionId;
    const token = req.session.pendingToken;
    
    if (sessionId) {
      // Clear the pending session from session storage
      delete req.session.pendingSessionId;
      delete req.session.pendingToken;
      
      // Redirect to attendance submission with both session and token
      if (token) {
        console.log('✅ OAuth Callback Debug - Redirecting to attendance submit');
        res.redirect(`/attendance/submit?session=${sessionId}&token=${token}`);
      } else {
        console.log('✅ OAuth Callback Debug - Redirecting to attendance mark');
        res.redirect(`/attendance/mark?session=${sessionId}`);
      }
    } else {
      // No specific session, create a simple success page instead of JSON
      console.log('✅ OAuth Callback Debug - No session, showing success page');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            .success { color: #4CAF50; font-size: 24px; margin-bottom: 20px; }
            .info { color: #666; margin-bottom: 30px; }
            .close-btn { background: #2196F3; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="success">✅ Authentication Successful!</div>
          <div class="info">
            Welcome, ${req.user.name}<br>
            Roll Number: ${req.user.rollNumber}<br>
            Email: ${req.user.email}
          </div>
          <button class="close-btn" onclick="window.close()">Close</button>
          <script>setTimeout(() => window.close(), 5000);</script>
        </body>
        </html>
      `);
    }
  }
);

// Authentication success page
router.get('/success', basicSecurityHeaders, (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/failure');
  }
  
  res.json({
    success: true,
    message: 'Authentication successful',
    user: {
      name: req.user.name,
      email: req.user.email,
      rollNumber: req.user.rollNumber,
      branch: req.user.branch,
      year: req.user.year
    }
  });
});

// Authentication failure page
router.get('/failure', basicSecurityHeaders, (req, res) => {
  const message = req.flash('error')[0] || 'Authentication failed';
  const sessionId = req.query.session || req.session.pendingSessionId;
  const token = req.query.token || req.session.pendingToken;
  
  // Clear pending session data
  delete req.session.pendingSessionId;
  delete req.session.pendingToken;
  
  // Redirect to error page
  const errorUrl = `/attendance-error.html?code=AUTH_FAILED&message=${encodeURIComponent(message)}&session=${sessionId || ''}&token=${token || ''}`;
  res.redirect(errorUrl);
});

// Logout route
router.post('/logout', basicSecurityHeaders, csrfProtection, (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: 'Error during logout'
        }
      });
    }
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'SESSION_DESTROY_ERROR',
            message: 'Error destroying session'
          }
        });
      }
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });
});

// Check authentication status
router.get('/status', basicSecurityHeaders, (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        name: req.user.name,
        email: req.user.email,
        rollNumber: req.user.rollNumber,
        branch: req.user.branch,
        year: req.user.year
      }
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    }
  });
};

// Export router and middleware
module.exports = {
  router,
  requireAuth,
  passport
};