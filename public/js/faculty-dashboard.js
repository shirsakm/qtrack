/**
 * Faculty Dashboard JavaScript
 * Handles session management, QR code display, real-time attendance, and WebSocket connections
 */

class FacultyDashboard {
    constructor() {
        this.socket = null;
        this.currentSession = null;
        this.qrTimer = null;
        this.qrTimeRemaining = 30;
        this.facultyId = 'faculty-001'; // This would come from authentication in real implementation
        
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeWebSocket();
        this.showConnectionStatus('connecting');
    }

    initializeElements() {
        // Session control elements
        this.sessionForm = document.getElementById('sessionForm');
        this.sessionActive = document.getElementById('sessionActive');
        this.startSessionBtn = document.getElementById('startSessionBtn');
        this.endSessionBtn = document.getElementById('endSessionBtn');
        
        // Form inputs
        this.courseNameInput = document.getElementById('courseName');
        this.courseCodeInput = document.getElementById('courseCode');
        this.sectionInput = document.getElementById('section');
        
        // Session info elements
        this.activeSessionTitle = document.getElementById('activeSessionTitle');
        this.activeCourse = document.getElementById('activeCourse');
        this.activeSection = document.getElementById('activeSection');
        this.sessionStartTime = document.getElementById('sessionStartTime');
        this.activeSessionId = document.getElementById('activeSessionId');
        
        // QR code elements
        this.qrContainer = document.getElementById('qrContainer');
        this.qrTimer = document.getElementById('qrTimer');
        this.timerProgress = document.getElementById('timerProgress');
        this.timerText = document.getElementById('timerText');
        
        // Attendance elements
        this.attendanceSummary = document.getElementById('attendanceSummary');
        this.presentCount = document.getElementById('presentCount');
        this.totalCount = document.getElementById('totalCount');
        this.attendancePercentage = document.getElementById('attendancePercentage');
        this.attendanceList = document.getElementById('attendanceList');
        this.refreshAttendanceBtn = document.getElementById('refreshAttendanceBtn');
        this.exportBtn = document.getElementById('exportBtn');
        
        // Status elements
        this.statusMessages = document.getElementById('statusMessages');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Faculty info
        document.getElementById('facultyId').textContent = this.facultyId;
    }

    initializeEventListeners() {
        this.startSessionBtn.addEventListener('click', () => this.startSession());
        this.endSessionBtn.addEventListener('click', () => this.endSession());
        this.refreshAttendanceBtn.addEventListener('click', () => this.refreshAttendance());
        this.exportBtn.addEventListener('click', () => this.exportAttendance());
        
        // Form validation
        [this.courseNameInput, this.courseCodeInput, this.sectionInput].forEach(input => {
            input.addEventListener('input', () => this.validateForm());
        });
    }

    initializeWebSocket() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('Connected to WebSocket server');
                this.showConnectionStatus('connected');
                
