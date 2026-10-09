package com.boxitt.app.pages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.boxitt.app.services.SessionManager
import com.boxitt.app.services.TokenManager
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.user.UserSession
import com.boxitt.app.models.UserProfile
import com.boxitt.app.models.toDomainProfile
import com.boxitt.app.network.ApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val isSuccess: Boolean = false,
    val error: String? = null,
    val roleStatus: String? = null,
    val requiresVerification: Boolean = false,
    val isProfileComplete: Boolean = false,
    val isResending: Boolean = false,
    val pendingVerificationEmail: String? = null,
    val isAlreadyRegistered: Boolean = false
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val apiService: ApiService,
    private val tokenManager: TokenManager,
    private val sessionManager: SessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun login(email: String, pass: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            tokenManager.clearToken()
            sessionManager.clearSession()
            try {
                val response = apiService.login(mapOf(
                    "email" to email,
                    "password" to pass
                ))

                tokenManager.saveToken(response.accessToken, response.refreshToken)
                Supabase.client.auth.importSession(
                    UserSession(
                        accessToken = response.accessToken,
                        refreshToken = response.refreshToken,
                        expiresIn = 3600,
                        tokenType = "bearer",
                        user = null
                    )
                )

                val profiles = apiService.getUserProfile("eq.${response.user.id}")
                val profile = profiles.firstOrNull()

                val roleStatus = if (profile?.role == "superadmin") {
                    profile.roleStatus ?: "approved"
                } else if (profile?.role == "admin") {
                    profile.roleStatus ?: "pending"
                } else {
                    "approved" // Default for user
                }

                if (roleStatus == "rejected") {
                    tokenManager.clearToken()
                    sessionManager.clearSession()
                    _uiState.update { it.copy(isLoading = false, error = "Your account request was rejected. Please contact support.") }
                    return@launch
                }

                val isComplete = profile?.toDomainProfile()?.isComplete ?: false

                sessionManager.saveSession(
                    id = response.user.id,
                    email = response.user.email,
                    role = profile?.role ?: "user",
                    name = profile?.displayName ?: profile?.username ?: response.user.email.substringBefore("@"),
                    isComplete = isComplete,
                    roleStatus = roleStatus,
                    profile = profile?.toDomainProfile()
                )

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isSuccess = true,
                        roleStatus = roleStatus,
                        isProfileComplete = isComplete
                    )
                }
            } catch (e: Exception) {
                tokenManager.clearToken()
                sessionManager.clearSession()
                _uiState.update {
                    it.copy(isLoading = false, error = mapSupabaseError(e))
                }
            }
        }
    }

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            tokenManager.clearToken()
            sessionManager.clearSession()
            try {
                val response = apiService.googleLogin(mapOf(
                    "id_token" to idToken,
                    "grant_type" to "id_token"
                ))

                tokenManager.saveToken(response.accessToken, response.refreshToken)
                Supabase.client.auth.importSession(
                    UserSession(
                        accessToken = response.accessToken,
                        refreshToken = response.refreshToken,
                        expiresIn = 3600,
                        tokenType = "bearer",
                        user = null
                    )
                )

                val userId = response.user.id
                val email = response.user.email
                val profiles = try {
                    apiService.getUserProfile("eq.$userId")
                } catch (e: Exception) {
                    emptyList<UserProfile>()
                }
                val profile = profiles.firstOrNull()

                val isComplete = profile?.toDomainProfile()?.isComplete ?: false

                sessionManager.saveSession(
                    id = userId,
                    email = email,
                    role = profile?.role ?: "user",
                    name = profile?.displayName ?: profile?.username ?: email.substringBefore("@"),
                    isComplete = isComplete,
                    roleStatus = profile?.roleStatus,
                    profile = profile?.toDomainProfile()
                )

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isSuccess = true,
                        roleStatus = profile?.roleStatus ?: "approved",
                        isProfileComplete = isComplete
                    )
                }
            } catch (e: Exception) {
                tokenManager.clearToken()
                sessionManager.clearSession()
                _uiState.update {
                    it.copy(isLoading = false, error = "Google Sign-In failed: ${e.localizedMessage}")
                }
            }
        }
    }

    fun handleSession(accessToken: String, refreshToken: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            tokenManager.clearToken()
            sessionManager.clearSession()
            try {
                tokenManager.saveToken(accessToken, refreshToken)
                Supabase.client.auth.importSession(
                    UserSession(
                        accessToken = accessToken,
                        refreshToken = refreshToken,
                        expiresIn = 3600,
                        tokenType = "bearer",
                        user = null
                    )
                )

                val authUser = apiService.getCurrentUser()
                val userId = authUser.id
                val profiles = apiService.getUserProfile("eq.$userId")
                val profile = profiles.firstOrNull()

                if (profile != null) {
                    val domainProfile = profile.toDomainProfile()
                    val isComplete = domainProfile.isComplete

                    sessionManager.saveSession(
                        id = userId,
                        email = authUser.email,
                        role = profile.role ?: "user",
                        name = profile.displayName ?: profile.username ?: authUser.email.substringBefore("@"),
                        isComplete = isComplete,
                        roleStatus = profile.roleStatus,
                        profile = domainProfile
                    )
                    _uiState.update {
                        it.copy(isLoading = false, isSuccess = true, isProfileComplete = isComplete)
                    }
                } else {
                    sessionManager.saveSession(
                        id = userId,
                        email = authUser.email,
                        role = "user",
                        name = authUser.email.substringBefore("@"),
                        isComplete = false
                    )
                    _uiState.update {
                        it.copy(isLoading = false, isSuccess = true, isProfileComplete = false)
                    }
                }
            } catch (e: Exception) {
                tokenManager.clearToken()
                sessionManager.clearSession()
                _uiState.update {
                    it.copy(isLoading = false, error = "Session recovery failed: ${e.message}")
                }
            }
        }
    }

    fun signUp(email: String, pass: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                apiService.signUp(mapOf(
                    "email" to email,
                    "password" to pass
                ))
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isSuccess = true,
                        requiresVerification = true,
                        pendingVerificationEmail = email.trim()
                    )
                }
            } catch (e: Exception) {
                val mapped = mapSupabaseError(e)
                if (mapped.contains("already in our team") || mapped.contains("already registered")) {
                    _uiState.update {
                        it.copy(isLoading = false, error = null, isAlreadyRegistered = true)
                    }
                } else {
                    _uiState.update {
                        it.copy(isLoading = false, error = mapped)
                    }
                }
            }
        }
    }

    fun resendVerificationEmail(email: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isResending = true, error = null) }
            try {
                apiService.resend(mapOf(
                    "type" to "signup",
                    "email" to email
                ))
                _uiState.update { it.copy(isResending = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isResending = false, error = "Unable to resend verification email: ${e.message}") }
            }
        }
    }

    fun forgotPassword(email: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                apiService.recover(mapOf("email" to email))
                _uiState.update { it.copy(isLoading = false, isSuccess = true) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = mapSupabaseError(e)) }
            }
        }
    }

    private fun mapSupabaseError(e: Exception): String {
        val msg = e.localizedMessage ?: return "An unexpected error occurred"
        return when {
            msg.contains("Invalid login credentials") -> "Invalid email or password. Please try again."
            msg.contains("Email not confirmed") -> "Please verify your email before entering the arena."
            msg.contains("User already registered") -> "This email is already in our team. Try signing in."
            msg.contains("Password is too short") -> "Your password needs at least 6 characters for security."
            msg.contains("limit exceeded") -> "Too many attempts. Please try again in a few minutes."
            else -> msg
        }
    }
}
