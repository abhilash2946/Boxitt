package com.boxitt.app.pages

import androidx.compose.animation.*
import com.boxitt.app.components.LoadingButton
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.AuthService
import com.boxitt.app.services.handleError
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ResetPasswordPage(
    onComplete: () -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()

    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var success by remember { mutableStateOf(false) }

    fun triggerAlert(msg: String, type: String = "info") {
        onAlert?.invoke(msg, type, null)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background),
        contentAlignment = Alignment.Center
    ) {
        // Background Decor
        Box(
            modifier = Modifier
                .offset(x = (-100).dp, y = (-200).dp)
                .size(400.dp)
                .blur(120.dp)
                .clip(CircleShape)
                .background(theme.colors.accent.copy(alpha = 0.2f))
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = 100.dp, y = 100.dp)
                .size(300.dp)
                .blur(100.dp)
                .clip(CircleShape)
                .background(theme.colors.success.copy(alpha = 0.2f))
        )

        AnimatedContent(
            targetState = success,
            transitionSpec = {
                (fadeIn() + scaleIn(initialScale = 0.8f))
                    .togetherWith(fadeOut() + scaleOut(targetScale = 0.8f))
            },
            label = "success_transition"
        ) { isSuccess ->
            if (isSuccess) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth(0.9f)
                        .clip(RoundedCornerShape(theme.radius.large))
                        .background(theme.colors.card.copy(alpha = 0.9f))
                        .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
                        .padding(horizontal = 24.dp, vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(100.dp)
                            .rotate(12f)
                            .clip(RoundedCornerShape(24.dp))
                            .background(theme.colors.success),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(48.dp)
                        )
                    }

                    Text(
                        text = "PASSWORD UPDATED",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        color = theme.colors.textPrimary,
                        textAlign = TextAlign.Center,
                        lineHeight = 32.sp
                    )

                    Text(
                        text = "REDIRECTING...",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textDisabled,
                        letterSpacing = 4.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxWidth(0.9f)
                        .clip(RoundedCornerShape(theme.radius.large))
                        .background(theme.colors.card.copy(alpha = 0.9f))
                        .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .rotate(3f)
                                .clip(RoundedCornerShape(20.dp))
                                .background(theme.colors.accent),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(40.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        Text(
                            text = buildAnnotatedString {
                                append("RESET ")
                                withStyle(SpanStyle(color = theme.colors.accent)) {
                                    append("PASSWORD")
                                }
                            },
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black,
                            fontStyle = FontStyle.Italic,
                            color = theme.colors.textPrimary,
                            textAlign = TextAlign.Center,
                            lineHeight = 36.sp
                        )

                        Text(
                            text = "UPDATE YOUR SECURITY",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textDisabled,
                            letterSpacing = 3.sp,
                            modifier = Modifier
                                .padding(top = 12.dp)
                                .border(
                                    1.dp,
                                    theme.colors.border.copy(alpha = 0.4f),
                                    CircleShape
                                )
                                .background(
                                    theme.colors.backgroundSecondary.copy(alpha = 0.4f),
                                    CircleShape
                                )
                                .padding(horizontal = 16.dp, vertical = 6.dp)
                        )
                    }

                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                "NEW PASSWORD",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 2.sp,
                                modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
                            )
                            OutlinedTextField(
                                value = password,
                                onValueChange = { password = it },
                                placeholder = { Text("••••••••", color = theme.colors.textDisabled.copy(alpha = 0.5f)) },
                                visualTransformation = PasswordVisualTransformation(),
                                shape = RoundedCornerShape(16.dp),
                                colors = TextFieldDefaults.outlinedTextFieldColors(
                                    containerColor = theme.colors.backgroundSecondary.copy(alpha = 0.2f),
                                    focusedBorderColor = Color.Transparent,
                                    unfocusedBorderColor = Color.Transparent,
                                    focusedTextColor = theme.colors.textPrimary,
                                    unfocusedTextColor = theme.colors.textPrimary
                                ),
                                textStyle = LocalTextStyle.current.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                ),
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !loading
                            )
                        }

                        Column(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                "CONFIRM PASSWORD",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 2.sp,
                                modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
                            )
                            OutlinedTextField(
                                value = confirmPassword,
                                onValueChange = { confirmPassword = it },
                                placeholder = { Text("••••••••", color = theme.colors.textDisabled.copy(alpha = 0.5f)) },
                                visualTransformation = PasswordVisualTransformation(),
                                shape = RoundedCornerShape(16.dp),
                                colors = TextFieldDefaults.outlinedTextFieldColors(
                                    containerColor = theme.colors.backgroundSecondary.copy(alpha = 0.2f),
                                    focusedBorderColor = Color.Transparent,
                                    unfocusedBorderColor = Color.Transparent,
                                    focusedTextColor = theme.colors.textPrimary,
                                    unfocusedTextColor = theme.colors.textPrimary
                                ),
                                textStyle = LocalTextStyle.current.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                ),
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !loading
                            )
                        }
                    }

                    LoadingButton(
                        onClick = {
                            if (password != confirmPassword) {
                                triggerAlert("Passwords do not match", "error")
                                return@LoadingButton
                            }
                            if (password.length < 6) {
                                triggerAlert("Password must be at least 6 characters", "error")
                                return@LoadingButton
                            }
                            loading = true
                            scope.launch {
                                try {
                                    val res = AuthService.updatePassword(password)
                                    if (res.isSuccess) {
                                        success = true
                                        triggerAlert("Password Updated Successfully!", "success")
                                        delay(2000)
                                        onComplete()
                                    } else {
                                        val error = res.exceptionOrNull()
                                        triggerAlert(if (error != null) handleError(error).message else "Update failed", "error")
                                    }
                                } catch (err: Exception) {
                                    triggerAlert(handleError(err).message, "error")
                                } finally {
                                    loading = false
                                }
                            }
                        },
                        loading = loading,
                        text = "UPDATE PASSWORD",
                        loadingText = "Updating...",
                        backgroundColor = theme.colors.accent,
                        icon = { Icon(Icons.Default.Security, null, tint = Color.White, modifier = Modifier.size(20.dp)) }
                    )
                }
            }
        }
    }
}