                // Join faculty room for real-time updates
                this.socket.emit('join-faculty-room', { facultyId: this.facultyId });
            });
            
            this.socket.on('disconnect', () => {
                console.log('Disconnected from WebSocket server');
                this.showConnectionStatus('disconnected');
            });
            
            this.socket.on('reconnect', () => {
                console.log('Reconnected to WebSocket server');
                this.showConnectionStatus('connected');
                
                // Rejoin faculty room
                this.socket.emit('join-faculty-room', { facultyId: this.facultyId });
            });
            
            // Listen for QR code updates
            this.socket.on('qr-update', (data) => {
                console.log('QR code updated:', data);
                this.updateQRCode(data.qrData);
                this.resetQRTimer();
            });
            
            // Listen for attendance updates
            this.socket.on('attendance-update', (data) => {
                console.log('Attendance updated:', data);
                this.handleAttendanceUpdate(data);
            });
            
            // Listen for session ended
            this.socket.on('session-ended', (data) => {
                console.log('Session ended:', data);
                this.handleSessionEnded(data);
            });
            
        } catch (error) {
            console.error('WebSocket initialization error:', error);
            this.showConnectionStatus('disconnected');
        }
    }

    showConnectionStatus(status) {
        // Remove existing status indicator
        const existing = document.querySelector('.connection-status');
        if (existing) {
            existing.remove();
        }
        
        // Create new status indicator
        const statusDiv = document.createElement('div');
        statusDiv.className = `connection-status ${status}`;
        
        const statusText = {
            'connected': '🟢 Connected',
            'disconnected': '🔴 Disconnected',
            'connecting': '🟡 Connecting...'
        };
        
        statusDiv.textContent = statusText[status] || 'Unknown';
        document.body.appendChild(statusDiv);
        
        // Auto-hide after 3 seconds if connected
        if (status === 'connected') {
            setTimeout(() => {
                if (statusDiv.parentNode) {
                    statusDiv.remove();
                }
            }, 3000);
        }
    }

    validateForm() {
        const isValid = this.courseNameInput.value.trim() && 
                       this.courseCodeInput.value.trim() && 
                       this.sectionInput.value.trim();
        
        this.startSessionBtn.disabled = !isValid;
        return isValid;
    }

    async startSession() {
        if (!this.validateForm()) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            const sessionData = {
                facultyId: this.facultyId,
                courseName: this.courseNameInput.value.trim(),
                courseCode: this.courseCodeInput.value.trim(),
                section: this.sectionInput.value.trim()
            };

            const response = await fetch('/api/faculty/sessions/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sessionData)
            });

            const result = await response.json();

            if (result.success) {
                this.currentSession = result.session;
                this.updateSessionUI(result.session);
                this.updateQRCode(result.qrData);
                this.startQRTimer();
                this.showMessage('Attendance session started successfully!', 'success');
                
                // Enable export button and refresh attendance
                this.exportBtn.disabled = false;
                this.refreshAttendance();
            } else {
                this.showMessage(result.error || 'Failed to start session', 'error');
            }
        } catch (error) {
            console.error('Error starting session:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async endSession() {
        if (!this.currentSession) {
            this.showMessage('No active session to end', 'warning');
            return;
        }

        this.showLoading(true);
        
        try {
            const response = await fetch(`/api/faculty/sessions/${this.currentSession.id}/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ facultyId: this.facultyId })
            });

            const result = await response.json();

            if (result.success) {
                this.handleSessionEnded(result.session);
                this.showMessage('Attendance session ended successfully!', 'success');
            } else {
                this.showMessage(result.error || 'Failed to end session', 'error');
            }
        } catch (error) {
            console.error('Error ending session:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    updateSessionUI(session) {
        // Hide form, show active session
        this.sessionForm.style.display = 'none';
        this.sessionActive.style.display = 'block';
        
        // Update session info
        this.activeCourse.textContent = `${session.courseName} (${session.courseCode})`;
        this.activeSection.textContent = session.section;
        this.sessionStartTime.textContent = new Date(session.startTime).toLocaleString();
        this.activeSessionId.textContent = session.id;
    }

    updateQRCode(qrData) {
        if (!qrData) return;
        
        this.qrContainer.innerHTML = `
            <div class="qr-code">
                <img src="${qrData.qrCodeDataURL}" alt="QR Code for Attendance" />
                <div class="qr-info">
                    <p><strong>Session:</strong> ${this.currentSession?.courseName || 'Active Session'}</p>
                    <p><strong>Valid until:</strong> ${new Date(qrData.expiresAt).toLocaleTimeString()}</p>
                </div>
            </div>
        `;
    }

    startQRTimer() {
        this.qrTimer.style.display = 'block';
        this.qrTimeRemaining = 30;
        this.updateTimerDisplay();
        
        this.qrTimerInterval = setInterval(() => {
            this.qrTimeRemaining--;
            this.updateTimerDisplay();
            
            if (this.qrTimeRemaining <= 0) {
                this.resetQRTimer();
            }
        }, 1000);
    }

    resetQRTimer() {
        this.qrTimeRemaining = 30;
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const percentage = (this.qrTimeRemaining / 30) * 100;
        this.timerProgress.style.width = `${percentage}%`;
        this.timerText.textContent = this.qrTimeRemaining;
    }

    async refreshAttendance() {
        if (!this.currentSession) return;
        
        try {
            const response = await fetch(`/api/faculty/sessions/${this.currentSession.id}/attendance?facultyId=${this.facultyId}`);
            const result = await response.json();
            
            if (result.success) {
                this.updateAttendanceDisplay(result.attendance);
            } else {
                console.error('Failed to refresh attendance:', result.error);
            }
        } catch (error) {
            console.error('Error refreshing attendance:', error);
        }
    }

    updateAttendanceDisplay(attendanceData) {
        // Update summary
        const summary = attendanceData.summary;
        this.presentCount.textContent = summary.presentCount;
        this.totalCount.textContent = summary.totalStudents;
        this.attendancePercentage.textContent = `${summary.attendancePercentage.toFixed(1)}%`;
        
        // Update attendance list
        if (attendanceData.present.length === 0) {
            this.attendanceList.innerHTML = `
                <div class="attendance-placeholder">
                    <p>No attendance records yet</p>
                </div>
            `;
        } else {
            const attendanceHTML = attendanceData.present.map(record => `
                <div class="attendance-item">
                    <div class="student-info">
                        <div class="student-name">${record.studentName}</div>
                        <div class="student-details">
                            ${record.studentEmail} • ${record.rollNumber} • ${record.branch} ${record.year}
                        </div>
                    </div>
                    <div class="attendance-time">
                        <div class="attendance-timestamp">${new Date(record.timestamp).toLocaleTimeString()}</div>
                        <div>IP: ${record.ipAddress}</div>
                    </div>
                </div>
            `).join('');
            
            this.attendanceList.innerHTML = attendanceHTML;
        }
    }

    handleAttendanceUpdate(data) {
        // Add new attendance record with animation
        if (data.newAttendance) {
            this.addNewAttendanceRecord(data.newAttendance);
        }
        
        // Update summary
        if (data.summary) {
            this.presentCount.textContent = data.summary.presentCount;
            this.totalCount.textContent = data.summary.totalStudents;
            this.attendancePercentage.textContent = `${data.summary.attendancePercentage.toFixed(1)}%`;
        }
        
        // Show notification
        this.showMessage(`${data.newAttendance.studentName} marked attendance`, 'success');
    }

    addNewAttendanceRecord(record) {
        // Remove placeholder if it exists
        const placeholder = this.attendanceList.querySelector('.attendance-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
        
        // Create new attendance item
        const attendanceItem = document.createElement('div');
        attendanceItem.className = 'attendance-item';
        attendanceItem.style.backgroundColor = '#e8f5e8';
        attendanceItem.innerHTML = `
            <div class="student-info">
                <div class="student-name">${record.studentName}</div>
                <div class="student-details">
                    ${record.studentEmail} • Just now
                </div>
            </div>
            <div class="attendance-time">
                <div class="attendance-timestamp">${new Date(record.timestamp).toLocaleTimeString()}</div>
                <div>IP: ${record.ipAddress}</div>
            </div>
        `;
        
        // Add to top of list
        this.attendanceList.insertBefore(attendanceItem, this.attendanceList.firstChild);
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            attendanceItem.style.backgroundColor = '';
        }, 3000);
    }

    handleSessionEnded(sessionData) {
        // Clear current session
        this.currentSession = null;
        
        // Stop QR timer
        if (this.qrTimerInterval) {
            clearInterval(this.qrTimerInterval);
        }
        
        // Reset UI
        this.sessionForm.style.display = 'block';
        this.sessionActive.style.display = 'none';
        this.qrTimer.style.display = 'none';
        this.exportBtn.disabled = true;
        
        // Clear QR code
        this.qrContainer.innerHTML = `
            <div class="qr-placeholder">
                <p>Start a session to generate QR code</p>
            </div>
        `;
        
        // Clear form
        this.courseNameInput.value = '';
        this.courseCodeInput.value = '';
        this.sectionInput.value = '';
        this.validateForm();
        
        // Reset attendance display
        this.presentCount.textContent = '0';
        this.totalCount.textContent = '0';
        this.attendancePercentage.textContent = '0%';
        this.attendanceList.innerHTML = `
            <div class="attendance-placeholder">
                <p>No attendance records yet</p>
            </div>
        `;
    }

    async exportAttendance() {
        if (!this.currentSession) {
            this.showMessage('No active session to export', 'warning');
            return;
        }
        
        try {
            const response = await fetch(`/api/faculty/sessions/${this.currentSession.id}/export?facultyId=${this.facultyId}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `attendance-${this.currentSession.id}-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showMessage('Attendance data exported successfully!', 'success');
            } else {
                const result = await response.json();
                this.showMessage(result.error || 'Failed to export data', 'error');
            }
        } catch (error) {
            console.error('Error exporting attendance:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `status-message ${type}`;
        messageDiv.textContent = message;
        
        this.statusMessages.appendChild(messageDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    showLoading(show) {
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FacultyDashboard();
});