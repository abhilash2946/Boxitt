# Boxitt - Native Android Venue Booking System

A modern, full-featured native Android application for booking sports venues and managing facilities, built with Jetpack Compose and Supabase.

## ✨ Features

- 🔐 **Secure Authentication** - Powered by Supabase Auth (OTP & Google Auth)
- 📍 **Venue Management** - Browse and book sports venues in real-time
- ⭐ **Rating System** - Community-driven venue ratings and reviews
- 💬 **Matchmaking** - Join existing games or host your own challenges
- 📱 **QR Code System** - Quick check-ins with generated tickets and scanner
- 📊 **Admin Dashboard** - Role-based management for bookings and venues
- 🎯 **Cricket Scorer** - Ball-by-ball tracking for cricket matches

## 🚀 Quick Start

### Prerequisites
- **Android Studio** (Hedgehog or newer recommended)
- **JDK 17**
- **Supabase Project** - [Sign up](https://supabase.com)
- **Google Cloud Console Project** (for Google Auth)

### 1️⃣ Clone the Project
```bash
git clone <repository-url>
cd boxitt-android
```

### 2️⃣ Configure Supabase
The project uses Gradle build flavors to manage environments. Update `app/build.gradle.kts` with your Supabase credentials:

```kotlin
productFlavors {
    create("dev") {
        dimension = "environment"
        buildConfigField("String", "API_BASE_URL", "\"your-supabase-url\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"your-anon-key\"")
    }
}
```

### 3️⃣ Run the App
1. Open the project in Android Studio.
2. Let Gradle sync complete.
3. Select a device or emulator.
4. Click **Run** or use the terminal:
```bash
./gradlew installDevDebug
```

## 🏗️ Project Structure

```
app/src/main/java/com/boxitt/app/
├── components/          # Reusable UI components (Compose)
├── pages/               # Full screen Composables (Pages)
├── navigation/          # Navigation Compose graph and routes
├── services/            # Business logic (Supabase, Storage, etc.)
├── models/              # Data classes and types
├── theme/               # Material 3 theme and colors
├── di/                  # Hilt Dependency Injection modules
├── repository/          # Data access layer
└── MainActivity.kt      # Entry point
```

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| **Language** | Kotlin |
| **UI Framework** | Jetpack Compose |
| **Architecture** | MVVM + Clean Architecture |
| **Dependency Injection** | Hilt |
| **Networking** | Ktor (via Supabase SDK) / Retrofit |
| **Database/Auth** | Supabase (Postgrest, GoTrue, Realtime) |
| **Local Storage** | DataStore / SharedPrefs |
| **Image Loading** | Coil |
| **Scanning** | ML Kit Barcode Scanning |

## 🚢 Deployment

1. Configure signing configs in `app/build.gradle.kts`.
2. Run the assembly task:
```bash
./gradlew assembleProductionRelease
```
3. Locate the APK in `app/build/outputs/apk/production/release/`.

## 🔐 Security

- ✅ Supabase Row-Level Security (RLS)
- ✅ Role-based access control (User, Admin, SuperAdmin)
- ✅ Secure token handling via DataStore
- ✅ Google Identity Services for authentication

---

**Status**: ✅ Active Development
**Module**: `BookingApp.app.main`
