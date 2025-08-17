const Database = require('../config/database');
const Session = require('../models/Session');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const fs = require('fs');
const path = require('path');

describe('Database Operations', () => {
  let db;
  let sessionModel;
  let studentModel;
  let attendanceModel;

  beforeAll(async () => {
    // Use in-memory database for testing
    db = new Database();
    // Override the database path for testing
    db.connect = () => {
      return new Promise((resolve, reject) => {
        const sqlite3 = require('sqlite3').verbose();
        db.db = new sqlite3.Database(':memory:', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    };

    await db.connect();
    await db.initializeSchema();
    await db.insertHardcodedStudents();

    sessionModel = new Session(db);
    studentModel = new Student(db);
    attendanceModel = new Attendance(db);
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Database Connection and Schema', () => {
    test('should connect to database successfully', async () => {
      expect(db.db).toBeDefined();
    });

    test('should create all required tables', async () => {
      const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
      const tableNames = tables.map(t => t.name);
      
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('students');
      expect(tableNames).toContain('attendance');
    });

    test('should insert hardcoded student data', async () => {
      const students = await db.all('SELECT * FROM students');
      expect(students.length).toBeGreaterThan(0);
      
      // Check if the required test student exists
      const testStudent = students.find(s => s.email === 'shirsak.majumder.cse28@heritageit.edu.in');
      expect(testStudent).toBeDefined();
      expect(testStudent.name).toBe('Shirsak Majumder');
    });
  });

  describe('Student Model', () => {
    test('should find student by email', async () => {
      const student = await studentModel.findByEmail('shirsak.majumder.cse28@heritageit.edu.in');
      expect(student).toBeDefined();
      expect(student.name).toBe('Shirsak Majumder');
      expect(student.branch).toBe('CSE');
    });

    test('should check if student exists', async () => {
      const exists = await studentModel.exists('shirsak.majumder.cse28@heritageit.edu.in');
      expect(exists).toBe(true);

      const notExists = await studentModel.exists('nonexistent@heritageit.edu.in');
      expect(notExists).toBe(false);
    });

    test('should validate email pattern', () => {
      expect(Student.validateEmailPattern('shirsak.majumder.cse28@heritageit.edu.in')).toBe(true);
      expect(Student.validateEmailPattern('john.doe.ece27@heritageit.edu.in')).toBe(true);
      expect(Student.validateEmailPattern('invalid.email@gmail.com')).toBe(false);
      expect(Student.validateEmailPattern('invalid@heritageit.edu.in')).toBe(false);
    });

    test('should extract branch and year from email', () => {
      const result = Student.extractBranchYear('shirsak.majumder.cse28@heritageit.edu.in');
      expect(result).toEqual({ branch: 'CSE', year: '2028' });

      const result2 = Student.extractBranchYear('jane.smith.ece27@heritageit.edu.in');
      expect(result2).toEqual({ branch: 'ECE', year: '2027' });
    });

    test('should get all students', async () => {
      const students = await studentModel.findAll();
      expect(students.length).toBeGreaterThan(0);
      expect(students[0]).toHaveProperty('email');
      expect(students[0]).toHaveProperty('name');
    });

    test('should find students by branch', async () => {
      const cseStudents = await studentModel.findByBranch('CSE');
      expect(cseStudents.length).toBeGreaterThan(0);
      cseStudents.forEach(student => {
        expect(student.branch).toBe('CSE');
      });
    });
  });

  describe('Session Model', () => {
    let testSessionId;

    test('should create a new session', async () => {
      const sessionData = {
        facultyId: 'faculty123',
        courseName: 'Data Structures',
        courseCode: 'CSE201',
        section: 'A',
        currentToken: 'test-token-123',
        tokenExpiry: new Date(Date.now() + 30000).toISOString()
      };

      const session = await sessionModel.create(sessionData);
      testSessionId = session.id;

      expect(session).toBeDefined();
      expect(session.faculty_id).toBe('faculty123');
      expect(session.course_name).toBe('Data Structures');
      expect(session.is_active).toBe(1);
    });

    test('should find session by ID', async () => {
      const session = await sessionModel.findById(testSessionId);
      expect(session).toBeDefined();
      expect(session.id).toBe(testSessionId);
    });

    test('should check if session is active', async () => {
      const isActive = await sessionModel.isActive(testSessionId);
      expect(isActive).toBe(true);
    });

    test('should update session token', async () => {
      const newToken = 'new-token-456';
      const newExpiry = new Date(Date.now() + 30000).toISOString();
      
      const updatedSession = await sessionModel.updateToken(testSessionId, newToken, newExpiry);
      expect(updatedSession.current_token).toBe(newToken);
    });

    test('should end session', async () => {
      const endedSession = await sessionModel.endSession(testSessionId);
      expect(endedSession.is_active).toBe(0);
      expect(endedSession.end_time).toBeDefined();
    });

    test('should find active sessions', async () => {
      // Create a new active session
      const sessionData = {
        facultyId: 'faculty456',
        courseName: 'Algorithms',
        courseCode: 'CSE301',
        section: 'B',
        currentToken: 'active-token',
        tokenExpiry: new Date(Date.now() + 30000).toISOString()
      };

      await sessionModel.create(sessionData);
      const activeSessions = await sessionModel.findActive();
      expect(activeSessions.length).toBeGreaterThan(0);
    });
  });

  describe('Attendance Model', () => {
    let testSessionId;
    let testStudentEmail;

    beforeAll(async () => {
      // Create a test session
      const sessionData = {
        facultyId: 'faculty789',
        courseName: 'Database Systems',
        courseCode: 'CSE401',
        section: 'A',
        currentToken: 'attendance-token',
        tokenExpiry: new Date(Date.now() + 30000).toISOString()
      };

      const session = await sessionModel.create(sessionData);
      testSessionId = session.id;
      testStudentEmail = 'shirsak.majumder.cse28@heritageit.edu.in';
    });

    test('should mark attendance for a student', async () => {
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      };

      const attendance = await attendanceModel.markAttendance(testSessionId, testStudentEmail, metadata);
      expect(attendance).toBeDefined();
      expect(attendance.session_id).toBe(testSessionId);
      expect(attendance.student_email).toBe(testStudentEmail);
      expect(attendance.ip_address).toBe(metadata.ipAddress);
    });

    test('should prevent duplicate attendance marking', async () => {
      await expect(
        attendanceModel.markAttendance(testSessionId, testStudentEmail)
      ).rejects.toThrow('Attendance already marked for this session');
    });

    test('should check if student has marked attendance', async () => {
      const hasMarked = await attendanceModel.hasMarkedAttendance(testSessionId, testStudentEmail);
      expect(hasMarked).toBe(true);

      const hasNotMarked = await attendanceModel.hasMarkedAttendance(testSessionId, 'john.doe.cse28@heritageit.edu.in');
      expect(hasNotMarked).toBe(false);
    });

    test('should get session attendance', async () => {
      const attendance = await attendanceModel.getSessionAttendance(testSessionId);
      expect(attendance.length).toBe(1);
      expect(attendance[0].student_email).toBe(testStudentEmail);
      expect(attendance[0].student_name).toBe('Shirsak Majumder');
    });

    test('should get attendance count for session', async () => {
      const count = await attendanceModel.getSessionAttendanceCount(testSessionId);
      expect(count).toBe(1);
    });

    test('should get absent students', async () => {
      const absentStudents = await attendanceModel.getAbsentStudents(testSessionId);
      expect(absentStudents.length).toBeGreaterThan(0);
      
      // Should not include the student who marked attendance
      const absentEmails = absentStudents.map(s => s.email);
      expect(absentEmails).not.toContain(testStudentEmail);
    });

    test('should get session attendance summary', async () => {
      const summary = await attendanceModel.getSessionSummary(testSessionId);
      
      expect(summary).toHaveProperty('present');
      expect(summary).toHaveProperty('absent');
      expect(summary).toHaveProperty('summary');
      
      expect(summary.present.length).toBe(1);
      expect(summary.absent.length).toBeGreaterThan(0);
      expect(summary.summary.presentCount).toBe(1);
      expect(summary.summary.totalStudents).toBeGreaterThan(1);
      expect(summary.summary.attendancePercentage).toBeGreaterThan(0);
    });
  });

  describe('Database Error Handling', () => {
    test('should handle invalid queries gracefully', async () => {
      await expect(db.run('INVALID SQL QUERY')).rejects.toThrow();
    });

    test('should handle non-existent records', async () => {
      const session = await sessionModel.findById('non-existent-id');
      expect(session).toBeUndefined();
    });

    test('should handle updates to non-existent records', async () => {
      await expect(
        sessionModel.update('non-existent-id', { course_name: 'Updated Course' })
      ).rejects.toThrow('Session not found');
    });
  });
});