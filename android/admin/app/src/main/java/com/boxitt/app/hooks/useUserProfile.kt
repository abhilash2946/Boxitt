package com.boxitt.app.hooks

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.boxitt.app.UserProfile
import com.boxitt.app.services.UserService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class UserProfileViewModel(private val scope: CoroutineScope) {
    var userProfile by mutableStateOf<UserProfile?>(null)
        private set
    var currentUserProfile by mutableStateOf<UserProfile?>(null)
        private set
    var currentUserRole by mutableStateOf<String?>(null)
        private set
    var searchResults by mutableStateOf<List<UserProfile>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMsg by mutableStateOf<String?>(null)
        private set

    fun fetchUserProfile(userId: String) {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val result = UserService.getUserProfile(userId)
                if (result.isFailure) {
                    errorMsg = result.exceptionOrNull()?.message
                } else {
                    userProfile = result.getOrNull()
                }
            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to fetch user profile"
            } finally {
                isLoading = false
            }
        }
    }

    fun fetchCurrentUserProfile() {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val result = UserService.getCurrentUserProfile()
                if (result.isFailure) {
                    errorMsg = result.exceptionOrNull()?.message
                } else {
                    currentUserProfile = result.getOrNull()
                }
            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to fetch current profile"
            } finally {
                isLoading = false
            }
        }
    }

    fun fetchCurrentUserRole() {
        scope.launch {
            try {
                val result = UserService.getCurrentUserRole()
                if (result.isSuccess) {
                    currentUserRole = result.getOrNull()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun searchUsers(query: String, searchType: String = "all") {
        if (query.trim().length < 2) {
            searchResults = emptyList()
            return
        }
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val result = UserService.searchUsers(query, searchType)
                if (result.isFailure) {
                    errorMsg = result.exceptionOrNull()?.message
                } else {
                    searchResults = result.getOrNull() ?: emptyList()
                }
            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to search users"
            } finally {
                isLoading = false
            }
        }
    }

    fun updateUserRole(userId: String, role: String, onComplete: (Boolean) -> Unit = {}) {
        scope.launch {
            try {
                val result = UserService.updateUserRole(userId, role)
                if (result.isSuccess) {
                    if (userId == currentUserProfile?.id) {
                        fetchCurrentUserProfile()
                        fetchCurrentUserRole()
                    }
                    fetchUserProfile(userId)
                    onComplete(true)
                } else {
                    onComplete(false)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                onComplete(false)
            }
        }
    }
}




