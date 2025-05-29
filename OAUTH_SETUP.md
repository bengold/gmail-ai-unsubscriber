# Google OAuth Setup Guide

## 🚨 IMPORTANT: You need to update your Google Cloud Console settings

The "Access blocked: Authorization Error" occurs because the redirect URI in your Google Cloud Console doesn't match what the application expects.

## Steps to Fix:

### 1. Go to Google Cloud Console
- Open [Google Cloud Console](https://console.cloud.google.com/)
- Select your project or create a new one

### 2. Enable Gmail API
- Go to "APIs & Services" > "Library"
- Search for "Gmail API"
- Click "Enable" if not already enabled

### 3. Configure OAuth Consent Screen
- Go to "APIs & Services" > "OAuth consent screen"
- Choose "External" user type
- Fill in required fields:
  - App name: "Gmail AI Unsubscriber"
  - User support email: your email
  - Developer contact: your email
- Add scopes:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.modify`

### 4. Create/Update OAuth Credentials
- Go to "APIs & Services" > "Credentials"
- If you already have OAuth credentials, click "Edit"
- If not, click "Create Credentials" > "OAuth 2.0 Client ID"
- Choose "Web application"
- Add Authorized redirect URIs:
  ```
  http://localhost:3000/api/auth/callback
  ```

### 5. Update Your Credentials
Your current .env file has:
```
GMAIL_CLIENT_ID=827653448666-bpmhcq5gu0l6l17aaham515tidf259t1.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=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
GMAIL_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

Make sure these match your Google Cloud Console credentials.

## 🎯 What's Fixed:
- ✅ Proper OAuth redirect flow (no more manual code entry)
- ✅ Automatic authentication handling
- ✅ Clean URL after authentication
- ✅ Better user experience

## 🧪 Test the Flow:
1. Go to http://localhost:3000
2. Click "Connect Gmail"
3. You'll be redirected to Google OAuth
4. Grant permissions
5. You'll be redirected back to the app with success message

## 📋 Current Status:
- ✅ Server: Running on http://localhost:3000
- ✅ OAuth Flow: Properly implemented
- ✅ Redirect URI: Correctly configured as `http://localhost:3000/api/auth/callback`
- ✅ Routes: Auth routes properly mounted at `/api/auth/`
- ✅ Environment: Variables loaded correctly
- ✅ Frontend: Updated for OAuth redirect

**✅ FIXED: OAuth callback route now properly handles `/api/auth/callback`**

**Next Step: Update your Google Cloud Console with the correct redirect URI!**
