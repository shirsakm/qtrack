# QR Attendance System

A secure QR code-based attendance system with rotating codes and Google OAuth authentication.

## Features

- Time-limited QR codes that rotate every 30 seconds
- Google OAuth authentication for students
- Real-time attendance monitoring for faculty
- Anti-proxy measures with email domain validation
- Export functionality for attendance data

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

3. Configure your Google OAuth credentials in `.env`

4. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
├── config/          # Configuration files
├── models/          # Data models and database schemas
├── routes/          # API endpoints
├── services/        # Business logic and utilities
├── public/          # Static assets (CSS, JS, images)
├── views/           # HTML templates
├── tests/           # Test files
└── server.js        # Main server entry point
```

## Requirements

- Node.js 16+
- SQLite3
- Google OAuth 2.0 credentials

## Development

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests