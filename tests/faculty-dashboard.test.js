/**
 * Faculty Dashboard Frontend Tests
 * Tests for user interactions and real-time updates
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock Socket.io
const mockSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    connected: true
};

// Mock io function
global.io = jest.fn(() => mockSocket);

describe('Faculty Dashboard Frontend', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        // Read the HTML file
        const htmlPath = path.join(__dirname, '../public/faculty-dashboard.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        // Create JSDOM instance
        dom = new JSDOM(htmlContent, {
            pretendToBeVisual: true,
            url: 'http://localhost:3000'
        });

        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.fetch = jest.fn();

        // Mock console methods
        global.console = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        };

        // Mock Socket.io in window
        window.io = global.io;
    });

    afterEach(() => {
        dom.window.close();
        jest.clearAllMocks();
    });

    describe('Dashboard HTML Structure', () => {
        test('should have all required elements', () => {
            expect(document.getElementById('sessionForm')).toBeTruthy();
            expect(document.getElementById('startSessionBtn')).toBeTruthy();
            expect(document.getElementById('endSessionBtn')).toBeTruthy();
            expect(document.getElementById('qrContainer')).toBeTruthy();
            expect(document.getElementById('attendanceList')).toBeTruthy();
            expect(document.getElementById('exportBtn')).toBeTruthy();
        });

        test('should have proper form structure', () => {
            expect(document.getElementById('courseName')).toBeTruthy();
            expect(document.getElementById('courseCode')).toBeTruthy();
            expect(document.getElementById('section')).toBeTruthy();
        });

        test('should have attendance display elements', () => {
            expect(document.getElementById('presentCount')).toBeTruthy();
            expect(document.getElementById('totalCount')).toBeTruthy();
            expect(document.getElementById('attendancePercentage')).toBeTruthy();
        });
    });

    describe('Form Elements', () => {
        test('should have required form inputs', () => {
            const courseNameInput = document.getElementById('courseName');
            const courseCodeInput = document.getElementById('courseCode');
            const sectionInput = document.getElementById('section');

            expect(courseNameInput.getAttribute('required')).toBe('');
            expect(courseCodeInput.getAttribute('required')).toBe('');
            expect(sectionInput.getAttribute('required')).toBe('');
        });

        test('should have proper input placeholders', () => {
            const courseNameInput = document.getElementById('courseName');
            const courseCodeInput = document.getElementById('courseCode');
            const sectionInput = document.getElementById('section');

            expect(courseNameInput.placeholder).toContain('Computer Networks');
            expect(courseCodeInput.placeholder).toContain('CSE301');
            expect(sectionInput.placeholder).toContain('A');
        });
    });

    describe('UI Components', () => {
        test('should have session control buttons', () => {
            const startBtn = document.getElementById('startSessionBtn');
            const endBtn = document.getElementById('endSessionBtn');

            expect(startBtn.textContent).toContain('Start Attendance Session');
            expect(endBtn.textContent).toContain('End Session');
        });

        test('should have QR code container', () => {
            const qrContainer = document.getElementById('qrContainer');
            expect(qrContainer).toBeTruthy();
            expect(qrContainer.innerHTML).toContain('Start a session to generate QR code');
        });

        test('should have attendance controls', () => {
            const refreshBtn = document.getElementById('refreshAttendanceBtn');
            const exportBtn = document.getElementById('exportBtn');

            expect(refreshBtn.textContent).toContain('Refresh');
            expect(exportBtn.textContent).toContain('Export Data');
            expect(exportBtn.disabled).toBe(true);
        });
    });

    describe('QR Code Section', () => {
        test('should have QR timer elements', () => {
            const qrTimer = document.getElementById('qrTimer');
            const timerProgress = document.getElementById('timerProgress');
            const timerText = document.getElementById('timerText');

            expect(qrTimer).toBeTruthy();
            expect(timerProgress).toBeTruthy();
            expect(timerText).toBeTruthy();
            expect(qrTimer.style.display).toBe('none'); // Initially hidden
        });

        test('should show placeholder initially', () => {
            const qrContainer = document.getElementById('qrContainer');
            expect(qrContainer.innerHTML).toContain('Start a session to generate QR code');
        });
    });

    describe('Attendance Display', () => {
        test('should have attendance summary elements', () => {
            const presentCount = document.getElementById('presentCount');
            const totalCount = document.getElementById('totalCount');
            const attendancePercentage = document.getElementById('attendancePercentage');

            expect(presentCount).toBeTruthy();
            expect(totalCount).toBeTruthy();
            expect(attendancePercentage).toBeTruthy();
            
            // Initial values
            expect(presentCount.textContent).toBe('0');
            expect(totalCount.textContent).toBe('0');
            expect(attendancePercentage.textContent).toBe('0%');
        });

        test('should show placeholder when no attendance records', () => {
            const attendanceList = document.getElementById('attendanceList');
            expect(attendanceList.innerHTML).toContain('No attendance records yet');
        });

        test('should be able to add attendance records', () => {
            const attendanceList = document.getElementById('attendanceList');
            
            // Clear placeholder
            attendanceList.innerHTML = '';
            
            // Add attendance record
            const attendanceItem = document.createElement('div');
            attendanceItem.className = 'attendance-item';
            attendanceItem.innerHTML = `
                <div class="student-info">
                    <div class="student-name">John Doe</div>
                    <div class="student-details">john.doe.cse28@heritageit.edu.in</div>
                </div>
                <div class="attendance-time">
                    <div class="attendance-timestamp">${new Date().toLocaleTimeString()}</div>
                </div>
            `;
            
            attendanceList.appendChild(attendanceItem);
            
            expect(attendanceList.children.length).toBe(1);
            expect(attendanceList.innerHTML).toContain('John Doe');
        });
    });

    describe('Export Functionality', () => {
        test('should be disabled initially', () => {
            const exportBtn = document.getElementById('exportBtn');
            expect(exportBtn.disabled).toBe(true);
        });

        test('should have proper button text', () => {
            const exportBtn = document.getElementById('exportBtn');
            expect(exportBtn.textContent).toContain('Export Data');
        });
    });

    describe('Status and Loading Elements', () => {
        test('should have status message container', () => {
            const statusMessages = document.getElementById('statusMessages');
            expect(statusMessages).toBeTruthy();
        });

        test('should have loading overlay', () => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            expect(loadingOverlay).toBeTruthy();
            expect(loadingOverlay.style.display).toBe('none'); // Initially hidden
        });

        test('should have faculty info display', () => {
            const facultyName = document.getElementById('facultyName');
            const facultyId = document.getElementById('facultyId');
            
            expect(facultyName).toBeTruthy();
            expect(facultyId).toBeTruthy();
            expect(facultyId.style.display).toBe('none'); // Hidden by default
        });
    });

    describe('CSS Classes and Styling', () => {
        test('should have proper CSS classes', () => {
            const container = document.querySelector('.dashboard-container');
            const header = document.querySelector('.dashboard-header');
            const main = document.querySelector('.dashboard-main');
            
            expect(container).toBeTruthy();
            expect(header).toBeTruthy();
            expect(main).toBeTruthy();
        });

        test('should have button classes', () => {
            const startBtn = document.getElementById('startSessionBtn');
            const endBtn = document.getElementById('endSessionBtn');
            const refreshBtn = document.getElementById('refreshAttendanceBtn');
            const exportBtn = document.getElementById('exportBtn');
            
            expect(startBtn.classList.contains('btn')).toBe(true);
            expect(startBtn.classList.contains('btn-primary')).toBe(true);
            expect(endBtn.classList.contains('btn-danger')).toBe(true);
            expect(refreshBtn.classList.contains('btn-secondary')).toBe(true);
            expect(exportBtn.classList.contains('btn-success')).toBe(true);
        });
    });
    describe('Accessibility and Semantic HTML', () => {
        test('should have proper labels for form inputs', () => {
            const courseNameLabel = document.querySelector('label[for="courseName"]');
            const courseCodeLabel = document.querySelector('label[for="courseCode"]');
            const sectionLabel = document.querySelector('label[for="section"]');
            
            expect(courseNameLabel).toBeTruthy();
            expect(courseCodeLabel).toBeTruthy();
            expect(sectionLabel).toBeTruthy();
        });

        test('should have semantic HTML structure', () => {
            const header = document.querySelector('header');
            const main = document.querySelector('main');
            const sections = document.querySelectorAll('section');
            
            expect(header).toBeTruthy();
            expect(main).toBeTruthy();
            expect(sections.length).toBeGreaterThan(0);
        });

        test('should have proper heading hierarchy', () => {
            const h1 = document.querySelector('h1');
            const h2s = document.querySelectorAll('h2');
            
            expect(h1).toBeTruthy();
            expect(h2s.length).toBeGreaterThan(0);
        });
    });
});