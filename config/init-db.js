const Database = require('./database');

async function initializeDatabase() {
  const db = new Database();
  
  try {
    console.log('Initializing database...');
    
    // Connect to database
    await db.connect();
    
    // Create tables
    console.log('Creating database schema...');
    await db.initializeSchema();
    
    // Insert hardcoded student data
    console.log('Inserting hardcoded student data...');
    await db.insertHardcodedStudents();
    
    console.log('Database initialization completed successfully!');
    
    // Verify data insertion
    const students = await db.all('SELECT * FROM students');
    console.log(`Inserted ${students.length} students:`);
    students.forEach(student => {
      console.log(`- ${student.name} (${student.email})`);
    });
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database setup complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };