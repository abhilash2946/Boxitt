package com.boxitt.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.AuthService
import com.boxitt.app.services.Storage
import kotlinx.coroutines.launch

@Composable
fun AdminSecurityPrompt(
    email: String,
    onSuccess: (String?) -> Unit,
    onLogout: () -> Unit,
    onAlert: (String, String) -> Unit
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()

    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }

    fun handleSubmit() {
        if (username.isBlank() || password.isBlank()) {
            onAlert("Please enter both username and password.", "error")
            return
        }

        loading = true
        scope.launch {
            try {
                val result = AuthService.verifyAdminCredentials(email, username, password)
                if (result.success) {
                    Storage.setAdminAuth(role = "admin", email = email, locationId = result.locationId)
                    onSuccess(result.locationId)
                } else {
                    onAlert("Invalid admin credentials. Please check your username and password.", "error")
                }
            } catch (e: Exception) {
                onAlert("An error occurred during verification.", "error")
            } finally {
                loading = false
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .clip(RoundedCornerShape(32.dp)),
            colors = CardDefaults.cardColors(containerColor = theme.colors.card),
            border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
        ) {
            Box(modifier = Modifier.padding(24.dp)) {
                // Back Button
                IconButton(
                    onClick = onLogout,
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .size(40.dp)
                        .background(theme.colors.backgroundSecondary, RoundedCornerShape(12.dp))
                        .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = theme.colors.textPrimary
                    )
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .background(theme.colors.accent.copy(alpha = 0.1f), RoundedCornerShape(20.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = null,
                            tint = theme.colors.accent,
                            modifier = Modifier.size(36.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "ADMIN LOGIN",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        color = theme.colors.textPrimary
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Box(
                        modifier = Modifier
                            .background(theme.colors.accent.copy(alpha = 0.1f), CircleShape)
                            .border(1.dp, theme.colors.accent.copy(alpha = 0.3f), CircleShape)
                            .padding(horizontal = 12.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "SECURITY VERIFICATION",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.5.sp,
                            color = theme.colors.accent
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Form
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Email Field (Read-only)
                        Column {
                            Text(
                                text = "ADMIN EMAIL",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp,
                                color = theme.colors.textDisabled
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            OutlinedTextField(
                                value = email,
                                onValueChange = {},
                                readOnly = true,
                                leadingIcon = { Icon(Icons.Default.Email, null, tint = theme.colors.textDisabled) },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    disabledContainerColor = theme.colors.backgroundSecondary,
                                    disabledTextColor = theme.colors.textPrimary.copy(alpha = 0.6f)
                                ),
                                enabled = false
                            )
                        }

                        // Username Field
                        Column {
                            Text(
                                text = "USERNAME",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp,
                                color = theme.colors.textDisabled
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            OutlinedTextField(
                                value = username,
                                onValueChange = { username = it },
                                placeholder = { Text("Enter Username") },
                                leadingIcon = { Icon(Icons.Default.Person, null, tint = theme.colors.accent) },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = theme.colors.backgroundSecondary,
                                    unfocusedContainerColor = theme.colors.backgroundSecondary
                                )
                            )
                        }

                        // Password Field
                        Column {
                            Text(
                                text = "PASSWORD",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp,
                                color = theme.colors.textDisabled
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            OutlinedTextField(
                                value = password,
                                onValueChange = { password = it },
                                placeholder = { Text("••••••••") },
                                leadingIcon = { Icon(Icons.Default.Lock, null, tint = theme.colors.accent) },
                                visualTransformation = PasswordVisualTransformation(),
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = theme.colors.backgroundSecondary,
                                    unfocusedContainerColor = theme.colors.backgroundSecondary
                                )
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        LoadingButton(
                            onClick = { handleSubmit() },
                            loading = loading,
                            text = "LOGIN",
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "AUTHORIZED ACCESS ONLY. ALL ACTIVITIES ARE MONITORED.",
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp,
                        textAlign = TextAlign.Center,
                        color = theme.colors.textDisabled
                    )
                }
            }
        }
    }
}
