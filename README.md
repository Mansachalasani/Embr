# Expo + Supabase + Google Auth App

A React Native app built with Expo that demonstrates Google OAuth authentication using Supabase.

## Setup Instructions

### 1. Supabase Configuration

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Authentication > Providers** in your Supabase dashboard
3. Enable Google OAuth provider:
   - Set **Enable Google provider** to ON
   - Add your Google OAuth client ID and secret
   - Add authorized redirect URLs for your app

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Add authorized redirect URIs:
     - `https://[your-project-ref].supabase.co/auth/v1/callback`
     - For development with Expo Go: `https://auth.expo.io/@your-username/your-app-slug`

### 3. Environment Variables

1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the App

```bash
# For iOS
npm run ios

# For Android
npm run android

# For web
npm run web
```

## Features

- **File-based routing** with Expo Router
- **Google OAuth authentication** via Supabase
- **Protected routes** with automatic redirects
- **Tab navigation** (Home, Profile, Settings)
- **User profile display** with avatar and details
- **Settings screen** with sign-out functionality
- **Secure session management** with AsyncStorage
- **Context-based auth state** management
- **TypeScript support** throughout

## Project Structure

```
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx   # Auth layout with redirect protection
│   │   ├── index.tsx     # Auth index redirect
│   │   └── signin.tsx    # Google sign-in screen
│   ├── (tabs)/
│   │   ├── _layout.tsx   # Tab navigation layout
│   │   ├── index.tsx     # Home tab screen
│   │   ├── profile.tsx   # Profile tab screen
│   │   └── settings.tsx  # Settings tab screen
│   ├── _layout.tsx       # Root layout with providers
│   └── index.tsx         # Main entry point with routing logic
├── contexts/
│   └── AuthContext.tsx   # Authentication context provider
├── lib/
│   └── supabase.ts       # Supabase client configuration
└── services/
    └── auth.ts           # Authentication service functions
```

## Authentication Flow

1. User taps "Sign in with Google" button
2. App opens Google OAuth flow in WebBrowser
3. After successful authentication, tokens are received
4. Supabase session is established
5. User profile information is displayed
6. Session persists across app restarts