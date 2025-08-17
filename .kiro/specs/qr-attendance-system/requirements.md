# Requirements Document

## Introduction

This feature implements a secure QR code-based attendance system for faculty members to conduct attendance sessions. The system generates time-limited QR codes that students scan to mark their attendance through Google authentication, with built-in anti-proxy measures including rotating QR codes and email domain validation.

## Requirements

### Requirement 1

**User Story:** As a faculty member, I want to securely access the system and start an attendance session that generates a QR code, so that students can scan it to mark their attendance.

#### Acceptance Criteria

1. WHEN a faculty member accesses the system THEN they SHALL be authenticated through a secure method provided by the larger timetable system
2. WHEN a faculty member initiates an attendance session THEN the system SHALL generate a unique QR code containing a time-limited URL
3. WHEN the QR code is generated THEN the system SHALL display it prominently for students to scan
4. WHEN an attendance session is started THEN the system SHALL record the session start time and associated course/class information
5. WHEN a faculty member wants to end the session THEN the system SHALL provide a clear "End Session" button
6. WHEN a session is ended THEN the system SHALL stop accepting new attendance and invalidate all QR codes for that session

### Requirement 2

**User Story:** As a student, I want to scan the QR code and authenticate with my college email, so that I can mark my attendance for the class.

#### Acceptance Criteria

1. WHEN a student scans the QR code THEN the system SHALL redirect them to the attendance marking website
2. WHEN a student accesses the attendance URL THEN the system SHALL require Google OAuth authentication
3. WHEN a student authenticates THEN the system SHALL validate that their email follows the pattern firstname.lastname.branchyear@heritageit.edu.in
4. FOR TESTING PURPOSES the system SHALL include shirsak.majumder.cse28@heritageit.edu.in in the hardcoded student database
4. IF the email domain is not @heritageit.edu.in THEN the system SHALL reject the authentication attempt
5. WHEN a valid student email is authenticated THEN the system SHALL check if the email exists in the student database
6. IF the student email exists in the database THEN the system SHALL mark the student as present for the current session
7. IF the student email does not exist in the database THEN the system SHALL display an error message and not mark attendance

### Requirement 3

**User Story:** As a faculty member, I want the QR code to change every 30 seconds with old links becoming invalid, so that students cannot use proxy attendance methods.

#### Acceptance Criteria

1. WHEN 30 seconds have elapsed since QR code generation THEN the system SHALL generate a new QR code with a different URL
2. WHEN a new QR code is generated THEN the system SHALL invalidate all previous QR codes for that session
3. WHEN a student tries to access an expired QR code URL THEN the system SHALL display an error message stating the link has expired
4. WHEN the QR code rotates THEN the system SHALL maintain the same attendance session but with a new access token
5. WHEN an attendance session is active THEN the system SHALL continuously rotate QR codes every 30 seconds until the session is ended

### Requirement 4

**User Story:** As a faculty member, I want to view real-time attendance data during the session, so that I can monitor who has marked their attendance.

#### Acceptance Criteria

1. WHEN students mark their attendance THEN the system SHALL display their names in real-time on the faculty interface
2. WHEN the attendance list updates THEN the system SHALL show the timestamp of when each student marked attendance
3. WHEN viewing attendance data THEN the system SHALL display the total count of present students
4. WHEN an attendance session is active THEN the system SHALL provide a way for faculty to end the session

### Requirement 5

**User Story:** As a system administrator, I want the system to prevent duplicate attendance marking and implement security measures, so that the attendance data is accurate and secure.

#### Acceptance Criteria

1. WHEN a student has already marked attendance for a session THEN the system SHALL prevent duplicate entries and show a message that attendance is already recorded
2. WHEN detecting suspicious activity (multiple rapid requests from same IP) THEN the system SHALL implement rate limiting
3. WHEN a QR code URL is accessed THEN the system SHALL validate that the session is still active
4. WHEN storing attendance data THEN the system SHALL log the IP address and timestamp for audit purposes
5. IF a student tries to mark attendance after the session has ended THEN the system SHALL reject the attempt
6. WHEN handling authentication THEN the system SHALL implement CSRF protection for all forms
7. WHEN generating QR codes THEN the system SHALL use cryptographically secure random tokens

### Requirement 6

**User Story:** As a faculty member, I want to export attendance data after the session, so that I can integrate it with the larger timetable and attendance management system.

#### Acceptance Criteria

1. WHEN an attendance session is completed THEN the system SHALL provide options to export attendance data
2. WHEN exporting data THEN the system SHALL include student names, email addresses, attendance timestamps, and session information
3. WHEN exporting data THEN the system SHALL provide JSON format showing both present and absent students
4. WHEN exporting data THEN the system SHALL include complete attendance status for integration with the larger system
4. WHEN attendance data is exported THEN the system SHALL maintain data integrity and include session metadata

## Additional Security and Enhancement Considerations

The following security features and enhancements are recommended:

- **Location-based validation**: Optional GPS/location verification to ensure students are physically present in the classroom
- **Session time limits**: Automatic session expiration after a configurable duration (e.g., 2 hours)
- **Attendance window**: Configurable time window during which students can mark attendance (e.g., first 15 minutes of class)
- **Audit logging**: Comprehensive logging of all attendance actions for security and compliance
- **Mobile responsiveness**: Ensure the student-facing interface works well on mobile devices
- **Offline capability**: Consider how the system behaves when network connectivity is poor