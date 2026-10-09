package com.boxitt.app.network

import com.boxitt.app.models.AuthResponse
import com.boxitt.app.models.AuthUser
import com.boxitt.app.models.UserProfile
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface ApiService {
    @POST("auth/v1/signup")
    suspend fun signUp(@Body request: Map<String, String>): AuthResponse

    @POST("auth/v1/token?grant_type=password")
    suspend fun login(@Body request: Map<String, String>): AuthResponse

    @POST("auth/v1/token?grant_type=id_token")
    suspend fun googleLogin(@Body request: Map<String, String>): AuthResponse

    @GET("auth/v1/user")
    suspend fun getCurrentUser(): AuthUser

    @POST("auth/v1/recover")
    suspend fun recover(@Body request: Map<String, String>)

    @POST("auth/v1/resend")
    suspend fun resend(@Body request: Map<String, String>)

    @GET("rest/v1/user_profiles")
    suspend fun getUserProfile(
        @Query("id") id: String,
        @Query("select") select: String = "*"
    ): List<UserProfile>
}
