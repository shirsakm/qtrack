# 🎯 QR Attendance System

A modern, secure QR code-based attendance system with rotating codes and Google OAuth authentication. Built for educational institutions to prevent proxy attendance and ensure accurate tracking.

## 🚀 **Live Demo**

**Production URL**: https://qtrack-kwqi.onrender.com

### 📋 **How to Experience the Demo**

#### **For Judges/Evaluators:**

1. **🎓 Faculty Dashboard** (Main Demo Interface)
   - Visit: https://qtrack-kwqi.onrender.com/faculty-dashboard.html
   - Fill in course details (e.g., "Data Structures", "CSE301", "A")
   - Click **"Start Session"** to generate a QR code
   - **QR codes rotate every 30 seconds** for security

2. **📱 Student Experience** (Test the QR Flow)
   - **Click the QR code** on the faculty dashboard (it's clickable!)
   - You'll be redirected to Google OAuth login
   - **Test Accounts Available:**
     - `shirsak.majumder.cse28@heritageit.edu.in` (Roll: 2451075)
     - `rohit.kumardebnath.cse28@heritageit.edu.in` (Roll: 2451076)
     - `shaista.meher.cse28@heritageit.edu.in` (Roll: 2451077)
     - `anirban.roy.cse28@heritageit.edu.in` (Roll: 2451078)

3. **⚡ Real-time Updates**
   - After successful authentication, watch the faculty dashboard
   - **Attendance appears instantly** with student details
   - See live attendance count and percentage updates

4. **📊 Export & Analytics**
   - Click **"Export Attendance"** to download JSON data
   - View detailed student information (name, roll, email, timestamp, IP)

#### **🎪 Demo Scenarios to Showcase:**

**Scenario 1: Basic Attendance Flow**
- Start a session → Click QR → Login → See real-time update

**Scenario 2: Security Features**
- Try accessing an expired QR code (wait 30+ seconds)
- Attempt duplicate attendance (login twice with same account)
- Show email domain validation (only @heritageit.edu.in works)

**Scenario 3: Faculty Management**
- Multiple sessions management
- Real-time attendance monitoring
- Data export functionality

## ✨ **Key Features**

### 🔒 **Security First**
- **Rotating QR Codes**: Change every 30 seconds to prevent screenshot sharing
- **Domain Validation**: Only @heritageit.edu.in emails accepted
- **IP Tracking**: Monitor attendance location for proxy detection
- **Session Tokens**: Cryptographically secure attendance validation
- **CSRF Protection**: Prevent cross-site request forgery attacks

### ⚡ **Real-time Experience**
- **WebSocket Integration**: Instant attendance updates on faculty dashboard
- **Live Statistics**: Real-time attendance count and percentage
- **Auto-refresh**: QR codes update automatically without page reload

### 🎯 **User Experience**
- **One-Click Testing**: QR codes are clickable for easy demo
- **Mobile Optimized**: Works seamlessly on phones and tablets
- **Graceful Error Handling**: Clear error messages and retry options
- **Auto-cleanup**: Sessions close automatically on server restart

### 📊 **Analytics & Export**
- **Detailed Records**: Student name, roll number, email, timestamp, IP address
- **JSON Export**: Download attendance data for further processing
- **Session History**: Track multiple sessions and their statistics

## 🛠 **Technical Architecture**

### **Backend Stack**
- **Node.js + Express**: RESTful API server
- **SQLite**: Lightweight database for student records
- **Socket.io**: Real-time WebSocket communication
- **Passport.js**: Google OAuth 2.0 authentication
- **Helmet**: Security headers and protection

### **Frontend Stack**
- **Vanilla JavaScript**: No framework dependencies
- **WebSocket Client**: Real-time updates
- **Responsive CSS**: Mobile-first design
- **QR Code Generation**: Server-side QR creation

### **Security Measures**
- **Rate Limiting**: Prevent abuse and spam
- **Input Sanitization**: XSS protection
- **Session Management**: Secure session handling
- **Environment Variables**: Sensitive data protection

## 🚀 **Quick Start (Local Development)**

```bash
# Clone and setup
git clone https://github.com/shirsakm/qtrack.git
cd qtrack
npm install

# Initialize database
npm run init-db

# Start development server
npm run dev-clean

# Open faculty dashboard
open http://localhost:3000/faculty-dashboard.html
```

## 📱 **Mobile Demo Experience**

The system is fully mobile-responsive. For the best demo experience:

1. **Faculty Dashboard**: Use on laptop/desktop for full view
2. **Student QR Scanning**: Use mobile device to scan QR codes
3. **Real-time Updates**: Watch attendance appear instantly on faculty screen

## 🎯 **Demo Tips for Judges**

1. **Start with Faculty Dashboard**: Show the clean, professional interface
2. **Highlight Security**: Mention 30-second QR rotation and domain validation
3. **Demonstrate Real-time**: Click QR and show instant attendance updates
4. **Show Export Feature**: Download and open the JSON attendance data
5. **Test Error Handling**: Try expired QR or duplicate attendance

## 🏆 **Why This Solution Stands Out**

- **Prevents Proxy Attendance**: Rotating QR codes make screenshot sharing useless
- **Institution-Ready**: Domain validation ensures only enrolled students can attend
- **Real-time Monitoring**: Faculty see attendance as it happens
- **Production-Ready**: Deployed on Render with proper security measures
- **Scalable Architecture**: Can handle multiple concurrent sessions

## 📞 **Support**

For demo questions or technical details, the system includes comprehensive error handling and logging to help troubleshoot any issues during evaluation.

---

**Built with ❤️ for modern educational institutions**