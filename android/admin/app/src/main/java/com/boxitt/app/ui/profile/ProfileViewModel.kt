package com.boxitt.app.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.boxitt.app.UserProfile
import com.boxitt.app.UserProfileUpdate
import com.boxitt.app.repository.UserRepository
import com.boxitt.app.services.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileUiState(
    val user: UserProfile? = null,
    val isLoading: Boolean = false,
    val isUpdating: Boolean = false,
    val updateSuccess: Boolean = false,
    val error: String? = null,
    val currentUserId: String? = null
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val sessionManager: SessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        observeProfile()
        refreshProfile()
    }

    private fun observeProfile() {
        viewModelScope.launch {
            sessionManager.userProfile.collect { user ->
                _uiState.update { it.copy(user = user, isLoading = false) }
            }
        }
        
        viewModelScope.launch {
            sessionManager.userId.collect { id ->
                _uiState.update { it.copy(currentUserId = id) }
            }
        }
    }

    fun refreshProfile() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            sessionManager.userId.firstOrNull()?.let { id ->
                userRepository.fetchAndCacheProfile(id)
            }
            _uiState.update { it.copy(isLoading = false) }
        }
    }

    fun updateProfile(updates: UserProfileUpdate) {
        viewModelScope.launch {
            _uiState.update { it.copy(isUpdating = true, updateSuccess = false, error = null) }
            
            val result = userRepository.updateProfile(updates)
            result.onSuccess {
                _uiState.update { it.copy(isUpdating = false, updateSuccess = true) }
            }.onFailure { err ->
                _uiState.update { it.copy(isUpdating = false, error = err.message) }
            }
        }
    }

    fun resetUpdateState() {
        _uiState.update { it.copy(updateSuccess = false, error = null) }
    }
}
