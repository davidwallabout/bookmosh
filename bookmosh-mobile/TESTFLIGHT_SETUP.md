# TestFlight & App Store Setup Guide

## Prerequisites
- ✅ Apple Developer Account (approved)
- ✅ Expo/EAS CLI installed
- ✅ App configured with bundle ID: `com.bookmosh.app`

## Step 1: Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: BookMosh
   - **Primary Language**: English
   - **Bundle ID**: `com.bookmosh.bookmosh`
   - **SKU**: `bookmosh-ios-2026` (or any unique identifier)
   - **User Access**: Full Access

4. **Save the App ID** - you'll see it in the URL or app info (e.g., `1234567890`)

## Step 2: Get Your Team ID

1. Go to [Apple Developer Membership](https://developer.apple.com/account/#!/membership)
2. Find your **Team ID** (10-character code like `ABC123XYZ9`)
3. Save this for the next step

## Step 3: Configure EAS Project

Run this command in the `bookmosh-mobile` directory:

```bash
cd bookmosh-mobile
eas init
```

This will create an EAS project and give you a project ID. Save this ID.

## Step 4: Update Configuration Files

Update `eas.json` with your actual values:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",  // From Step 1
        "appleTeamId": "ABC123XYZ9"  // From Step 2
      }
    }
  }
}
```

Update `app.json` with your EAS project ID:

```json
{
  "extra": {
    "eas": {
      "projectId": "your-eas-project-id"  // From Step 3
    }
  }
}
```

## Step 5: Build for TestFlight

Run this command to create a production build:

```bash
eas build --platform ios --profile production
```

This will:
- Build your app in the cloud
- Sign it with your Apple Developer credentials
- Create an `.ipa` file ready for submission

**Note**: First time you'll need to authenticate with Apple. EAS will prompt you.

## Step 6: Submit to TestFlight

Once the build completes, submit it:

```bash
eas submit --platform ios --latest
```

This automatically uploads your build to App Store Connect and makes it available in TestFlight.

## Step 7: Set Up TestFlight

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app → **TestFlight** tab
3. Wait for Apple to process your build (usually 5-30 minutes)
4. Once processed, you'll see it under **iOS Builds**

### Add Internal Testers:
1. Click **Internal Testing** → **+** next to testers
2. Add team members (up to 100)
3. They'll get an email invite

### Add External Testers:
1. Click **External Testing** → **Create Group**
2. Add testers (up to 10,000)
3. Submit for Beta App Review (required for external testing)

## Step 8: Install TestFlight App

Testers need to:
1. Install [TestFlight app](https://apps.apple.com/app/testflight/id899247664) from App Store
2. Open the invite link from email
3. Install BookMosh from TestFlight

## Quick Commands Reference

```bash
# Initialize EAS project
eas init

# Build for iOS production
eas build --platform ios --profile production

# Submit latest build to App Store Connect
eas submit --platform ios --latest

# Check build status
eas build:list

# View project info
eas project:info
```

## Updating Your App

When you make changes:

1. Update version in `app.json`:
   ```json
   "version": "1.0.1"
   ```

2. Build number auto-increments (configured in `eas.json`)

3. Run build and submit:
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios --latest
   ```

## Troubleshooting

### "No credentials found"
Run: `eas credentials` to set up Apple credentials

### "Bundle identifier already exists"
Make sure you're using `com.bookmosh.bookmosh` consistently

### Build fails
Check logs with: `eas build:view [build-id]`

### TestFlight not showing build
Wait 5-30 minutes for Apple to process. Check for email from Apple about any issues.

## Next Steps After TestFlight

Once you're ready for the App Store:

1. In App Store Connect, go to your app
2. Click **App Store** tab
3. Fill in all required metadata:
   - Screenshots (required for all device sizes)
   - App description
   - Keywords
   - Support URL
   - Privacy policy URL
   - Age rating
4. Select your TestFlight build
5. Submit for App Review

---

**Need help?** Check [Expo EAS docs](https://docs.expo.dev/submit/ios/) or [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
