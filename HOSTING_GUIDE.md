# QR Attendance System - Hosting Guide

## Quick Fix for Current Issues

### 1. CSRF Error Fix
The CSRF error has been fixed by:
- Updating session configuration to be more permissive
- Adding a simple CSRF protection for development
- Adding CSRF token endpoint at `/api/csrf-token`

### 2. QR Code Display Fix
The QR code "undefined src" issue has been fixed by:
- Correcting property name inconsistency (`qrCodeDataURL` vs `qrCodeDataUrl`)
- Ensuring proper QR code generation in the service

## Prerequisites

Before hosting, ensure you have:
- Node.js (v16 or higher)
- npm or yarn package manager
- Google Cloud Console account (for OAuth)
- Domain name (for production)

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_PATH=./attendance.db

# Google OAuth Configuration (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Session Configuration (Generate a strong secret)
SESSION_SECRET=your_strong_session_secret_here

# Security Configuration
CSRF_SECRET=your_csrf_secret_here
```

### 3. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - For local: `http://localhost:3000/auth/google/callback`
   - For production: `https://yourdomain.com/auth/google/callback`
7. Copy Client ID and Client Secret to your `.env` file

### 4. Initialize Database
```bash
npm run init-db
```

### 5. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to test the application.

## Production Hosting Options

### Option 1: VPS/Cloud Server (Recommended)

#### A. Using DigitalOcean, AWS EC2, or similar

1. **Server Setup**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install nginx -y
```

2. **Deploy Application**
```bash
# Clone your repository
git clone https://github.com/yourusername/qr-attendance-system.git
cd qr-attendance-system

# Install dependencies
npm install --production

# Set up environment variables
cp .env.example .env
# Edit .env with production values

# Initialize database
npm run init-db

# Start with PM2
pm2 start server.js --name "attendance-system"
pm2 startup
pm2 save
```

3. **Nginx Configuration**
Create `/etc/nginx/sites-available/attendance-system`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/attendance-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

4. **SSL Certificate (Let's Encrypt)**
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### B. Production Environment Variables
Update your `.env` for production:
```env
NODE_ENV=production
PORT=3000
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
SESSION_SECRET=your_very_strong_production_secret
```

### Option 2: Platform as a Service (PaaS)

#### A. Heroku
1. Install Heroku CLI
2. Create Heroku app:
```bash
heroku create your-attendance-system
```

3. Set environment variables:
```bash
heroku config:set NODE_ENV=production
heroku config:set GOOGLE_CLIENT_ID=your_client_id
heroku config:set GOOGLE_CLIENT_SECRET=your_client_secret
heroku config:set GOOGLE_CALLBACK_URL=https://your-app.herokuapp.com/auth/google/callback
heroku config:set SESSION_SECRET=your_session_secret
```

4. Deploy:
```bash
git push heroku main
```

#### B. Railway
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on git push

#### C. Render
1. Connect GitHub repository
2. Set environment variables
3. Deploy with automatic builds

### Option 3: Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run init-db

EXPOSE 3000

CMD ["npm", "start"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  attendance-system:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_CALLBACK_URL=${GOOGLE_CALLBACK_URL}
      - SESSION_SECRET=${SESSION_SECRET}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Deploy:
```bash
docker-compose up -d
```

## Security Considerations for Production

1. **Environment Variables**
   - Use strong, unique secrets
   - Never commit `.env` files
   - Use environment variable management services

2. **Database Security**
   - Regular backups
   - Proper file permissions
   - Consider PostgreSQL for production

3. **HTTPS**
   - Always use SSL certificates
   - Redirect HTTP to HTTPS
   - Update Google OAuth callback URLs

4. **Rate Limiting**
   - Configure appropriate limits
   - Monitor for abuse
   - Use fail2ban for repeated failures

5. **Monitoring**
   - Set up logging
   - Monitor server resources
   - Use uptime monitoring services

## Maintenance

### Regular Tasks
1. **Database Backup**
```bash
# Backup SQLite database
cp attendance.db backup/attendance_$(date +%Y%m%d_%H%M%S).db
```

2. **Log Rotation**
```bash
# Set up logrotate for application logs
sudo nano /etc/logrotate.d/attendance-system
```

3. **Updates**
```bash
# Update dependencies
npm audit
npm update

# Restart application
pm2 restart attendance-system
```

### Monitoring Commands
```bash
# Check application status
pm2 status

# View logs
pm2 logs attendance-system

# Monitor resources
pm2 monit
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
```bash
# Find process using port 3000
sudo lsof -i :3000
# Kill process
sudo kill -9 <PID>
```

2. **Database Permission Issues**
```bash
# Fix database permissions
chmod 644 attendance.db
chown www-data:www-data attendance.db
```

3. **Google OAuth Issues**
- Verify callback URLs match exactly
- Check client ID and secret
- Ensure Google+ API is enabled

4. **WebSocket Connection Issues**
- Check firewall settings
- Verify proxy configuration for WebSocket upgrade

### Logs Location
- Application logs: `logs/` directory
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`

## Performance Optimization

1. **Enable Gzip Compression** (Nginx)
2. **Use CDN** for static assets
3. **Database Indexing** for large datasets
4. **Caching** for frequently accessed data
5. **Load Balancing** for high traffic

## Support

For issues or questions:
1. Check the logs first
2. Verify environment configuration
3. Test with a minimal setup
4. Check Google OAuth configuration

Remember to test thoroughly in a staging environment before deploying to production!