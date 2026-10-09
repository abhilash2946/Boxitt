package com.boxitt.app.repository

import com.boxitt.app.UserProfile
import com.boxitt.app.UserProfileUpdate
import com.boxitt.app.services.SessionManager
import com.boxitt.app.services.Supabase
import com.boxitt.app.services.UserService
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserRepository @Inject constructor(
    private val sessionManager: SessionManager
) {
    fun getProfile(userId: String): Flow<Result<UserProfile?>> = flow {
        try {
            val result = UserService.getUserProfile(userId)
            if (result.isSuccess) {
                val profile = result.getOrNull()
                if (profile != null) {
                    // Update session manager with fetched profile
                    sessionManager.saveSession(
                        id = userId,
                        email = profile.email,
                        role = profile.role ?: "user",
                        name = profile.displayName,
                        isComplete = profile.isComplete,
                        roleStatus = profile.role_status,
                        profile = profile
                    )
                }
                emit(Result.success(profile))
            } else {
                emit(Result.failure(result.exceptionOrNull() ?: Exception("Unknown error")))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }

    suspend fun fetchAndCacheProfile(userId: String): Result<UserProfile?> {
        return try {
            val result = UserService.getUserProfile(userId)
            val profile = result.getOrNull()
            if (profile != null) {
                sessionManager.saveSession(
                    id = userId,
                    email = profile.email,
                    role = profile.role ?: "user",
                    name = profile.displayName,
                    isComplete = profile.isComplete,
                    roleStatus = profile.role_status,
                    profile = profile
                )
            }
            result
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateProfile(updates: UserProfileUpdate): Result<UserProfile> {
        return try {
            val updated = Supabase.client.postgrest["user_profiles"].upsert(updates) {
                select()
                single()
            }.decodeAs<UserProfile>()

            sessionManager.saveSession(
                id = updates.id,
                email = updated.email,
                role = updated.role ?: "user",
                name = updated.displayName,
                isComplete = updated.isComplete,
                roleStatus = updated.role_status,
                profile = updated
            )
            
            Result.success(updated)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
