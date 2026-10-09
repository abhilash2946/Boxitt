package com.boxitt.app.services

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

private val Context.tokenDataStore: DataStore<Preferences> by preferencesDataStore(name = "tokens")

@Singleton
class TokenManager @Inject constructor(@ApplicationContext private val context: Context) {
    private val ACCESS_TOKEN = stringPreferencesKey("access_token")
    private val REFRESH_TOKEN = stringPreferencesKey("refresh_token")

    val accessToken: Flow<String?> = context.tokenDataStore.data.map { it[ACCESS_TOKEN] }
    val refreshToken: Flow<String?> = context.tokenDataStore.data.map { it[REFRESH_TOKEN] }

    suspend fun saveToken(token: String, refresh: String? = null) {
        context.tokenDataStore.edit { prefs ->
            prefs[ACCESS_TOKEN] = token
            refresh?.let { prefs[REFRESH_TOKEN] = it }
        }
    }

    suspend fun clearToken() {
        context.tokenDataStore.edit { it.clear() }
    }
}
