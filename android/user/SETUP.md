# ⚙️ Boxitt Android Setup Guide

This guide details the steps to set up the native Android development environment and connect the app to your Supabase backend.

## 🛠️ Prerequisites

1.  **Android Studio**: Download the latest version (Hedgehog or newer).
2.  **JDK 17**: Ensure your JAVA_HOME points to JDK 17.
3.  **Supabase Account**: You'll need a project URL and Anon Key.
4.  **Google Cloud Project**: Required for Google Auth (SHA-1 fingerprint needed).

---

## 1️⃣ Android Studio Configuration

1.  **Open Project**: Select the `android/` directory in Android Studio.
2.  **Gradle Sync**: Wait for the IDE to download dependencies and sync the project.
3.  **Local Properties**: Create a `local.properties` file in the root directory (if not present) and ensure your SDK path is correct:
    ```properties
    sdk.dir=/path/to/your/android/sdk
    ```

---

## 2️⃣ Backend Integration (Supabase)

### Update build.gradle.kts
Open `app/build.gradle.kts` and locate the `productFlavors` block. Update the `dev` and `production` configurations with your Supabase credentials:

```kotlin
productFlavors {
    create("dev") {
        dimension = "environment"
        buildConfigField("String", "API_BASE_URL", "\"https://your-project.supabase.co/\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"your-anon-key\"")
    }
}
```

### Database Schema
Run the SQL migrations found in the `supabase/migrations/` directory in your Supabase SQL Editor to set up the necessary tables (bookings, profiles, locations, etc.).

---

## 3️⃣ Authentication Setup

### Google Auth (Optional)
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create an OAuth 2.0 Client ID for Android.
3.  Add your package name (`com.boxitt.app`) and your debug/release SHA-1 certificate fingerprint.
4.  Enable Google Auth in the Supabase Dashboard under **Authentication > Providers**.

---

## 4️⃣ Running the Application

### Using a Physical Device (Recommended)
1.  Enable **Developer Options** and **USB Debugging** on your Android device.
2.  Connect the device via USB or Wi-Fi.
3.  Select your device in the Android Studio toolbar.
4.  Click the **Run** button (Shift + F10).

### Using the Emulator
1.  Open **Device Manager** in Android Studio.
2.  Create a Virtual Device (API 30+ recommended).
3.  Select the virtual device and click **Run**.

### Command Line
```bash
# Install the debug build on the connected device
./gradlew installDevDebug
```

---

## 🔍 Troubleshooting

### Gradle Sync Fails
- Check your internet connection.
- Ensure you are using the correct Gradle version (defined in `gradle-wrapper.properties`).
- Try `File > Invalidate Caches / Restart`.

### Supabase Connection Errors
- Verify `API_BASE_URL` ends with a trailing slash.
- Ensure `SUPABASE_ANON_KEY` is correctly copied without quotes inside the string.
- Check if your IP is restricted in Supabase settings.

### Real-time Not Working
- Ensure the tables you are listening to have **Realtime** enabled in the Supabase Dashboard.
