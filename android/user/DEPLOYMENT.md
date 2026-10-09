# 🚀 Deployment & Distribution

This guide covers the process of building and deploying the Boxitt Android application.

---

## 📦 Build Types & Flavors

The app uses `flavorDimensions` to separate Development and Production environments.

### Product Flavors
- **dev**: Connects to the development Supabase instance.
- **production**: Connects to the live/production Supabase instance.

### Build Types
- **debug**: For active development (includes debug symbols, non-minified).
- **release**: For distribution (minified with R8, obfuscated).

---

## 🛠️ Preparing for Release

### 1. Update Versioning
Open `app/build.gradle.kts` and increment:
- `versionCode`: Integer (e.g., `2`)
- `versionName`: Semantic version (e.g., `"1.0.1"`)

### 2. Configure Signing
1.  Generate a keystore file (`.jks`) via **Build > Generate Signed Bundle / APK**.
2.  Store the keystore securely.
3.  Add signing configuration to `app/build.gradle.kts` (or use environment variables for CI/CD):

```kotlin
signingConfigs {
    create("release") {
        storeFile = file("path/to/keystore.jks")
        storePassword = System.getenv("KEYSTORE_PASSWORD")
        keyAlias = System.getenv("KEY_ALIAS")
        keyPassword = System.getenv("KEY_PASSWORD")
    }
}
```

---

## 🏗️ Generating Binaries

### Generate APK (Manual Install)
```bash
./gradlew assembleProductionRelease
```
**Output**: `app/build/outputs/apk/production/release/app-production-release.apk`

### Generate AAB (Google Play Store)
```bash
./gradlew bundleProductionRelease
```
**Output**: `app/build/outputs/bundle/productionRelease/app-production-release.aab`

---

## 🌐 Distribution Channels

### 1. Google Play Store
- Upload the **AAB** file to the [Google Play Console](https://play.google.com/console).
- Ensure you have completed the Store Listing, Content Rating, and Privacy Policy.

### 2. Firebase App Distribution (Beta Testing)
- Use the Firebase CLI or Gradle plugin to distribute builds to testers.
```bash
./gradlew assembleDevDebug appDistributionUploadDevDebug
```

---

## 🛡️ Proguard / R8
The app uses R8 for code shrinking and obfuscation. If you encounter issues with Supabase serialization after building a release APK, check the `proguard-rules.pro` file to ensure necessary models are kept:

```proguard
-keep class com.boxitt.app.model.** { *; }
-keepattributes Signature, InnerClasses, AnnotationDefault
```

---

## 🔄 CI/CD (Optional)
Recommended tools for automating builds:
- **GitHub Actions**: Use `gradle-build-action` to build and sign APKs on every tag.
- **Codemagic**: Specialized CI/CD for mobile apps.
