#!/usr/bin/env node

/**
 * QR Code Service Demo Script
 * 
 * This script demonstrates the QR code generation and rotation functionality
 * integrated with the session management system.
 */

const Database = require('../config/database');
const SessionService = require('../services/SessionService');

async function runQRDemo() {
  console.log('🚀 Starting QR Code Service Demo...\n');

  // Initialize database
  const db = new Database();
  await db.connect();
  await db.initializeSchema();

  // Initialize session service with QR code integration
  const sessionService = new SessionService(db, 'http://localhost:3000');

  try {
    // 1. Create a new session
    console.log('📚 Creating a new attendance session...');
    const sessionData = {
      facultyId: 'demo-faculty-123',
      courseName: 'Advanced Data Structures',
      courseCode: 'CSE301',
      section: 'A'
    };

    const sessionResult = await sessionService.startSession(sessionData);
    
    if (!sessionResult.success) {
      throw new Error(`Failed to create session: ${sessionResult.error}`);
    }

    console.log('✅ Session created successfully!');
    console.log(`   Session ID: ${sessionResult.session.id}`);
    console.log(`   Course: ${sessionResult.session.course_name} (${sessionResult.session.course_code})`);
    console.log(`   Section: ${sessionResult.session.section}`);
    console.log(`   Started at: ${sessionResult.session.start_time}\n`);

    // 2. Display initial QR code information
    console.log('🔗 Initial QR Code Generated:');
    console.log(`   URL: ${sessionResult.qrData.url}`);
    console.log(`   Token: ${sessionResult.qrData.token.substring(0, 16)}...`);
    console.log(`   Expires at: ${sessionResult.qrData.expiresAt}`);
    console.log(`   QR Code Data URL length: ${sessionResult.qrData.qrCodeDataUrl.length} characters`);
    console.log(`   QR Code SVG length: ${sessionResult.qrData.qrCodeSvg.length} characters\n`);

    // 3. Demonstrate token rotation
    console.log('🔄 Rotating QR token...');
    const rotationResult = await sessionService.rotateQRToken(
      sessionResult.session.id,
      sessionData.facultyId
    );

    if (!rotationResult.success) {
      throw new Error(`Failed to rotate token: ${rotationResult.error}`);
    }

    console.log('✅ Token rotated successfully!');
    console.log(`   New URL: ${rotationResult.qrData.url}`);
    console.log(`   New Token: ${rotationResult.qrData.token.substring(0, 16)}...`);
    console.log(`   New Expiry: ${rotationResult.qrData.expiresAt}\n`);

    // 4. Demonstrate automatic rotation setup
    console.log('⚡ Setting up automatic QR rotation (demo for 5 seconds)...');
    
    let rotationCount = 0;
    const qrUpdateCallback = (sessionId, qrData) => {
      rotationCount++;
      console.log(`   🔄 Rotation #${rotationCount} at ${new Date().toISOString()}`);
      console.log(`      New Token: ${qrData.token.substring(0, 16)}...`);
      console.log(`      Expires: ${qrData.expiresAt}`);
    };

    const autoRotationResult = await sessionService.startQRRotation(
      sessionResult.session.id,
      sessionData.facultyId,
      qrUpdateCallback
    );

    if (!autoRotationResult.success) {
      throw new Error(`Failed to start auto rotation: ${autoRotationResult.error}`);
    }

    console.log('✅ Automatic rotation started!\n');

    // Wait for a few rotations
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Stop automatic rotation
    console.log('\n🛑 Stopping automatic rotation...');
    const stopResult = sessionService.stopQRRotation(sessionResult.session.id);
    console.log(`✅ Rotation stopped: ${stopResult.message}\n`);

    // 6. Check rotation status
    console.log('📊 Checking rotation status...');
    const statusResult = sessionService.getQRRotationStatus(sessionResult.session.id);
    console.log(`   Active: ${statusResult.isActive}`);
    console.log(`   Session ID: ${statusResult.sessionId}\n`);

    // 7. Demonstrate token validation
    console.log('🔍 Testing token validation...');
    const currentSession = await sessionService.getSessionStatus(
      sessionResult.session.id,
      sessionData.facultyId
    );

    if (currentSession.success && currentSession.qrData) {
      const validationResult = await sessionService.validateAttendanceToken(
        sessionResult.session.id,
        currentSession.qrData.token
      );

      console.log(`   Validation result: ${validationResult.success ? '✅ Valid' : '❌ Invalid'}`);
      if (!validationResult.success) {
        console.log(`   Error: ${validationResult.error}`);
      }
    }

    // 8. Test with expired token
    console.log('\n⏰ Testing with expired token...');
    const expiredValidation = await sessionService.validateAttendanceToken(
      sessionResult.session.id,
      'expired-token-123'
    );
    console.log(`   Expired token validation: ${expiredValidation.success ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`   Error: ${expiredValidation.error}\n`);

    // 9. End the session
    console.log('🏁 Ending the session...');
    const endResult = await sessionService.endSession(
      sessionResult.session.id,
      sessionData.facultyId
    );

    if (endResult.success) {
      console.log('✅ Session ended successfully!');
      console.log(`   Ended at: ${endResult.session.end_time}`);
    }

    console.log('\n🎉 QR Code Service Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  } finally {
    // Cleanup
    await db.close();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  runQRDemo().catch(console.error);
}

module.exports = { runQRDemo };