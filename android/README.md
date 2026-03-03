# SMSPaisa Android App

Earn money by sending SMS messages through the SMSPaisa platform. This Android app runs a background service that receives SMS tasks, sends them, and earns you money per successful delivery.

## Architecture

- **Language**: Kotlin
- **UI**: Jetpack Compose (Material 3)
- **Architecture**: MVVM (ViewModel + Repository pattern)
- **DI**: Hilt
- **Database**: Room
- **Networking**: Retrofit + OkHttp
- **Real-time**: Socket.IO
- **Auth**: Firebase Phone OTP
- **Push**: Firebase Cloud Messaging
- **Background**: Android Foreground Service

## Project Structure

```
app/src/main/java/com/smspaisa/app/
├── SMSPaisaApp.kt          # Application class
├── MainActivity.kt         # Single activity
├── ui/
│   ├── navigation/         # NavGraph
│   ├── screens/            # All screens (onboarding, auth, home, stats, withdraw, profile, referral)
│   ├── components/         # Reusable UI components
│   └── theme/              # Material 3 theme
├── viewmodel/              # ViewModels for each screen
├── data/
│   ├── api/                # Retrofit, OkHttp, WebSocket
│   ├── repository/         # Data repositories
│   ├── local/              # Room database
│   └── datastore/          # DataStore preferences
├── model/                  # Data models
├── service/                # Background service, receivers
└── di/                     # Hilt modules
```

## Setup Instructions

### 1. Prerequisites

- Android Studio Hedgehog (2023.1.1) or later
- JDK 17
- Android SDK 34
- Gradle 8.2+

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "SMSPaisa"
3. Add an Android app with package name `com.smspaisa.app`
4. Download `google-services.json` and place it in `app/` directory
5. Enable **Phone Authentication** in Firebase Console → Authentication → Sign-in methods
6. Enable **Cloud Messaging** for push notifications

### 3. Backend Configuration

The app connects to a backend server. Configure the base URL:

- **Debug (emulator)**: `http://10.0.2.2:3000/` (default, points to localhost on host machine)
- **Debug (device)**: Change to your machine's IP, e.g., `http://192.168.1.100:3000/`
- **Release**: Set `BASE_URL` in `app/build.gradle.kts` release buildConfigField

To change the URL for development with a physical device, edit `app/build.gradle.kts`:
```kotlin
buildConfigField("String", "BASE_URL", "\"http://YOUR_PC_IP:3000/\"")
```

### 4. Build & Run

```bash
# Clone the repository
git clone <repo-url>
cd SMSPaisa/android

# Open in Android Studio OR build via command line
./gradlew assembleDebug

# Install on connected device/emulator
./gradlew installDebug
```

### 5. Required Permissions

The app requires these permissions (requested at runtime):
- `SEND_SMS` - To send SMS messages
- `READ_PHONE_STATE` - To detect SIM cards
- `READ_PHONE_NUMBERS` - To read phone numbers
- `POST_NOTIFICATIONS` - For foreground service notification (Android 13+)

### 6. Running the Backend

Ensure the backend server is running before testing:
```bash
cd ../  # Go to root SMSPaisa directory
npm install
npm start
```

## Features

- 📱 **Phone OTP Login** via Firebase Authentication
- 💰 **Real-time Balance** tracking
- 📊 **Statistics** - Daily, Weekly, Monthly earnings
- 🔄 **Background SMS Service** with:
  - Daily SMS limit enforcement
  - Battery threshold stopping
  - Active hours scheduling
  - Rate limiting (3-5 seconds between SMS)
  - WiFi-only mode
  - SIM selection
- 💸 **Withdrawals** via UPI or Bank Transfer
- 👥 **Referral Program**
- 🔔 **Push Notifications** via FCM
- 🔌 **WebSocket** for real-time task delivery
- 💾 **Local caching** with Room

## Architecture Notes

### MVVM Pattern
Each screen has a corresponding ViewModel that manages UI state using `StateFlow`. Sealed classes are used for UI states (Loading, Success, Error).

### Repository Pattern
Repositories abstract data sources. They handle both remote API calls and local database operations.

### Dependency Injection
Hilt provides dependencies throughout the app. `AppModule` provides network and database dependencies; `RepositoryModule` provides repositories.

### Background Service
`SmsSenderService` is a foreground service that:
1. Shows a persistent notification
2. Connects to WebSocket server
3. Receives SMS tasks
4. Validates conditions (battery, network, active hours, daily limit)
5. Sends SMS with rate limiting
6. Reports results back to server

## Testing

```bash
# Unit tests
./gradlew test

# Instrumented tests
./gradlew connectedAndroidTest
```

## Building Release APK

```bash
# Create a keystore (first time)
keytool -genkey -v -keystore smspaisa.keystore -alias smspaisa -keyalg RSA -keysize 2048 -validity 10000

# Build signed release APK
./gradlew assembleRelease
```

## Troubleshooting

- **OTP not received**: Ensure Firebase Phone Auth is properly configured
- **WebSocket not connecting**: Check backend URL in `BuildConfig.BASE_URL`
- **SMS not sending**: Verify SEND_SMS permission is granted
- **Service not starting after reboot**: Ensure battery optimization is disabled for the app
