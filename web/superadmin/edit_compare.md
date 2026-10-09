# Edit Profile Comparison: Web/Capacitor vs Native Android

This document provides a detailed comparison of the `Edit Profile` screen fields and their mandatory status across the Web/Capacitor implementation and the Native Android implementation.

## Overview

- **Web / Capacitor Android**: Uses React with TypeScript (`EditProfileScreen.tsx`). The logic for completeness is shared across web and the Capacitor-wrapped mobile app.
- **Native Android**: Uses Jetpack Compose with Kotlin (`EditProfileScreen.kt`). This is a separate implementation specifically for the native Android version of the app.

## Field Comparison Table

| Field Name | Web / Capacitor | Mandatory (Web) | Native Android | Mandatory (Native) |
| :--- | :---: | :---: | :---: | :---: |
| **Email Address** | Yes | **Yes** | Yes | **Yes** |
| **Username** | Yes | **Yes** | Yes | **Yes** |
| **Phone Number** | Yes | **Yes** (10 digits) | Yes | **Yes** (10 digits) |
| **Date of Birth** | Yes | **Yes** | Yes | **Yes** |
| **Gender** | Yes | **Yes** | Yes | **Yes** |
| **Account Role** | Yes | **Yes** | Yes | **Yes** |
| **Current Address** | Yes | **Yes** | Yes | **Yes** |
| **Location (City/Area)** | Yes | No | Yes | No |
| **Profile Image** | Yes | No | Yes | No |
| **Bio** | No | - | No | - |
| **Joined Date** | Yes (Read-only) | No | Yes (Read-only) | No |

## Detailed Breakdown

### 1. Mandatory Fields (The "Core 7")
Both platforms strictly enforce the same 7 mandatory fields for a profile to be considered "complete":
1.  **Email Address**: Validated as a non-empty string.
2.  **Username**: Validated as a non-empty string.
3.  **Phone Number**: Must be exactly **10 digits**.
4.  **Date of Birth**: Must be selected via a date picker.
5.  **Gender**: Selected from a dropdown (Male, Female, Other).
6.  **Account Role**: Selected from a dropdown (User, Admin, Superadmin).
7.  **Current Address**: Validated as a non-empty string.

### 2. Optional Fields
- **Profile Image**: On both platforms, the profile image can be empty. The user can save their profile and use the app without uploading a picture.
- **Location**: While the app often fetches the city/area automatically when using "Current Location", it is NOT a blocking field for saving the profile on either platform.

### 3. Implementation Differences

#### Web / Capacitor (`EditProfileScreen.tsx`)
- **UI Framework**: React, Tailwind CSS, Framer Motion.
- **Validation**: Uses a JavaScript array `every()` check on the form state.
- **Storage**: Persists transient form data to `localStorage` to prevent data loss on refresh.

#### Native Android (`EditProfileScreen.kt`)
- **UI Framework**: Jetpack Compose (Kotlin).
- **Validation**: Uses a Kotlin `all { it.trim().isNotEmpty() }` check on the state object.
- **Storage**: Uses a custom `Storage` service in Kotlin that mirrors the web's `localStorage` behavior for consistency.

## Summary of Findings
The **Web** and **Native Android** versions of Boxitt are perfectly synced regarding profile requirements. Both require exactly the same 7 fields and treat the profile picture as an optional enhancement rather than a requirement for app usage.
