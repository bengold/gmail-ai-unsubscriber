# 🚀 Gmail AI Unsubscriber

An intelligent application that uses the Gmail API and OpenAI to automatically identify junk emails in your inbox and help you unsubscribe from unwanted mailing lists. Features a modern web interface with real-time progress tracking and smart caching to minimize API costs.

## ✨ Features

- **🤖 AI-Powered Classification** - Uses OpenAI GPT to intelligently identify junk emails
- **📧 Smart Email Grouping** - Groups emails by sender domain for efficient management
- **🔄 Bulk Unsubscribe** - Automatically unsubscribe from multiple emails with one click
- **📊 Real-Time Progress** - Live progress tracking during email scanning
- **💾 Smart Caching** - Avoids reprocessing emails to save on API costs
- **🏃‍♂️ Email Preprocessing** - Pattern-based filtering reduces AI API calls by 60-80%
- **📋 Skip Lists** - Mark senders to skip for future scans
- **🗂️ Auto-Archiving** - Automatically archives emails when unsubscribing
- **🔐 Secure OAuth** - Uses Google OAuth2 with automatic token refresh

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed on your system
- A Google account with Gmail
- An OpenAI account with API access

### 1. Get Your API Keys

#### OpenAI API Key
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign in or create an OpenAI account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

#### Google Gmail API Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API" and enable it
4. Configure OAuth consent screen:
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External" user type
   - Fill in required fields (app name, support email, etc.)
   - Add scopes: `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.modify`
5. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:3000/auth/callback`
   - Download the JSON file

> 📝 **Note**: For detailed OAuth setup instructions, see [OAUTH_SETUP.md](./OAUTH_SETUP.md)

### 2. Clone and Install

```bash
git clone https://github.com/bengold/gmail-ai-unsubscriber.git
cd gmail-ai-unsubscriber
npm install
```

### 3. Configure Environment

Create a `.env` file in the root directory:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
PORT=3000
```

### 4. Add Gmail Credentials

1. Create a `credentials/` directory in the project root
2. Save your downloaded Google OAuth JSON file as `credentials/gmail-credentials.json`

The file should look like this:
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

### 5. Run the Application

```bash
npm run build
npm start
```

Visit `http://localhost:3000` in your browser and follow the OAuth flow to connect your Gmail account.

## 📁 Project Structure

```
gmail-ai-unsubscriber/
├── src/
│   ├── app.ts                    # Main application server
│   ├── config/
│   │   ├── env.ts               # Environment variable loader
│   │   └── gmail.ts             # Gmail API configuration
│   ├── controllers/
│   │   └── emailController.ts   # Email processing controller
│   ├── routes/
│   │   ├── authRoutes.ts        # OAuth authentication routes
│   │   └── emailRoutes.ts       # Email management routes
│   ├── services/
│   │   ├── aiService.ts         # OpenAI integration
│   │   ├── gmailService.ts      # Gmail API service
│   │   └── unsubscribeService.ts # Unsubscribe automation
│   ├── utils/
│   │   ├── emailCache.ts        # Email analysis caching
│   │   ├── emailParser.ts       # Email content parsing
│   │   ├── emailPreprocessor.ts # Smart email classification
│   │   ├── logger.ts            # Application logging
│   │   └── skipList.ts          # Skip list management
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── public/
│   └── index.html               # Web interface
├── credentials/                 # OAuth credentials (not in git)
│   ├── gmail-credentials.json   # Google OAuth config
│   └── tokens.json             # Access/refresh tokens
├── cache/                       # Analysis cache (not in git)
│   ├── email-analysis.json     # Cached AI analysis results
│   └── skip-list.json          # User skip preferences
├── .env                         # Environment variables (not in git)
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Configuration Details

### Environment Variables (.env)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | ✅ | Your OpenAI API key | `sk-proj-abc123...` |
| `PORT` | ❌ | Server port (default: 3000) | `3000` |

### Gmail Credentials

The `credentials/gmail-credentials.json` file contains your Google OAuth 2.0 configuration. This file is automatically created when you download credentials from Google Cloud Console.

**Important Security Notes:**
- Never commit credential files to git
- The `.gitignore` file protects these directories
- Tokens are automatically refreshed when needed

## 🎯 How It Works

1. **Authentication**: Uses Google OAuth2 to securely access your Gmail
2. **Email Fetching**: Retrieves emails from your inbox (not sent items or drafts)
3. **Smart Preprocessing**: Uses pattern matching to quickly identify obvious junk/legitimate emails
4. **AI Analysis**: Sends remaining emails to OpenAI for intelligent classification
5. **Caching**: Stores analysis results to avoid reprocessing emails
6. **Grouping**: Groups junk emails by sender domain for easier management
7. **Unsubscribing**: Finds and executes unsubscribe methods automatically
8. **Archiving**: Moves unsubscribed emails out of your inbox

## 💰 Cost Optimization

- **Smart Caching**: Analyzed emails are cached for 7 days
- **Preprocessing**: Pattern-based filtering reduces AI calls by 60-80%
- **Efficient Batching**: Processes emails in small batches with rate limiting
- **GPT-3.5-Turbo**: Uses cost-effective model instead of GPT-4
- **Limited Processing**: Processes maximum 100 new emails per scan (cached emails don't count)

## 🚀 Usage

1. **Start the Application**:
   ```bash
   npm start
   ```

2. **Open Web Interface**: Navigate to `http://localhost:3000`

3. **Authenticate**: Click "Authenticate with Gmail" and complete OAuth flow

4. **Scan Emails**: Click "Start Scan" to analyze your inbox

5. **Review Results**: View grouped junk emails with confidence scores

6. **Take Action**:
   - **Unsubscribe**: Click unsubscribe buttons to automatically unsubscribe and archive
   - **Skip**: Mark senders you want to keep (adds to skip list)
   - **Rescan**: Run additional scans to find more junk emails

## 🛠️ Development

### Building
```bash
npm run build
```

### Development Mode
```bash
npm run dev  # If you have nodemon configured
```

### TypeScript Compilation
```bash
npx tsc
```

## 🔍 Troubleshooting

### Common Issues

**"Not authenticated" Error**
- Make sure your `gmail-credentials.json` file is in the `credentials/` directory
- Check that your OAuth redirect URI is set to `http://localhost:3000/auth/callback`
- Verify your `.env` file contains your OpenAI API key

**"OpenAI API Error"**
- Verify your OpenAI API key is correct and has sufficient credits
- Check that you have access to the GPT-3.5-turbo model

**"Gmail API Quota Exceeded"**
- Gmail API has daily quotas - try again later
- Consider reducing the email processing limit in the code

**Port Already in Use**
- Change the `PORT` in your `.env` file to a different number
- Or kill existing processes using port 3000: `lsof -ti:3000 | xargs kill -9`

### Debugging

Enable debug logging by checking the browser console and server logs for detailed information about the scanning process.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines
- Follow TypeScript best practices
- Add appropriate error handling
- Update tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This tool automatically interacts with your Gmail account and external services. Use at your own risk and always review the emails it identifies before taking bulk actions. The developers are not responsible for any unintended unsubscriptions or data loss.

## 🙏 Acknowledgments

- OpenAI for providing the GPT API for intelligent email classification
- Google for the Gmail API
- The open source community for various libraries used in this project