# Render Deployment Guide

## Step 1: Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Set these URLs (replace `your-app-name` with your actual Render app name):

### Authorized JavaScript Origins:
```
https://your-app-name.onrender.com
```

### Authorized Redirect URIs:
```
https://your-app-name.onrender.com/auth/google/callback
```

5. Copy the Client ID and Client Secret - you'll need these for Render

## Step 2: Deploy to Render

### Option A: Connect GitHub Repository (Recommended)

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Configure the service:
   - **Name**: `qr-attendance-system` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run init-db`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for better performance)

### Option B: Deploy from Git URL

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Enter your Git repository URL
4. Follow the same configuration as Option A

## Step 3: Set Environment Variables

In your Render service dashboard, go to "Environment" and add these variables:

### Required Variables:
```
NODE_ENV=production
GOOGLE_CLIENT_ID=your_google_client_id_from_step_1
GOOGLE_CLIENT_SECRET=your_google_client_secret_from_step_1
GOOGLE_CALLBACK_URL=https://your-app-name.onrender.com/auth/google/callback
SESSION_SECRET=generate_a_strong_32_character_random_string
CSRF_SECRET=generate_another_strong_32_character_random_string
```

### Generate Strong Secrets:
Run this command locally to generate secrets:
```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CSRF_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Optional Variables:
```
DB_PATH=./attendance.db
QR_TOKEN_EXPIRY_SECONDS=30
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Step 4: Deploy

1. Click "Create Web Service"
2. Render will automatically build and deploy your app
3. Wait for the deployment to complete (usually 2-5 minutes)
4. Your app will be available at `https://your-app-name.onrender.com`

## Step 5: Update Google OAuth URLs

Once deployed, update your Google OAuth configuration:

1. Go back to Google Cloud Console
2. Update the OAuth 2.0 client with your actual Render URL:
   - **Authorized JavaScript Origins**: `https://your-actual-app-name.onrender.com`
   - **Authorized Redirect URIs**: `https://your-actual-app-name.onrender.com/auth/google/callback`

## Step 6: Test Your Deployment

1. Visit your Render URL
2. Navigate to `/faculty-dashboard.html`
3. Try starting a session
4. Test the QR code generation
5. Test Google OAuth by scanning a QR code

## Troubleshooting

### Common Issues:

1. **Build Fails**
   - Check the build logs in Render dashboard
   - Ensure all dependencies are in `package.json`
   - Verify the build command is correct

2. **Google OAuth Errors**
   - Double-check the callback URL matches exactly
   - Ensure Google+ API is enabled
   - Verify Client ID and Secret are correct

3. **Database Issues**
   - The SQLite database will be created automatically
   - Data will persist between deployments on paid plans
   - Free tier may lose data on restarts

4. **Environment Variables**
   - Check all required variables are set
   - Ensure no typos in variable names
   - Verify secrets are properly generated

### Render-Specific Notes:

- **Free Tier**: App sleeps after 15 minutes of inactivity
- **Custom Domain**: Available on paid plans
- **SSL**: Automatically provided
- **Logs**: Available in the Render dashboard
- **Auto-Deploy**: Enabled by default when connected to GitHub

## Monitoring

- Check logs in Render dashboard for errors
- Monitor the health endpoint: `https://your-app.onrender.com/api/health`
- Set up uptime monitoring if needed

## Scaling

For production use:
- Upgrade to a paid plan for better performance
- Consider using PostgreSQL instead of SQLite
- Set up proper monitoring and alerting
- Configure custom domain and CDN

Your QR Attendance System should now be live and accessible to users!