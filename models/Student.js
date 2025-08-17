class Student {
  constructor(database) {
    this.db = database;
  }

  // Find student by email
  async findByEmail(email) {
    const query = 'SELECT * FROM students WHERE email = ?';
    return await this.db.get(query, [email]);
  }

  // Check if student exists
  async exists(email) {
    const student = await this.findByEmail(email);
    return !!student;
  }

  // Get all students
  async findAll() {
    const query = 'SELECT * FROM students ORDER BY name';
    return await this.db.all(query);
  }

  // Find students by branch
  async findByBranch(branch) {
    const query = 'SELECT * FROM students WHERE branch = ? ORDER BY name';
    return await this.db.all(query, [branch]);
  }

  // Find students by year
  async findByYear(year) {
    const query = 'SELECT * FROM students WHERE year = ? ORDER BY name';
    return await this.db.all(query, [year]);
  }

  // Validate email pattern
  static validateEmailPattern(email) {
    // Pattern: firstname.lastname.branchyear@heritageit.edu.in
    const pattern = /^[a-zA-Z]+\.[a-zA-Z]+\.[a-zA-Z]+\d{2}@heritageit\.edu\.in$/;
    return pattern.test(email);
  }

  // Extract branch and year from email
  static extractBranchYear(email) {
    if (!this.validateEmailPattern(email)) {
      return null;
    }

    const parts = email.split('@')[0].split('.');
    if (parts.length !== 3) {
      return null;
    }

    const branchYear = parts[2];
    const branch = branchYear.replace(/\d+$/, '').toUpperCase();
    const year = '20' + branchYear.match(/\d+$/)[0];

    return { branch, year };
  }

  // Get student count
  async getCount() {
    const query = 'SELECT COUNT(*) as count FROM students';
    const result = await this.db.get(query);
    return result.count;
  }

  // Search students by name
  async searchByName(searchTerm) {
    const query = 'SELECT * FROM students WHERE name LIKE ? ORDER BY name';
    return await this.db.all(query, [`%${searchTerm}%`]);
  }
}

module.exports = Student;