# 👨‍💻 Development Workflow

This document outlines the development standards and workflows for the Boxitt Android project.

---

## 🛠️ Tools & Standards

- **IDE**: Android Studio
- **Language**: Kotlin 1.9+
- **Style Guide**: Kotlin Coding Conventions (official)
- **UI**: Jetpack Compose (Material 3)
- **Dependency Management**: Gradle Kotlin DSL (`.gradle.kts`)

---

## 🏗️ Architecture: MVVM + Hilt

We use **Model-View-ViewModel** to separate concerns:

1.  **View (Composables)**: UI layer that observes state.
2.  **ViewModel**: Handles UI logic and maintains state using `StateFlow`.
3.  **Repository**: Acts as a single source of truth for data (Local + Remote).
4.  **Service/DataSource**: Direct interaction with Supabase or Local Storage.

### Dependency Injection
All dependencies are provided via **Hilt**. 
- Singleton modules are in `com.boxitt.app.di`.
- ViewModels are annotated with `@HiltViewModel`.

---

## 🔄 Development Process

### Adding a New Screen
1.  Define the route in `navigation/Screen.kt`.
2.  Create the Composable page in `pages/`.
3.  Create a corresponding `ViewModel` if business logic is required.
4.  Register the screen in `navigation/BoxittNavGraph.kt`.

### Database Changes
1.  Update the SQL in `supabase/migrations/`.
2.  Apply changes to the Supabase project.
3.  Update the Kotlin data models in `model/`.
4.  Update the `SupabaseService` or specific service class if query logic changes.

---

## 🧪 Testing

### Unit Tests
Located in `app/src/test/`. Focus on testing ViewModels and Repository logic.
```bash
./gradlew test
```

### Instrumented Tests (UI)
Located in `app/src/androidTest/`. Use **Compose Test** for UI validation.
```bash
./gradlew connectedAndroidTest
```

---

## 📝 Coding Guidelines

- **Naming**: Use `PascalCase` for Composables, `camelCase` for variables and functions.
- **State**: Prefer `mutableStateOf` for local UI state and `StateFlow` for ViewModel state.
- **Resources**: All strings must be in `res/values/strings.xml` for localization.
- **Preview**: Every reusable Composable should have a `@Preview` function.

---

## 🚀 Useful Commands

| Command | Action |
|---------|--------|
| `./gradlew clean` | Clean build artifacts |
| `./gradlew assembleDevDebug` | Build Dev APK |
| `./gradlew ktlintCheck` | Check code style |
| `./gradlew kspKotlin` | Run KSP symbol processing (for Hilt) |

---

## 🐛 Debugging Tips

- **Logcat**: Use `Log.d("Boxitt", message)` or the `ErrorHandler` to trace issues. Filter by `package:com.boxitt.app`.
- **Layout Inspector**: Use Android Studio's Layout Inspector to debug Compose hierarchies.
- **Database**: Use the Supabase Dashboard to monitor real-time changes and API logs.
