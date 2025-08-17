/**
 * Simple Faculty Dashboard Tests
 * Tests basic functionality without complex integration
 */

const request = require('supertest');
const { app } = require('../server');
const fs = require('fs');
const path = require('path');

describe('Faculty Dashboard Simple Tests', () => {
    describe('Static File Serving', () => {
        test('should serve faculty dashboard HTML', async () => {
            const response = await request(app)
                .get('/faculty-dashboard.html')
                .expect(200);

            expect(response.text).toContain('Faculty Attendance Dashboard');
            expect(response.text).toContain('Start Attendance Session');
            expect(response.text).toContain('QR Code');
            expect(response.text).toContain('Real-time Attendance');
            expect(response.text).toContain('socket.io/socket.io.js');
            expect(response.text).toContain('faculty-dashboard.js');
        });

        test('should serve faculty dashboard CSS', async () => {
            const response = await request(app)
                .get('/css/faculty-dashboard.css')
                .expect(200);

            expect(response.text).toContain('.dashboard-container');
            expect(response.text).toContain('.btn-primary');
            expect(response.text).toContain('.qr-container');
            expect(response.text).toContain('.attendance-list');
            expect(response.text).toContain('.loading-overlay');
        });

        test('should serve faculty dashboard JavaScript', async () => {
            const response = await request(app)
                .get('/js/faculty-dashboard.js')
                .expect(200);

            expect(response.text).toContain('FacultyDashboard');
            expect(response.text).toContain('startSession');
            expect(response.text).toContain('endSession');
            expect(response.text).toContain('initializeWebSocket');
            expect(response.text).toContain('updateQRCode');
            expect(response.text).toContain('exportAttendance');
        });
    });

    describe('File Structure Validation', () => {
        test('should have all required frontend files', () => {
            const htmlPath = path.join(__dirname, '../public/faculty-dashboard.html');
            const cssPath = path.join(__dirname, '../public/css/faculty-dashboard.css');
            const jsPath = path.join(__dirname, '../public/js/faculty-dashboard.js');

            expect(fs.existsSync(htmlPath)).toBe(true);
            expect(fs.existsSync(cssPath)).toBe(true);
            expect(fs.existsSync(jsPath)).toBe(true);
        });

        test('should have proper HTML structure', () => {
            const htmlPath = path.join(__dirname, '../public/faculty-dashboard.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');

            // Check for required elements
            expect(htmlContent).toContain('id="sessionForm"');
            expect(htmlContent).toContain('id="startSessionBtn"');
            expect(htmlContent).toContain('id="endSessionBtn"');
            expect(htmlContent).toContain('id="qrContainer"');
            expect(htmlContent).toContain('id="attendanceList"');
            expect(htmlContent).toContain('id="exportBtn"');
            
            // Check for form inputs
            expect(htmlContent).toContain('id="courseName"');
            expect(htmlContent).toContain('id="courseCode"');
            expect(htmlContent).toContain('id="section"');
            
            // Check for attendance display
            expect(htmlContent).toContain('id="presentCount"');
            expect(htmlContent).toContain('id="totalCount"');
            expect(htmlContent).toContain('id="attendancePercentage"');
        });

        test('should have proper CSS classes', () => {
            const cssPath = path.join(__dirname, '../public/css/faculty-dashboard.css');
            const cssContent = fs.readFileSync(cssPath, 'utf8');

            // Check for main layout classes
            expect(cssContent).toContain('.dashboard-container');
            expect(cssContent).toContain('.dashboard-header');
            expect(cssContent).toContain('.dashboard-main');
            
            // Check for component classes
            expect(cssContent).toContain('.session-control');
            expect(cssContent).toContain('.qr-section');
            expect(cssContent).toContain('.attendance-section');
            
            // Check for button styles
            expect(cssContent).toContain('.btn-primary');
            expect(cssContent).toContain('.btn-danger');
            expect(cssContent).toContain('.btn-success');
            expect(cssContent).toContain('.btn-secondary');
            
            // Check for responsive design
            expect(cssContent).toContain('@media (max-width: 768px)');
        });

        test('should have proper JavaScript structure', () => {
            const jsPath = path.join(__dirname, '../public/js/faculty-dashboard.js');
            const jsContent = fs.readFileSync(jsPath, 'utf8');

            // Check for main class
            expect(jsContent).toContain('class FacultyDashboard');
            
            // Check for key methods
            expect(jsContent).toContain('initializeElements()');
            expect(jsContent).toContain('initializeEventListeners()');
            expect(jsContent).toContain('initializeWebSocket()');
            expect(jsContent).toContain('startSession()');
            expect(jsContent).toContain('endSession()');
            expect(jsContent).toContain('updateQRCode(');
            expect(jsContent).toContain('refreshAttendance()');
            expect(jsContent).toContain('exportAttendance()');
            
            // Check for WebSocket handling
            expect(jsContent).toContain('socket.on(\'connect\'');
            expect(jsContent).toContain('socket.on(\'qr-update\'');
            expect(jsContent).toContain('socket.on(\'attendance-update\'');
            
            // Check for API calls
            expect(jsContent).toContain('/api/faculty/sessions/start');
            expect(jsContent).toContain('/api/faculty/sessions/');
            expect(jsContent).toContain('fetch(');
        });
    });

    describe('Content Validation', () => {
        test('should have proper form labels and placeholders', () => {
            const htmlPath = path.join(__dirname, '../public/faculty-dashboard.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');

            expect(htmlContent).toContain('Course Name:');
            expect(htmlContent).toContain('Course Code:');
            expect(htmlContent).toContain('Section:');
            expect(htmlContent).toContain('placeholder="e.g., Computer Networks"');
            expect(htmlContent).toContain('placeholder="e.g., CSE301"');
            expect(htmlContent).toContain('placeholder="e.g., A"');
        });

        test('should have proper button text', () => {
            const htmlPath = path.join(__dirname, '../public/faculty-dashboard.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');

            expect(htmlContent).toContain('Start Attendance Session');
            expect(htmlContent).toContain('End Session');
            expect(htmlContent).toContain('Refresh');
            expect(htmlContent).toContain('Export Data');
        });

        test('should have proper section headings', () => {
            const htmlPath = path.join(__dirname, '../public/faculty-dashboard.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');

            expect(htmlContent).toContain('<h2>Session Control</h2>');
            expect(htmlContent).toContain('<h2>QR Code</h2>');
            expect(htmlContent).toContain('<h2>Real-time Attendance</h2>');
        });
    });

    describe('JavaScript Functionality', () => {
        test('should have proper faculty ID configuration', () => {
            const jsPath = path.join(__dirname, '../public/js/faculty-dashboard.js');
            const jsContent = fs.readFileSync(jsPath, 'utf8');

            expect(jsContent).toContain('this.facultyId = \'faculty-001\'');
        });

        test('should have proper API endpoints', () => {
            const jsPath = path.join(__dirname, '../public/js/faculty-dashboard.js');
            const jsContent = fs.readFileSync(jsPath, 'utf8');

            expect(jsContent).toContain('/api/faculty/sessions/start');
            expect(jsContent).toContain('/api/faculty/sessions/${this.currentSession.id}/end');
            expect(jsContent).toContain('/api/faculty/sessions/${this.currentSession.id}/attendance');
            expect(jsContent).toContain('/api/faculty/sessions/${this.currentSession.id}/export');
        });

        test('should have proper WebSocket event handling', () => {
            const jsPath = path.join(__dirname, '../public/js/faculty-dashboard.js');
            const jsContent = fs.readFileSync(jsPath, 'utf8');

            expect(jsContent).toContain('join-faculty-room');
            expect(jsContent).toContain('qr-update');
            expect(jsContent).toContain('attendance-update');
            expect(jsContent).toContain('session-ended');
        });

        test('should have proper error handling', () => {
            const jsPath = path.join(__dirname, '../public/js/faculty-dashboard.js');
            const jsContent = fs.readFileSync(jsPath, 'utf8');

            expect(jsContent).toContain('try {');
            expect(jsContent).toContain('catch (error)');
            expect(jsContent).toContain('showMessage');
            expect(jsContent).toContain('console.error');
        });
    });

    describe('Accessibility and UX', () => {
        test('should have proper form labels', () => {
            const htmlPath = path.join(__dirname, '../public/faculty-dashboard.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');

            expect(htmlContent).toContain('<label for="courseName">');
            expect(htmlContent).toContain('<label for="courseCode">');
            expect(htmlContent).toContain('<label for="section">');
        });

        test('should have loading and status indicators', () => {
            const htmlPath = path.join(__dirname, '../public/faculty-dashboard.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');

            expect(htmlContent).toContain('loading-overlay');
            expect(htmlContent).toContain('status-messages');
            expect(htmlContent).toContain('Processing...');
        });

        test('should have responsive design classes', () => {
            const cssPath = path.join(__dirname, '../public/css/faculty-dashboard.css');
            const cssContent = fs.readFileSync(cssPath, 'utf8');

            expect(cssContent).toContain('@media (max-width: 768px)');
            expect(cssContent).toContain('grid-template-columns: 1fr');
            expect(cssContent).toContain('flex-direction: column');
        });
    });
});