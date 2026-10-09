package com.boxitt.app.services

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.boxitt.app.UserProfile
import com.boxitt.app.services.Storage
import kotlinx.serialization.encodeToString
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "session")

@Singleton
class SessionManager @Inject constructor(@ApplicationContext private val context: Context) {
    private val USER_ID = stringPreferencesKey("user_id")
    private val USER_EMAIL = stringPreferencesKey("user_email")
    private val USER_ROLE = stringPreferencesKey("user_role")
    private val USER_ROLE_STATUS = stringPreferencesKey("user_role_status")
    private val IS_LOGGED_IN = booleanPreferencesKey("is_logged_in")
    private val USER_NAME = stringPreferencesKey("user_name")
    private val APP_THEME = stringPreferencesKey("app_theme")
    private val IS_PROFILE_COMPLETE = booleanPreferencesKey("is_profile_complete")
    private val USER_PROFILE_JSON = stringPreferencesKey("user_profile_json")

    val userId: Flow<String?> = context.sessionDataStore.data.map { it[USER_ID] }
    val isLoggedIn: Flow<Boolean> = context.sessionDataStore.data.map { it[IS_LOGGED_IN] ?: false }
    val appTheme: Flow<String> = context.sessionDataStore.data.map { it[APP_THEME] ?: "DARK" }
    val isProfileComplete: Flow<Boolean> = context.sessionDataStore.data.map { it[IS_PROFILE_COMPLETE] ?: false }

    val userProfile: Flow<UserProfile?> = context.sessionDataStore.data.map { preferences ->
        preferences[USER_PROFILE_JSON]?.let { json ->
            try {
                Storage.json.decodeFromString<UserProfile>(json)
            } catch (e: Exception) {
                null
            }
        }
    }

    suspend fun saveSession(id: String, email: String, role: String, name: String?, isComplete: Boolean = false, roleStatus: String? = null, profile: UserProfile? = null) {
        context.sessionDataStore.edit { preferences ->
            preferences[USER_ID] = id
            preferences[USER_EMAIL] = email
            preferences[USER_ROLE] = role
            roleStatus?.let { preferences[USER_ROLE_STATUS] = it }
            preferences[IS_LOGGED_IN] = true
            preferences[IS_PROFILE_COMPLETE] = isComplete
            name?.let { preferences[USER_NAME] = it }
            profile?.let {
                preferences[USER_PROFILE_JSON] = Storage.json.encodeToString(it)
            }
        }
    }

    suspend fun saveTheme(theme: String) {
        context.sessionDataStore.edit { it[APP_THEME] = theme }
    }

    suspend fun clearSession() {
        context.sessionDataStore.edit { it.clear() }
    }
}
