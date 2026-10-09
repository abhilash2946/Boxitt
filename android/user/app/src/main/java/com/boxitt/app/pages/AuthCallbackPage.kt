package com.boxitt.app.pages

import android.util.Log
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.boxitt.app.contexts.LocalAppTheme

@Composable
fun AuthCallbackPage(
    onNavigate: (String) -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()

    var statusText by remember { mutableStateOf("Setting up Account") }
    var detailedError by remember { mutableStateOf<String?>(null) }

    val infiniteTransition = rememberInfiniteTransition()
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        )
    )

    LaunchedEffect(Unit) {
        Log.d("AuthCallback", "AuthCallbackPage: Started")
        val activity = context as? android.app.Activity
        val data = activity?.intent?.data
        
        if (data != null && data.scheme == "com.boxitt.app" && data.host == "auth-callback") {
            val fragment = data.fragment
            if (fragment != null) {
                val params = fragment.split("&").associate {
                    val pair = it.split("=")
                    pair[0] to (pair.getOrNull(1) ?: "")
                }
                val accessToken = params["access_token"]
                val refreshToken = params["refresh_token"]

                if (accessToken != null && refreshToken != null) {
                    statusText = "Establishing session..."
                    viewModel.handleSession(accessToken, refreshToken)
                    return@LaunchedEffect
                }
            }
        }
        
        detailedError = "No active session found after redirect. Please try again."
    }

    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            if (uiState.isProfileComplete) {
                onNavigate("booking")
            } else {
                onNavigate("edit-profile")
            }
        }
    }

    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            detailedError = it
            onAlert?.invoke(it, "error", null)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            if (detailedError != null) {
                Icon(
                    imageVector = Icons.Default.Error,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(64.dp)
                )
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    text = "AUTHENTICATION FAILED",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.error
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = detailedError!!,
                    fontSize = 12.sp,
                    color = theme.colors.textDisabled,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    lineHeight = 18.sp
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(128.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .rotate(angle)
                            .border(4.dp, Color.White.copy(alpha = 0.05f), RoundedCornerShape(64.dp))
                            .border(4.dp, theme.colors.accent, RoundedCornerShape(64.dp))
                    )

                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = theme.colors.accent,
                        modifier = Modifier
                            .size(48.dp)
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                Text(
                    text = "SECURING SESSION",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textPrimary
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = statusText.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textDisabled,
                    letterSpacing = 2.sp
                )

                Spacer(modifier = Modifier.height(48.dp))

                Box(
                    modifier = Modifier
                        .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(16.dp))
                        .border(1.dp, theme.colors.border.copy(alpha = 0.2f), RoundedCornerShape(16.dp))
                        .padding(horizontal = 24.dp, vertical = 12.dp)
                ) {
                    Text(
                        text = "SECURE CONNECTION ESTABLISHED",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textDisabled,
                        letterSpacing = 1.sp
                    )
                }
            }
        }
    }
}
