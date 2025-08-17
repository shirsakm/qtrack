const DatabaseService = require('../services/DatabaseService');

async function verifyDatabase() {
  try {
    console.log('Verifying database setup...\n');
    
    await DatabaseService.initialize();
    
    // Get database statistics
    const stats = await DatabaseService.getStats();
    console.log('Database Statistics:');
    console.log(`- Students: ${stats.students}`);
    console.log(`- Sessions: ${stats.sessions}`);
    console.log(`- Attendance Records: ${stats.attendanceRecords}\n`);
    
    // Verify student data
    const studentModel = DatabaseService.getStudentModel();
    const students = await studentModel.findAll();
    
    console.log('Hardcoded Students:');
    students.forEach((student, index) => {
      console.log(`${index + 1}. ${student.name}`);
      console.log(`   Email: ${student.email}`);
      console.log(`   Roll: ${student.roll_number}`);
      console.log(`   Branch: ${student.branch}, Year: ${student.year}\n`);
    });
    
    // Verify required test student
    const testStudent = await studentModel.findByEmail('shirsak.majumder.cse28@heritageit.edu.in');
    if (testStudent) {
      console.log('✅ Required test student found: shirsak.majumder.cse28@heritageit.edu.in');
    } else {
      console.log('❌ Required test student NOT found');
    }
    
    // Test email validation
    console.log('\nEmail Validation Tests:');
    const testEmails = [
      'shirsak.majumder.cse28@heritageit.edu.in',
      'john.doe.ece27@heritageit.edu.in',
      'invalid.email@gmail.com',
      'invalid@heritageit.edu.in'
    ];
    
    testEmails.forEach(email => {
      const isValid = studentModel.constructor.validateEmailPattern(email);
      console.log(`${isValid ? '✅' : '❌'} ${email}`);
    });
    
    // Health check
    const health = await DatabaseService.healthCheck();
    console.log(`\nDatabase Health: ${health.status === 'healthy' ? '✅' : '❌'} ${health.status}`);
    
    console.log('\n✅ Database verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    process.exit(1);
  } finally {
    await DatabaseService.close();
  }
}

// Run verification
verifyDatabase();