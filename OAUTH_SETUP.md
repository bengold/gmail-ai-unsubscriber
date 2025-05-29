# Google OAuth Setup Guide

## � Setting Up Google OAuth for Gmail AI Unsubscriber

This guide will help you configure Google OAuth credentials to allow the application to access your Gmail account securely.

## Prerequisites
- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step-by-Step Setup

### 1. Create or Select a Google Cloud Project
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Click on the project dropdown at the top
- Either select an existing project or click "New Project"
- If creating new: give it a name like "Gmail AI Unsubscriber"

### 2. Enable the Gmail API
- In the Google Cloud Console, go to "APIs & Services" → "Library"
- Search for "Gmail API"
- Click on "Gmail API" in the results
- Click "Enable" button

### 3. Configure OAuth Consent Screen
- Go to "APIs & Services" → "OAuth consent screen"
- Choose "External" user type (unless you have a Google Workspace account)
- Fill in the required information:
  - **App name**: "Gmail AI Unsubscriber"
  - **User support email**: Your email address
  - **App logo**: (optional)
  - **App domain**: Leave blank for local development
  - **Developer contact information**: Your email address
- Click "Save and Continue"

#### Add Required Scopes
- In the "Scopes" section, click "Add or Remove Scopes"
- Add these scopes:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.modify`
- Click "Update" then "Save and Continue"

#### Test Users (Development Phase)
- Add your Gmail address as a test user
- Click "Save and Continue"

### 4. Create OAuth 2.0 Credentials
- Go to "APIs & Services" → "Credentials"
- Click "Create Credentials" → "OAuth 2.0 Client ID"
- Choose "Web application"
- Configure the details:
  - **Name**: "Gmail AI Unsubscriber Client"
  - **Authorized JavaScript origins**: `http://localhost:3000`
  - **Authorized redirect URIs**: `http://localhost:3000/auth/callback`
- Click "Create"

### 5. Download Credentials
- After creating, you'll see a dialog with your client credentials
- Click "Download JSON"
- Save this file as `gmail-credentials.json` in your project's `credentials/` directory

The downloaded file should look like this:
```json
{
  "web": {
    "client_id": "your-client-id.googleusercontent.com",
    "client_secret": "your-client-secret",
    "redirect_uris": ["http://localhost:3000/auth/callback"],
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token"
  }
}
```

## 🔒 Security Notes

- **Never commit** your `gmail-credentials.json` file to version control
- The application stores OAuth tokens in `credentials/tokens.json` (also ignored by git)
- Tokens are automatically refreshed when needed
- You can revoke access anytime in your [Google Account settings](https://myaccount.google.com/permissions)

## ⚠️ Troubleshooting

### "Access blocked: Authorization Error"
- Verify your redirect URI is exactly: `http://localhost:3000/auth/callback`
- Make sure you're using the correct port (3000 by default)
- Check that your OAuth consent screen is properly configured

### "This app isn't verified"
- This is normal for development apps with External user type
- Click "Advanced" → "Go to Gmail AI Unsubscriber (unsafe)"
- This warning appears because the app isn't published to all users

### "The OAuth client was not found"
- Double-check your `gmail-credentials.json` file is in the correct location
- Verify the client ID and secret match your Google Cloud Console

## 🚀 Ready to Go!

Once you've completed these steps:
1. Make sure your `credentials/gmail-credentials.json` file is in place
2. Your `.env` file contains your OpenAI API key
3. Run `npm start` and navigate to `http://localhost:3000`
4. Click "Authenticate with Gmail" to complete the OAuth flow
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
