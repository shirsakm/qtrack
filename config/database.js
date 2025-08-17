const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Database {
  constructor() {
    this.db = null;
  }

  // Initialize database connection
  async connect() {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, '..', 'attendance.db');
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  // Initialize database schema
  async initializeSchema() {
    const queries = [
      // Sessions table
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        faculty_id TEXT NOT NULL,
        course_name TEXT NOT NULL,
        course_code TEXT NOT NULL,
        section TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        is_active BOOLEAN DEFAULT 1,
        current_token TEXT,
        token_expiry DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Students table (hardcoded data)
      `CREATE TABLE IF NOT EXISTS students (
        roll_number TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        branch TEXT NOT NULL,
        year TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Attendance table
      `CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        student_email TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions (id),
        FOREIGN KEY (student_email) REFERENCES students (email),
        UNIQUE(session_id, student_email)
      )`
    ];

    for (const query of queries) {
      await this.run(query);
    }
  }

  // Insert hardcoded student data
  async insertHardcodedStudents() {
    const students = [
      {
        roll_number: '2451075',
        email: 'shirsak.majumder.cse28@heritageit.edu.in',
        name: 'Shirsak Majumder',
        branch: 'CSE',
        year: '2028'
      },
      {
        roll_number: '2451076',
        email: 'rohit.kumardebnath.cse28@heritageit.edu.in',
        name: 'Rohit Kumar Debnath',
        branch: 'CSE',
        year: '2028'
      },
      {
        roll_number: '2451077',
        email: 'shaista.meher.cse28@heritageit.edu.in',
        name: 'Shaista Meher',
        branch: 'CSE',
        year: '2028'
      },
      {
        roll_number: '2451078',
        email: 'anirban.roy.cse28@heritageit.edu.in',
        name: 'Anirban Roy',
        branch: 'CSE',
        year: '2028'
      },
      {
        roll_number: '2451079',
        email: 'john.doe.cse28@heritageit.edu.in',
        name: 'John Doe',
        branch: 'CSE',
        year: '2028'
      },
      {
        roll_number: '2351080',
        email: 'jane.smith.ece27@heritageit.edu.in',
        name: 'Jane Smith',
        branch: 'ECE',
        year: '2027'
      },
      {
        roll_number: '2251081',
        email: 'mike.johnson.me26@heritageit.edu.in',
        name: 'Mike Johnson',
        branch: 'ME',
        year: '2026'
      },
      {
        roll_number: '2451082',
        email: 'sarah.wilson.cse28@heritageit.edu.in',
        name: 'Sarah Wilson',
        branch: 'CSE',
        year: '2028'
      }
    ];

    const insertQuery = `
      INSERT OR IGNORE INTO students (roll_number, email, name, branch, year)
      VALUES (?, ?, ?, ?, ?)
    `;

    for (const student of students) {
      await this.run(insertQuery, [
        student.roll_number,
        student.email,
        student.name,
        student.branch,
        student.year
      ]);
    }
  }

  // Generic database operations
  async run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Close database connection
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;