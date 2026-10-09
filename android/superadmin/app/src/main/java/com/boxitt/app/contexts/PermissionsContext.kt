package com.boxitt.app.contexts

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationManagerCompat
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.boxitt.app.services.PermissionState
import com.boxitt.app.services.Storage

enum class PermissionType {
    CAMERA, NOTIFICATIONS, FILES, LOCATION
}

object PermissionsManager {
    var permissionsState by mutableStateOf(Storage.getPermissions())
        private set

    var showPrompt by mutableStateOf<PermissionType?>(null)

    fun init() {
        permissionsState = Storage.getPermissions()
    }

    fun hasSystemPermission(context: Context, type: PermissionType): Boolean {
        val permissionStr = when (type) {
            PermissionType.CAMERA -> Manifest.permission.CAMERA
            PermissionType.NOTIFICATIONS -> {
                val systemEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
                if (!systemEnabled) return false
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    Manifest.permission.POST_NOTIFICATIONS
                } else {
                    return true
                }
            }
            PermissionType.LOCATION -> Manifest.permission.ACCESS_FINE_LOCATION
            PermissionType.FILES -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    Manifest.permission.READ_MEDIA_IMAGES
                } else {
                    Manifest.permission.READ_EXTERNAL_STORAGE
                }
            }
        }
        return ContextCompat.checkSelfPermission(context, permissionStr) == PackageManager.PERMISSION_GRANTED
    }

    fun openSettings(context: Context) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun requestAllPermissions(context: Context) {
        // Sync system status first
        PermissionType.values().forEach { type ->
            if (hasSystemPermission(context, type)) {
                val currentChoice = getChoice(type)
                // Only promote to "allow" if it was null or already allow.
                // If it was "later" or "never", respect the user's boundary.
                if (currentChoice == null) {
                    Storage.setPermission(type.name.lowercase(), "allow")
                }
            }
        }
        permissionsState = Storage.getPermissions()

        // Sequence: Notifications -> Location -> Camera -> Files
        val next = findNextMissing(context)
        if (next != null) {
            showPrompt = next
        }
    }

    private fun getChoice(type: PermissionType): String? {
        return when (type) {
            PermissionType.CAMERA -> permissionsState.camera
            PermissionType.NOTIFICATIONS -> permissionsState.notifications
            PermissionType.FILES -> permissionsState.files
            PermissionType.LOCATION -> permissionsState.location
        }
    }

    private fun findNextMissing(context: Context): PermissionType? {
        val order = listOf(PermissionType.NOTIFICATIONS, PermissionType.LOCATION, PermissionType.CAMERA, PermissionType.FILES)
        for (type in order) {
            if (!hasSystemPermission(context, type)) {
                val choice = getChoice(type)
                if (choice == null) return type
            }
        }
        return null
    }

    fun handleChoice(type: PermissionType, choice: String, context: Context? = null) {
        if (choice != "later") {
            Storage.setPermission(type.name.lowercase(), choice)
        }
        // For "later", we just update the in-memory state for this session
        permissionsState = when(type) {
            PermissionType.CAMERA -> permissionsState.copy(camera = choice)
            PermissionType.NOTIFICATIONS -> permissionsState.copy(notifications = choice)
            PermissionType.FILES -> permissionsState.copy(files = choice)
            PermissionType.LOCATION -> permissionsState.copy(location = choice)
        }

        showPrompt = null
        
        // If we are in the middle of requestAllPermissions, check for next
        if (context != null) {
            val next = findNextMissing(context)
            if (next != null) {
                showPrompt = next
            }
        }
    }

    fun checkAndPrompt(context: Context, type: PermissionType, force: Boolean = false): Boolean {
        if (hasSystemPermission(context, type)) {
            val currentVal = when (type) {
                PermissionType.CAMERA -> permissionsState.camera
                PermissionType.NOTIFICATIONS -> permissionsState.notifications
                PermissionType.FILES -> permissionsState.files
                PermissionType.LOCATION -> permissionsState.location
            }
            if (currentVal != "allow") {
                Storage.setPermission(type.name.lowercase(), "allow")
                permissionsState = Storage.getPermissions()
            }
            return true
        }

        val choice = when (type) {
            PermissionType.CAMERA -> permissionsState.camera
            PermissionType.NOTIFICATIONS -> permissionsState.notifications
            PermissionType.FILES -> permissionsState.files
            PermissionType.LOCATION -> permissionsState.location
        }

        if (choice == null || force || choice == "later") {
            showPrompt = type
        }
        return false
    }
}

val LocalPermissionsState: ProvidableCompositionLocal<PermissionState> = staticCompositionLocalOf { PermissionState() }

@Composable
fun PermissionsProvider(content: @Composable () -> Unit) {
    val state = PermissionsManager.permissionsState
    val context = androidx.compose.ui.platform.LocalContext.current
    
    CompositionLocalProvider(LocalPermissionsState provides state) {
        content()
        
        PermissionsManager.showPrompt?.let { type ->
            com.boxitt.app.components.PermissionPrompt(
                type = type,
                onChoice = { choice -> PermissionsManager.handleChoice(type, choice, context) },
                onClose = { PermissionsManager.showPrompt = null }
            )
        }
    }
}




