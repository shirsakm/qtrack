const { v4: uuidv4 } = require('uuid');

class Attendance {
  constructor(database) {
    this.db = database;
  }

  // Mark attendance for a student
  async markAttendance(sessionId, studentEmail, metadata = {}) {
    const id = uuidv4();
    const query = `
      INSERT INTO attendance (id, session_id, student_email, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const params = [
      id,
      sessionId,
      studentEmail,
      metadata.ipAddress || null,
      metadata.userAgent || null
    ];

    try {
      await this.db.run(query, params);
      return this.findById(id);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Attendance already marked for this session');
      }
      throw error;
    }
  }

  // Find attendance record by ID
  async findById(id) {
    const query = `
      SELECT a.*, s.name as student_name 
      FROM attendance a
      LEFT JOIN students s ON a.student_email = s.email
      WHERE a.id = ?
    `;
    return await this.db.get(query, [id]);
  }

  // Check if student has already marked attendance for a session
  async hasMarkedAttendance(sessionId, studentEmail) {
    const query = 'SELECT id FROM attendance WHERE session_id = ? AND student_email = ?';
    const result = await this.db.get(query, [sessionId, studentEmail]);
    return !!result;
  }

  // Get attendance for a specific session
  async getSessionAttendance(sessionId) {
    const query = `
      SELECT a.*, s.name as student_name, s.roll_number, s.branch, s.year
      FROM attendance a
      JOIN students s ON a.student_email = s.email
      WHERE a.session_id = ?
      ORDER BY a.timestamp
    `;
    return await this.db.all(query, [sessionId]);
  }

  // Get attendance count for a session
  async getSessionAttendanceCount(sessionId) {
    const query = 'SELECT COUNT(*) as count FROM attendance WHERE session_id = ?';
    const result = await this.db.get(query, [sessionId]);
    return result.count;
  }

  // Get all students who haven't marked attendance for a session
  async getAbsentStudents(sessionId) {
    const query = `
      SELECT s.*
      FROM students s
      WHERE s.email NOT IN (
        SELECT student_email 
        FROM attendance 
        WHERE session_id = ?
      )
      ORDER BY s.name
    `;
    return await this.db.all(query, [sessionId]);
  }

  // Get attendance summary for a session
  async getSessionSummary(sessionId) {
    const presentQuery = `
      SELECT a.*, s.name as student_name, s.roll_number, s.branch, s.year
      FROM attendance a
      JOIN students s ON a.student_email = s.email
      WHERE a.session_id = ?
      ORDER BY a.timestamp
    `;
    
    const absentQuery = `
      SELECT s.*
      FROM students s
      WHERE s.email NOT IN (
        SELECT student_email 
        FROM attendance 
        WHERE session_id = ?
      )
      ORDER BY s.name
    `;

    const totalStudentsQuery = 'SELECT COUNT(*) as count FROM students';

    const [present, absent, totalResult] = await Promise.all([
      this.db.all(presentQuery, [sessionId]),
      this.db.all(absentQuery, [sessionId]),
      this.db.get(totalStudentsQuery)
    ]);

    const totalStudents = totalResult.count;
    const presentCount = present.length;
    const absentCount = absent.length;
    const attendancePercentage = totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;

    return {
      present,
      absent,
      summary: {
        totalStudents,
        presentCount,
        absentCount,
        attendancePercentage: Math.round(attendancePercentage * 100) / 100
      }
    };
  }

  // Delete attendance record (for testing purposes)
  async delete(id) {
    const query = 'DELETE FROM attendance WHERE id = ?';
    const result = await this.db.run(query, [id]);
    return result.changes > 0;
  }

  // Get attendance by student email
  async getStudentAttendance(studentEmail) {
    const query = `
      SELECT a.*, ses.course_name, ses.course_code, ses.section, ses.start_time
      FROM attendance a
      JOIN sessions ses ON a.session_id = ses.id
      WHERE a.student_email = ?
      ORDER BY a.timestamp DESC
    `;
    return await this.db.all(query, [studentEmail]);
  }

  // Get recent attendance records
  async getRecentAttendance(limit = 10) {
    const query = `
      SELECT a.*, s.name as student_name, ses.course_name, ses.course_code
      FROM attendance a
      JOIN students s ON a.student_email = s.email
      JOIN sessions ses ON a.session_id = ses.id
      ORDER BY a.timestamp DESC
      LIMIT ?
    `;
    return await this.db.all(query, [limit]);
  }
}

module.exports = Attendance;