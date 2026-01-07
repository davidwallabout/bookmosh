# BookMosh Mobile (iOS)

React Native mobile app for BookMosh - track books, connect with friends, and chat in pit discussions.

## Prerequisites

- **macOS** (required for iOS development)
- **Node.js** 18+ and npm
- **Xcode** (latest version from Mac App Store)
- **Xcode Command Line Tools**: `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods`
- **Expo CLI**: Installed automatically with the project

## Setup

### 1. Install Dependencies

```bash
cd bookmosh-mobile
npm install
```

### 2. Configure Supabase

Edit `.env` and replace with your actual Supabase credentials:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://uqzzgjjatmgjeekaxpgw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
```

**IMPORTANT:** Get your real `SUPABASE_ANON_KEY` from:
- Supabase Dashboard → Project Settings → API → `anon` `public` key

### 3. Install iOS Dependencies

```bash
npx pod-install
```

## Running on iOS

### Option 1: iOS Simulator (Recommended for Development)

```bash
npm run ios
```

This will:
- Start the Metro bundler
- Build the app
- Launch iOS Simulator automatically
- Install and run the app

### Option 2: Physical iPhone Device

1. Open the project in Xcode:
   ```bash
   open ios/bookmoshmobile.xcworkspace
   ```

2. In Xcode:
   - Select your iPhone from the device dropdown
   - Click the Play button to build and run
   - You may need to trust your developer certificate on the device

### Option 3: Expo Go App (Quick Testing)

```bash
npx expo start
```

Then scan the QR code with your iPhone camera (requires Expo Go app installed).

## Development Commands

```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web browser
npm run web

# Clear cache and restart
npm start -- --clear
```

## Project Structure

```
bookmosh-mobile/
├── App.js                 # Main app entry point
├── lib/
│   └── supabase.js       # Supabase client configuration
├── screens/
│   ├── AuthScreen.js     # Login/signup screen
│   └── HomeScreen.js     # Main books screen
└── .env                  # Environment variables (Supabase credentials)
```

## Current Features

- ✅ User authentication (sign up / sign in)
- ✅ Book tracking (add/delete books)
- ✅ Dark theme UI
- ✅ Supabase integration

## Troubleshooting

### "Unable to resolve module" errors
```bash
npm start -- --clear
```

### iOS build fails
```bash
cd ios
pod install
cd ..
npm run ios
```

### Metro bundler issues
```bash
watchman watch-del-all
rm -rf node_modules
npm install
npm start -- --reset-cache
```

### Xcode signing issues
- Open `ios/bookmoshmobile.xcworkspace` in Xcode
- Select the project in the navigator
- Go to "Signing & Capabilities"
- Select your development team

## Next Steps

- [ ] Add navigation (React Navigation with tabs)
- [ ] Implement Feed screen
- [ ] Implement Pit Chat screen
- [ ] Add friend management
- [ ] Implement real-time updates
- [ ] Add book search/details
- [ ] Implement lists feature

## Support

For issues or questions, check:
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Supabase Documentation](https://supabase.com/docs)
