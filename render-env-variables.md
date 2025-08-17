# Render Environment Variables

Set these in your Render dashboard under Environment Variables:

## Required Variables:

### Server Configuration
- `NODE_ENV` = `production`
- `PORT` = `3000` (Render will override this automatically)

### Google OAuth (Get from Google Cloud Console)
- `GOOGLE_CLIENT_ID` = `your_google_client_id_here`
- `GOOGLE_CLIENT_SECRET` = `your_google_client_secret_here`
- `GOOGLE_CALLBACK_URL` = `https://your-app-name.onrender.com/auth/google/callback`

### Security
- `SESSION_SECRET` = `your_very_strong_random_secret_here`
- `CSRF_SECRET` = `another_strong_random_secret_here`

### Database (Optional - SQLite will work by default)
- `DB_PATH` = `./attendance.db`

## Optional Variables:

### QR Code Configuration
- `QR_TOKEN_EXPIRY_SECONDS` = `30`

### Rate Limiting
- `RATE_LIMIT_WINDOW_MS` = `900000`
- `RATE_LIMIT_MAX_REQUESTS` = `100`

## How to Generate Strong Secrets:

You can generate strong secrets using:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use online generators like:
- https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx
- https://generate-secret.vercel.app/32

## Example Values:
- SESSION_SECRET: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`
- CSRF_SECRET: `9876543210fedcba0987654321fedcba0987654321fedcba0987654321fedcba`