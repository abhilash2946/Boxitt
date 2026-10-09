package com.boxitt.app.components

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Info
import androidx.compose.ui.platform.LocalContext
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.contexts.PermissionType

enum class PromptState {
    INITIAL, REQUESTING, INSTRUCTIONS
}

@Composable
fun PermissionPrompt(
    type: PermissionType,
    onChoice: (String) -> Unit,
    onClose: () -> Unit
) {
    val theme = LocalAppTheme.current
    // Reset state whenever the permission type changes
    var state by remember(type) { mutableStateOf(PromptState.INITIAL) }

    val config = remember(type) {
        when (type) {
            PermissionType.CAMERA -> Triple("Camera", Icons.Default.CameraAlt, Color(0xFF0B57D0))
            PermissionType.NOTIFICATIONS -> Triple("Notifications", Icons.Default.Notifications, Color(0xFFE91E63))
            PermissionType.FILES -> Triple("Files", Icons.Default.Folder, Color(0xFF4CAF50))
            PermissionType.LOCATION -> Triple("Location", Icons.Default.Place, Color(0xFF0B57D0))
        }
    }
    val title = config.first
    val icon = config.second
    val iconColor = config.third

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            onChoice(if (state == PromptState.REQUESTING) "allow" else "later")
        } else {
            state = PromptState.INSTRUCTIONS
        }
    }

    fun launchSystemPrompt(isPermanent: Boolean) {
        val permission = when (type) {
            PermissionType.CAMERA -> Manifest.permission.CAMERA
            PermissionType.LOCATION -> Manifest.permission.ACCESS_FINE_LOCATION
            PermissionType.NOTIFICATIONS -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) Manifest.permission.POST_NOTIFICATIONS else null
            PermissionType.FILES -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) Manifest.permission.READ_MEDIA_IMAGES else Manifest.permission.READ_EXTERNAL_STORAGE
        }

        if (permission != null) {
            state = if (isPermanent) PromptState.REQUESTING else PromptState.INITIAL // Use INITIAL state for "this time" to keep it less intrusive
            launcher.launch(permission)
        } else {
            onChoice("allow")
        }
    }

    Dialog(onDismissRequest = onClose) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xFF1A1A1A))
                .border(1.dp, Color(0xFF2C2C2C), RoundedCornerShape(24.dp))
                .padding(24.dp)
        ) {
            when (state) {
                PromptState.INITIAL -> {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .background(iconColor.copy(alpha = 0.2f), RoundedCornerShape(12.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = icon,
                                    contentDescription = null,
                                    tint = iconColor
                                )
                            }
                            Spacer(modifier = Modifier.width(16.dp))
                            Column {
                                Text(
                                    text = "Allow $title?",
                                    color = Color.White,
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "REQUEST FROM BOXITT APP",
                                    color = Color.White.copy(alpha = 0.5f),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    letterSpacing = 1.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = { launchSystemPrompt(true) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0B57D0)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Allow while visiting", color = Color.White, fontWeight = FontWeight.Bold)
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                    contentDescription = null,
                                    tint = Color.White
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Button(
                            onClick = { launchSystemPrompt(false) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.05f)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Allow this time", color = Color.White, fontWeight = FontWeight.Bold)
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "NEVER ALLOW",
                            color = Color.White.copy(alpha = 0.4f),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onChoice("never")
                                }
                                .padding(vertical = 8.dp)
                        )
                    }
                }
                PromptState.REQUESTING -> {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator(color = Color(0xFF0B57D0))
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Requesting permission...", color = Color.White, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Please allow the system prompt if it appears.",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Text(
                            text = "PROMPT NOT APPEARING?",
                            color = Color(0xFF0B57D0),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.clickable { state = PromptState.INSTRUCTIONS }
                        )
                    }
                }
                PromptState.INSTRUCTIONS -> {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.Info, contentDescription = null, tint = Color.Yellow)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Action Required", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        }
                        Spacer(modifier = Modifier.height(16.dp))

                        val instructionText = when(type) {
                            PermissionType.NOTIFICATIONS -> "System notifications are disabled. Please enable them in settings to receive updates."
                            else -> "The app needs $title permission to function correctly. Please enable it in the system settings."
                        }

                        Text(
                            text = instructionText,
                            color = Color.White.copy(alpha = 0.7f),
                            fontSize = 13.sp,
                            lineHeight = 18.sp
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        val context = LocalContext.current
                        Button(
                            onClick = {
                                com.boxitt.app.contexts.PermissionsManager.openSettings(context)
                                onClose()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0B57D0)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Settings, null, tint = Color.White, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Open App Settings", color = Color.White, fontWeight = FontWeight.Bold)
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Button(
                            onClick = {
                                onChoice("later")
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.1f)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Maybe Later", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}



