package com.boxitt.app.services

import android.util.Log
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.logging.LogLevel
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.realtime.Realtime

object Supabase {
    private const val SUPABASE_URL = "https://zyeiahsundnitjitapni.supabase.co"
    const val BASE_URL = SUPABASE_URL
    private const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5ZWlhaHN1bmRuaXRqaXRhcG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDE5NTksImV4cCI6MjA4NTUxNzk1OX0.KU3o1_iLGX3a7Qo7lfx-ub3nOlrJoNbdXIpJ8DUQuOM"

    val client by lazy {
        if (SUPABASE_URL.isEmpty() || SUPABASE_ANON_KEY.isEmpty()) {
            Log.w("Supabase", "Supabase environment variables are missing. Please configure them.")
        }
        createSupabaseClient(
            supabaseUrl = SUPABASE_URL.ifEmpty { "https://placeholder.supabase.co" },
            supabaseKey = SUPABASE_ANON_KEY.ifEmpty { "placeholder" }
        ) {
            install(Postgrest)
            install(Auth) {
                autoRefreshToken = true
            }
            install(Storage)
            install(Realtime)
        }
    }
}




