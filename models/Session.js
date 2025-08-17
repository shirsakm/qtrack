const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class Session {
  constructor(database) {
    this.db = database;
  }

  // Create a new session with automatic activation
  async create(sessionData) {
    const id = uuidv4();
    const startTime = new Date().toISOString();
    
    // Generate initial token if not provided
    const token = sessionData.currentToken || this.generateSecureToken();
    const tokenExpiry = sessionData.tokenExpiry || this.getTokenExpiry();
    
    const query = `
      INSERT INTO sessions (id, faculty_id, course_name, course_code, section, start_time, current_token, token_expiry, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;
    
    const params = [
      id,
      sessionData.facultyId,
      sessionData.courseName,
      sessionData.courseCode,
      sessionData.section,
      startTime,
      token,
      tokenExpiry
    ];

    await this.db.run(query, params);
    return this.findById(id);
  }

  // Find session by ID
  async findById(id) {
    const query = 'SELECT * FROM sessions WHERE id = ?';
    return await this.db.get(query, [id]);
  }

  // Find active sessions
  async findActive() {
    const query = 'SELECT * FROM sessions WHERE is_active = 1';
    return await this.db.all(query);
  }

  // Update session
  async update(id, updateData) {
    const fields = [];
    const params = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(updateData[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id);
    const query = `UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`;
    
    const result = await this.db.run(query, params);
    if (result.changes === 0) {
      throw new Error('Session not found');
    }
    
    return this.findById(id);
  }

  // End session
  async endSession(id) {
    const updateData = {
      is_active: 0,
      end_time: new Date().toISOString(),
      current_token: null,
      token_expiry: null
    };
    
    return await this.update(id, updateData);
  }

  // Update session token
  async updateToken(id, token, expiry) {
    const updateData = {
      current_token: token,
      token_expiry: expiry
    };
    
    return await this.update(id, updateData);
  }

  // Check if session is active
  async isActive(id) {
    const session = await this.findById(id);
    return session ? session.is_active === 1 : false;
  }

  // Validate session and token
  async validateSessionToken(sessionId, token) {
    const session = await this.findById(sessionId);
    
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }
    
    if (!session.is_active) {
      return { valid: false, reason: 'Session is not active' };
    }
    
    if (!session.current_token || session.current_token !== token) {
      return { valid: false, reason: 'Invalid token' };
    }
    
    if (this.isTokenExpired(session.token_expiry)) {
      return { valid: false, reason: 'Token expired' };
    }
    
    return { valid: true, session };
  }

  // Check if token is expired
  isTokenExpired(tokenExpiry) {
    if (!tokenExpiry) return true;
    return new Date(tokenExpiry) <= new Date();
  }

  // Generate cryptographically secure token
  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Get token expiry time (30 seconds from now)
  getTokenExpiry() {
    return new Date(Date.now() + 30000).toISOString();
  }

  // Activate session
  async activate(id) {
    const updateData = {
      is_active: 1,
      current_token: this.generateSecureToken(),
      token_expiry: this.getTokenExpiry()
    };
    
    return await this.update(id, updateData);
  }

  // Deactivate session (without ending)
  async deactivate(id) {
    const updateData = {
      is_active: 0,
      current_token: null,
      token_expiry: null
    };
    
    return await this.update(id, updateData);
  }

  // Rotate token for active session
  async rotateToken(id) {
    const session = await this.findById(id);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    if (!session.is_active) {
      throw new Error('Cannot rotate token for inactive session');
    }
    
    const newToken = this.generateSecureToken();
    const newExpiry = this.getTokenExpiry();
    
    return await this.updateToken(id, newToken, newExpiry);
  }

  // Get session with attendance count
  async getSessionWithStats(id) {
    const query = `
      SELECT s.*, 
             COUNT(a.id) as attendance_count
      FROM sessions s
      LEFT JOIN attendance a ON s.id = a.session_id
      WHERE s.id = ?
      GROUP BY s.id
    `;
    
    return await this.db.get(query, [id]);
  }

  // Find sessions by faculty
  async findByFaculty(facultyId) {
    const query = 'SELECT * FROM sessions WHERE faculty_id = ? ORDER BY created_at DESC';
    return await this.db.all(query, [facultyId]);
  }

  // Find active sessions by faculty
  async findActiveByfaculty(facultyId) {
    const query = 'SELECT * FROM sessions WHERE faculty_id = ? AND is_active = 1 ORDER BY created_at DESC';
    return await this.db.all(query, [facultyId]);
  }

  // Clean up expired tokens
  async cleanupExpiredTokens() {
    const now = new Date().toISOString();
    const query = `
      UPDATE sessions 
      SET current_token = NULL, token_expiry = NULL 
      WHERE token_expiry <= ? AND is_active = 1
    `;
    
    const result = await this.db.run(query, [now]);
    return result.changes;
  }

  // Delete session (for testing purposes)
  async delete(id) {
    const query = 'DELETE FROM sessions WHERE id = ?';
    const result = await this.db.run(query, [id]);
    return result.changes > 0;
  }

  // Get all sessions
  async findAll() {
    const query = 'SELECT * FROM sessions ORDER BY created_at DESC';
    return await this.db.all(query);
  }
}

module.exports = Session;