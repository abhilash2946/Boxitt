package com.boxitt.app.services

import com.boxitt.app.*
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.Google
import io.github.jan.supabase.gotrue.providers.builtin.Email
import io.github.jan.supabase.gotrue.OtpType
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Serializable
data class AdminAccount(
    val id: String? = null,
    val username: String,
    val password: String,
    val is_superadmin: Boolean = false
)

@Serializable
data class SuperAdminRpcResult(
    val success: Boolean,
    val message: String
)

@Serializable
data class SignUpResult(
    val user: UserProfile? = null,
    val error: String? = null,
    val requiresEmailVerification: Boolean = false,
    val isExistingUser: Boolean = false
)

object AuthService {

    private fun normalizeAuthError(error: Throwable, fallbackMessage: String): String {
        val message = error.message ?: return fallbackMessage
        val textForChecks = message.lowercase()
        if (textForChecks.contains("gateway timeout") ||
            textForChecks.contains("timed out") ||
            textForChecks.contains("timeout")
        ) {
            return "Email signup is temporarily unavailable due to a server timeout. Please try again in a minute or continue with Google sign-in."
        }
        return message
    }

    suspend fun ensureUserProfile(user: UserProfile?): UserProfile? {
        if (user == null || user.id == null) return null
        return try {
            val payload = buildJsonObject {
                put("id", user.id)
                put("email", user.email)
                put("display_name", user.display_name ?: user.username)
            }
            val data = Supabase.client.postgrest["user_profiles"]
                .upsert(payload) {
                    select()
                    single()
                }.decodeAs<UserProfile>()
            data
        } catch (e: Exception) {
            null
        }
    }

    suspend fun verifySuperPassword(password: String): AdminAccount? {
        return try {
            // Web parity: check "superadmin" username first
            val admin = Supabase.client.postgrest["admin_accounts"]
                .select {
                    filter {
                        ilike("username", "superadmin")
                        eq("password", password)
                    }
                    single()
                }.decodeAs<AdminAccount>()
            return admin
        } catch (e: Exception) {
            // Fallback: check matching user email
            try {
                val user = Supabase.client.auth.currentUserOrNull()
                val userEmail = user?.email
                if (userEmail != null) {
                    val personalAdmin = Supabase.client.postgrest["admin_accounts"]
                        .select {
                            filter {
                                ilike("username", userEmail)
                                eq("password", password)
                                eq("is_superadmin", true)
                            }
                            single()
                        }.decodeAs<AdminAccount>()
                    return personalAdmin
                }
            } catch (e2: Exception) { }
            null
        }
    }

    suspend fun changeSuperAdminPassword(currentPassword: String, newPassword: String): Result<Unit> {
        return try {
            val params = buildJsonObject {
                put("p_current_password", currentPassword)
                put("p_new_password", newPassword)
            }
            val response = Supabase.client.postgrest.rpc(
                "change_super_admin_password",
                params
            )
            
            val rpcResult = response.decodeAs<SuperAdminRpcResult>()
            if (rpcResult.success) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(rpcResult.message))
            }
        } catch (e: Exception) {
            // Fallback for unexpected response formats
            try {
                val params = buildJsonObject {
                    put("p_current_password", currentPassword)
                    put("p_new_password", newPassword)
                }
                val data = Supabase.client.postgrest.rpc(
                    "change_super_admin_password",
                    params
                ).data
                if (data.contains("\"success\":true") || data.contains("\"success\": true")) {
                    return Result.success(Unit)
                }
            } catch (e2: Exception) {}
            Result.failure(e)
        }
    }

    suspend fun updateSuperAdminPassword(adminId: String, newPassword: String): Result<Unit> {
        // Deprecated: Use changeSuperAdminPassword instead which handles verification and update atomically
        return Result.failure(Exception("Deprecated. Use changeSuperAdminPassword instead."))
    }

    suspend fun logOut() {
        try {
            Supabase.client.auth.signOut()
        } catch (e: Exception) {
            // Ignored
        }
    }

    suspend fun signUp(email: String, password: String, selectedRole: String = "user"): SignUpResult {
        return try {
            val response = Supabase.client.auth.signUpWith(Email) {
                this.email = email
                this.password = password
            }
            
            val isExistingUser = false 
            val requiresEmailVerification = true // Typically true after signup if using confirmation
            
            val roleStatus = if (selectedRole == "user") "approved" else "pending"
            val requestedRole = if (selectedRole == "user") null else selectedRole
            
            val userProfile = UserProfile(
                id = response?.id,
                email = email,
                role = "user",
                role_status = roleStatus,
                requested_role = requestedRole
            )
            
            Supabase.client.postgrest["user_profiles"].upsert(userProfile)
            
            SignUpResult(
                user = userProfile,
                requiresEmailVerification = requiresEmailVerification,
                isExistingUser = isExistingUser
            )
        } catch (e: Exception) {
            val isExistingUser = e.message?.contains("already exists", ignoreCase = true) == true ||
                    e.message?.contains("already registered", ignoreCase = true) == true
            
            SignUpResult(
                error = normalizeAuthError(e, "Unable to create account right now. Please try again shortly."),
                isExistingUser = isExistingUser
            )
        }
    }

    suspend fun resendVerificationEmail(email: String): Result<Unit> {
        return try {
            Supabase.client.auth.resendEmail(
                type = io.github.jan.supabase.gotrue.OtpType.Email.SIGNUP,
                email = email
            )
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signIn(email: String, password: String): Result<UserProfile?> {
        return try {
            Supabase.client.auth.signInWith(Email) {
                this.email = email
                this.password = password
            }
            val user = Supabase.client.auth.currentUserOrNull()
            val profile = if (user != null) {
                ensureUserProfile(UserProfile(id = user.id, email = email))
            } else {
                null
            }
            Result.success(profile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signInWithGoogle(): Result<Unit> {
        return try {
            Supabase.client.auth.signInWith(
                provider = Google,
                redirectUrl = "com.boxitt.app://auth-callback"
            )
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun resetPassword(email: String): Result<Unit> {
        return try {
            Supabase.client.auth.resetPasswordForEmail(email)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createUserProfile(
        displayName: String,
        avatarUrl: String? = null,
        phone: String? = null,
        dob: String? = null,
        gender: String? = null,
        address: String? = null,
        location: String? = null,
        joinedDate: String? = null,
        selectedRole: String = "user"
    ): Result<UserProfile?> {
        return try {
            val userInfo = Supabase.client.auth.retrieveUserForCurrentSession()
            val roleStatus = if (selectedRole == "user") "approved" else "pending"
            val requestedRole = if (selectedRole == "user") null else selectedRole

            val payload = UserProfile(
                id = userInfo.id,
                email = userInfo.email ?: "",
                display_name = displayName,
                avatar_url = avatarUrl,
                phone_number = phone,
                dob = dob,
                gender = gender,
                address = address,
                location = location,
                joined_date = joinedDate,
                role = "user",
                role_status = roleStatus,
                requested_role = requestedRole
            )

            val profile = Supabase.client.postgrest["user_profiles"]
                .upsert(payload) {
                    select()
                    single()
                }.decodeAs<UserProfile>()
            Result.success(profile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updatePassword(newPassword: String): Result<Unit> {
        return try {
            Supabase.client.auth.modifyUser {
                password = newPassword
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}




