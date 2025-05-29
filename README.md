# Gmail AI Unsubscriber

This project is an application that utilizes the Gmail API and AI to search the inbox for junk email and assist users in unsubscribing from them. The application automates the unsubscription process, making it easier for users to manage their email subscriptions.

## Features

- Connects to the Gmail API to fetch emails.
- Utilizes AI algorithms to classify emails as junk or important.
- Provides an interface for users to view identified junk emails.
- Automates the unsubscription process from junk emails.

## Project Structure

```
gmail-ai-unsubscriber
├── src
│   ├── app.ts
│   ├── services
│   │   ├── gmailService.ts
│   │   ├── aiService.ts
│   │   └── unsubscribeService.ts
│   ├── controllers
│   │   ├── emailController.ts
│   │   └── unsubscribeController.ts
│   ├── routes
│   │   ├── emailRoutes.ts
│   │   └── unsubscribeRoutes.ts
│   ├── utils
│   │   ├── emailParser.ts
│   │   └── logger.ts
│   ├── config
│   │   └── gmail.ts
│   └── types
│       └── index.ts
├── credentials
│   └── gmail-credentials.json
├── package.json
├── tsconfig.json
├── .env
└── README.md
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/gmail-ai-unsubscriber.git
   ```
2. Navigate to the project directory:
   ```
   cd gmail-ai-unsubscriber
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Configuration

1. Create a Google Cloud project and enable the Gmail API.
2. Download the credentials JSON file and place it in the `credentials` directory.
3. Create a `.env` file in the root directory and add your environment variables, such as API keys and secrets.

## Usage

1. Start the application:
   ```
   npm start
   ```
2. Access the application through your browser or API client.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or features.

## License

This project is licensed under the MIT License.