# AlexListens - AI Voice Assistant

AlexListens is an advanced AI voice assistant that provides natural, empathetic conversations through real-time voice interaction. Built with Next.js, Firebase, and Ultravox, it offers a seamless conversational experience with smart memory capabilities.

## Features

- 🎙️ Real-time voice interaction
- 📝 Live conversation transcription
- 🧠 Smart memory system
- 🔐 Secure user authentication
- 💬 Persistent conversation history

## Tech Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Firebase, Ultravox
- **Authentication**: Firebase Auth
- **Database**: Firestore
- **Memory System**: Mem0

## Getting Started

1. Clone the repository
2. Create a `.env.local` file with required environment variables
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

The following environment variables are required:

```
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Ultravox Configuration (Client-side)
NEXT_PUBLIC_ULTRAVOX_API_KEY=your_ultravox_api_key
NEXT_PUBLIC_AGENT_ID=your_default_agent_id
NEXT_PUBLIC_SPANISH_AGENT_ID=your_spanish_agent_id
NEXT_PUBLIC_AUSSIE_AGENT_ID=your_aussie_agent_id

# OpenCage Geocoding API (Optional - for location services)
NEXT_PUBLIC_OPENCAGE_API_KEY=your_opencage_api_key

# Mem0 Configuration
MEM0_API_KEY=your_mem0_api_key
```

## Architecture

This application uses a **client-side only** architecture for Firebase with server-side Ultravox integration:

- **Firebase Web SDK**: All Firebase operations run in the browser
- **Client-side wallet balance**: Wallet balance is read client-side and passed to API routes
- **Server-side Ultravox calls**: Ultravox API calls are made through Next.js API routes for security
- **Firestore Security Rules**: Data access is controlled via Firestore security rules
- **No server-side Firebase**: No Firebase Admin SDK or server-side Firebase operations

## Environment Variable Setup

### Ultravox Configuration

1. Sign up for an Ultravox account
2. Create your AI agents (English, Spanish, Australian)
3. Get your API key and agent IDs
4. Add them to your `.env.local` file with the `NEXT_PUBLIC_` prefix

### OpenCage Geocoding (Optional)

1. Sign up for a free OpenCage account
2. Get your API key
3. Add `NEXT_PUBLIC_OPENCAGE_API_KEY=your_key` to `.env.local`
4. If not configured, the app will gracefully fall back to "Location not available"

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@alexlistens.com