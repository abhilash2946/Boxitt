package com.boxitt.app.services

import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        
        // Supabase anon key from the Supabase service object
        val anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5ZWlhaHN1bmRuaXRqaXRhcG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDE5NTksImV4cCI6MjA4NTUxNzk1OX0.KU3o1_iLGX3a7Qo7lfx-ub3nOlrJoNbdXIpJ8DUQuOM"

        val token = runBlocking {
            tokenManager.accessToken.firstOrNull()
        }

        val newRequestBuilder = originalRequest.newBuilder()
            .header("apikey", anonKey)

        if (!token.isNullOrEmpty()) {
            newRequestBuilder.header("Authorization", "Bearer $token")
        } else {
            newRequestBuilder.header("Authorization", "Bearer $anonKey")
        }

        return chain.proceed(newRequestBuilder.build())
    }
}
