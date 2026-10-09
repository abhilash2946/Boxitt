package com.boxitt.app.network

import android.util.Log
import com.boxitt.app.BuildConfig
import com.boxitt.app.services.TokenManager
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        // Blocking is necessary here because intercept() is not a suspend function
        val token = runBlocking {
            tokenManager.accessToken.firstOrNull()
        }

        Log.d("API_AUTH", "Request URL: ${originalRequest.url}")

        val newRequestBuilder = originalRequest.newBuilder()
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)

        if (!token.isNullOrEmpty()) {
            newRequestBuilder.header("Authorization", "Bearer $token")
        } else {
            newRequestBuilder.header("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
        }

        val response = chain.proceed(newRequestBuilder.build())
        Log.d("API_AUTH", "API Response Code: ${response.code} for ${originalRequest.url}")

        return response
    }
}
