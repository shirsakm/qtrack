# Development Workflow Guide

## 🚀 Quick Start Commands

### Development
```bash
# Start development server (cleans up sessions first)
npm run dev-clean

# Or start normally
npm run dev

# Clean up active sessions manually
npm run cleanup
```

### Production
```bash
npm start
```

## 🛠️ Problem Solved: "Faculty has another session" Error

### The Issue
Previously, when you stopped the server with Ctrl+C, active sessions remained in the database, causing the "Faculty already has an active session" error when restarting.

### The Solution
1. **Graceful Shutdown**: Server now handles Ctrl+C (SIGINT) and other shutdown signals
2. **Automatic Cleanup**: All active sessions are automatically closed when server shuts down
3. **Manual Cleanup**: Use `npm run cleanup` to manually close active sessions
4. **Development Workflow**: Use `npm run dev-clean` to cleanup and start in one command

## 🔧 How It Works

### Graceful Shutdown Process
1. **Signal Detection**: Server listens for SIGTERM, SIGINT (Ctrl+C), and uncaught exceptions
2. **Session Cleanup**: Automatically closes all active sessions in database
3. **Database Closure**: Properly closes database connections
4. **Server Shutdown**: Gracefully shuts down HTTP server
5. **Force Exit**: Falls back to force exit after 10 seconds if needed

### Cleanup Script Features
- Shows count of active sessions before cleanup
- Displays details of closed sessions
- Provides colored output for better visibility
- Can be run independently or as part of dev workflow

## 📝 Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run dev-clean  # Cleanup sessions + start development server
npm run cleanup    # Close all active sessions
npm run init-db    # Initialize database
npm run verify-db  # Verify database setup
npm run test       # Run tests
```

## 🎯 Benefits

1. **No More Session Conflicts**: Never get "Faculty has another session" error again
2. **Clean Development**: Each restart starts with a clean slate
3. **Proper Shutdown**: Database connections are properly closed
4. **Error Prevention**: Prevents data corruption from improper shutdowns
5. **Developer Friendly**: Clear feedback on what's happening during cleanup

## 🔍 Monitoring

The cleanup process provides detailed feedback:
- Number of active sessions found
- Details of sessions being closed
- Faculty ID, course info, and timestamps
- Success/error messages with emojis for clarity

## 🚨 Error Handling

The system handles various shutdown scenarios:
- Normal Ctrl+C (SIGINT)
- System termination (SIGTERM)
- Uncaught exceptions
- Unhandled promise rejections
- Force exit after timeout

This ensures your database stays clean and consistent regardless of how the server is stopped!