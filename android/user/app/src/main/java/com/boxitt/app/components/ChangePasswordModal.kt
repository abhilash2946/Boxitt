package com.boxitt.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.AuthService
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.gotrue.auth
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChangePasswordModal(
    onClose: () -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    userEmail: String,
    scope: CoroutineScope = rememberCoroutineScope()
) {
    val theme = LocalAppTheme.current
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }

    var showCurrent by remember { mutableStateOf(false) }
    var showNew by remember { mutableStateOf(false) }
    var showConfirm by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onClose) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .clip(RoundedCornerShape(theme.radius.large))
                .background(theme.colors.card)
                .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(theme.colors.backgroundSecondary.copy(alpha = 0.2f))
                        .border(1.dp, theme.colors.border.copy(alpha = 0.4f))
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(theme.colors.accent.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = theme.colors.accent
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "SECURITY",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textPrimary,
                            letterSpacing = 3.sp
                        )
                    }
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = theme.colors.textDisabled,
                        modifier = Modifier.clickable { onClose() }
                    )
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    val fields = listOf(
                        Triple("Current Password", currentPassword, showCurrent) to { text: String -> currentPassword = text },
                        Triple("New Password", newPassword, showNew) to { text: String -> newPassword = text },
                        Triple("Confirm Password", confirmPassword, showConfirm) to { text: String -> confirmPassword = text }
                    )

                    fields.forEach { pair ->
                        val (label, value, show) = pair.first
                        val setter = pair.second
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = label.uppercase(),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 3.sp,
                                modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
                            )
                            OutlinedTextField(
                                value = value,
                                onValueChange = setter,
                                visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(),
                                shape = RoundedCornerShape(16.dp),
                                enabled = !isSubmitting,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = theme.colors.backgroundSecondary,
                                    unfocusedContainerColor = theme.colors.backgroundSecondary,
                                    focusedBorderColor = Color.Transparent,
                                    unfocusedBorderColor = Color.Transparent
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            if (currentPassword.isEmpty() || newPassword.isEmpty() || confirmPassword.isEmpty()) return@Button
                            if (newPassword != confirmPassword) {
                                onAlert?.invoke("No match", "error", null)
                                return@Button
                            }
                            if (newPassword.length < 6) {
                                onAlert?.invoke("Min 6 chars", "error", null)
                                return@Button
                            }
                            isSubmitting = true
                            scope.launch {
                                try {
                                    val loginResult = AuthService.signIn(userEmail, currentPassword)
                                    if (loginResult.isFailure) {
                                        onAlert?.invoke("Wrong password", "error", null)
                                        isSubmitting = false
                                        return@launch
                                    }
                                    
                                    val updateResult = AuthService.updatePassword(newPassword)
                                    if (updateResult.isSuccess) {
                                        onAlert?.invoke("Password Updated!", "success", null)
                                        onClose()
                                    } else {
                                        onAlert?.invoke(updateResult.exceptionOrNull()?.message ?: "Update failed", "error", null)
                                    }
                                } catch (e: Exception) {
                                    onAlert?.invoke(e.message ?: "Update failed", "error", null)
                                } finally {
                                    isSubmitting = false
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                        } else {
                            Text(
                                text = "UPDATE SECURITY",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.White,
                                letterSpacing = 3.sp
                            )
                        }
                    }
                }
            }
        }
    }
}




