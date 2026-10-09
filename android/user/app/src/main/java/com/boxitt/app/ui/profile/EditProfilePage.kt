package com.boxitt.app.ui.profile

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.boxitt.app.UserProfile
import com.boxitt.app.UserProfileUpdate
import com.boxitt.app.components.EditProfileScreen
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.GeocodingService
import com.boxitt.app.services.SupabaseStorageService
import com.boxitt.app.services.Storage
import com.boxitt.app.services.UserService
import kotlinx.coroutines.launch

@Composable
fun EditProfilePage(
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onNavigate: (String) -> Unit,
    onUpdateComplete: ((Boolean) -> Unit)? = null,
    viewModel: ProfileViewModel = hiltViewModel()
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val uiState by viewModel.uiState.collectAsState()
    val PAGE_ID = "edit_profile"
    
    // Local state for the merged profile (fetched + saved state)
    var formProfile by remember { mutableStateOf<UserProfile?>(null) }

    val profile = uiState.user

    // Initial setup and merging with saved state
    LaunchedEffect(profile) {
        if (profile != null && formProfile == null) {
            val savedState = Storage.getPageState<UserProfile>(PAGE_ID)
            if (savedState != null && savedState.id == profile.id) {
                // Merging logic to match web exactly: fetched data is preferred,
                // saved state only fills what's missing in fetched data.
                val merged = profile.copy(
                    email = if (profile.email.isEmpty()) (savedState.email ?: "") else profile.email,
                    phone = if (profile.phone.isNullOrEmpty()) savedState.phone else profile.phone,
                    username = if (profile.username.isNullOrEmpty()) savedState.username else profile.username,
                    profileImage = if (profile.profileImage.isNullOrEmpty()) savedState.profileImage else profile.profileImage,
                    dob = if (profile.dob.isNullOrEmpty()) savedState.dob else profile.dob,
                    gender = if (profile.gender.isNullOrEmpty()) savedState.gender else profile.gender,
                    address = if (profile.address.isNullOrEmpty()) savedState.address else profile.address,
                    location = if (profile.location.isNullOrEmpty()) savedState.location else profile.location,
                    role = if (profile.role.isNullOrEmpty()) savedState.role else profile.role,
                    joinedDate = if (profile.joinedDate.isNullOrEmpty()) savedState.joinedDate else profile.joinedDate
                )
                formProfile = merged
            } else {
                formProfile = profile
            }
        }
    }

    // Handle success navigation
    LaunchedEffect(uiState.updateSuccess) {
        if (uiState.updateSuccess && profile != null) {
            Storage.clearPageState(PAGE_ID)
            
            val isComplete = profile.isComplete
            
            onAlert?.invoke("Profile updated successfully!", "success") {
                if (onUpdateComplete != null) {
                    onUpdateComplete(!isComplete)
                } else {
                    onNavigate("my-profile")
                }
            }
            viewModel.resetUpdateState()
        }
    }

    // Handle error alerts
    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            onAlert?.invoke(it, "error", null)
            viewModel.resetUpdateState()
        }
    }

    val currentProfile = formProfile
    
    // Handle system back button
    BackHandler {
        val isComplete = currentProfile?.isComplete ?: false

        if (onUpdateComplete != null) {
            onUpdateComplete(!isComplete)
        } else {
            onNavigate(if (isComplete) "my-profile" else "dashboard")
        }
    }

    if (currentProfile == null) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(theme.colors.background),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(
                    color = theme.colors.accent,
                    modifier = Modifier.size(48.dp),
                    strokeWidth = 4.dp
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "SYNCING PROFILE...",
                    style = TextStyle(
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 2.sp,
                        color = theme.colors.textDisabled
                    )
                )
            }
        }
        return
    }

    EditProfileScreen(
        profile = currentProfile,
        onBack = {
            val isComplete = currentProfile.isComplete

            if (onUpdateComplete != null) {
                onUpdateComplete(!isComplete)
            } else {
                onNavigate("my-profile")
            }
        },
        onSave = { updated ->
            scope.launch {
                try {
                    val userId = updated.id ?: return@launch
                    val old = profile ?: currentProfile

                    // Check for changes compared to database profile
                    fun hasChanged(n: String?, o: String?) = (n ?: "").trim() != (o ?: "").trim()

                    var display_name: String? = null
                    var username: String? = null
                    if (hasChanged(updated.username, old.username)) {
                        display_name = updated.username
                        username = updated.username
                    }

                    var phone_number: String? = null
                    if (hasChanged(updated.phone, old.phone_number ?: old.phone)) phone_number = updated.phone

                    var dob: String? = null
                    if (hasChanged(updated.dob, old.dob)) dob = updated.dob

                    var gender: String? = null
                    if (hasChanged(updated.gender, old.gender)) gender = updated.gender

                    var address: String? = null
                    if (hasChanged(updated.address, old.address)) address = updated.address

                    var location: String? = null
                    if (hasChanged(updated.location, old.location)) location = updated.location

                    var email: String? = null
                    if (hasChanged(updated.email, old.email)) email = updated.email

                    var latitude: Double? = null
                    var longitude: Double? = null

                    // Auto-geocode address if coordinates are missing or if address changed
                    if (!updated.address.isNullOrBlank() && (hasChanged(updated.address, old.address) || old.latitude == null)) {
                        try {
                            val coords = GeocodingService.getCoordinates(updated.address!!, updated.location ?: "")
                            if (coords != null) {
                                latitude = coords.latitude
                                longitude = coords.longitude
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }

                    var avatar_url: String? = null
                    var avatarChanged = false

                    // Handle Profile Image Upload
                    if (updated.profileImage?.startsWith("content://") == true || updated.profileImage?.startsWith("file://") == true) {
                        try {
                            val uri = Uri.parse(updated.profileImage)
                            val stream = context.contentResolver.openInputStream(uri)
                            if (stream != null) {
                                val fileName = "$userId/avatar-${System.currentTimeMillis()}"
                                val publicUrl = SupabaseStorageService.uploadFile(
                                    "profiles",
                                    fileName,
                                    stream,
                                    context.contentResolver.getType(uri) ?: "image/jpeg"
                                )

                                // Delete old avatar
                                val oldImage = old.avatar_url ?: old.profileImage
                                if (!oldImage.isNullOrEmpty() && oldImage.contains("/profiles/")) {
                                    val oldPath = oldImage.split("/profiles/").lastOrNull()
                                    if (oldPath != null) {
                                        SupabaseStorageService.deleteFile("profiles", oldPath)
                                    }
                                }
                                avatar_url = publicUrl
                                avatarChanged = true
                            }
                        } catch (e: Exception) {
                            onAlert?.invoke("Failed to upload profile picture.", "error", null)
                            return@launch
                        }
                    } else if (updated.profileImage.isNullOrEmpty() && !(old.avatar_url ?: old.profileImage).isNullOrEmpty()) {
                        avatar_url = null
                        avatarChanged = true
                        val oldImage = old.avatar_url ?: old.profileImage
                        if (!oldImage.isNullOrEmpty() && oldImage.contains("/profiles/")) {
                            val oldPath = oldImage.split("/profiles/").lastOrNull()
                            if (oldPath != null) {
                                SupabaseStorageService.deleteFile("profiles", oldPath)
                            }
                        }
                    }

                    var role: String? = null
                    var roleChanged = false
                    if (!updated.role.isNullOrEmpty() && updated.role != old.role) {
                        UserService.updateUserRole(userId, updated.role!!)
                        role = updated.role
                        roleChanged = true
                    }

                    val hasDataChanges = display_name != null || username != null || phone_number != null ||
                            dob != null || gender != null || address != null || location != null || email != null || 
                            avatarChanged || latitude != null || longitude != null

                    if (hasDataChanges || roleChanged) {
                        viewModel.updateProfile(
                            UserProfileUpdate(
                                id = userId,
                                display_name = display_name,
                                username = username,
                                phone_number = phone_number,
                                dob = dob,
                                gender = gender,
                                address = address,
                                location = location,
                                email = email,
                                avatar_url = avatar_url,
                                role = role,
                                latitude = latitude,
                                longitude = longitude
                            )
                        )
                        // Alert will be handled by LaunchedEffect(uiState.updateSuccess)
                    } else {
                        onAlert?.invoke("No changes detected.", "info", null)
                    }
                } catch (e: Exception) {
                    onAlert?.invoke("Save failed: ${e.message}", "error", null)
                }
            }
        },
        onChange = {
            formProfile = it
            Storage.setPageState(PAGE_ID, it)
        },
        onAlert = onAlert,
        isSaving = uiState.isUpdating
    )
}
