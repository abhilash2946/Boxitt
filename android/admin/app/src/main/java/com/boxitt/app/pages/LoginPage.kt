package com.boxitt.app.pages

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.BoxWithConstraints
import com.boxitt.app.components.LoadingButton
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.boxitt.app.components.ThemeSelector
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.Storage
import com.boxitt.app.services.Supabase
import kotlinx.coroutines.delay
import kotlinx.serialization.Serializable

@Serializable
data class LoginPageState(
    val email: String = "",
    val mode: String = "google",
    val isSignUp: Boolean = true
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginPage(
    onLoginSuccess: (String) -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()
    val uiState by viewModel.uiState.collectAsState()

    val PAGE_ID = "login_page"
    val savedState = remember { Storage.getPageState<LoginPageState>(PAGE_ID) ?: LoginPageState() }

    var email by remember { mutableStateOf(savedState.email) }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf(savedState.mode) } // "email" | "google" | "forgot"
    var isSignUp by remember { mutableStateOf(savedState.isSignUp) }
    var isSupabaseConfigured by remember { mutableStateOf(true) }
    var pendingVerificationEmail by remember { mutableStateOf("") }
    var isResendingVerification by remember { mutableStateOf(false) }

    // State persistence
    LaunchedEffect(email, mode, isSignUp) {
        Storage.setPageState(PAGE_ID, LoginPageState(email, mode, isSignUp))
    }

    // Config Check
    LaunchedEffect(Unit) {
        if (Supabase.BASE_URL.isEmpty() || !Supabase.BASE_URL.startsWith("http")) {
            isSupabaseConfigured = false
            onAlert?.invoke("Database is not configured correctly. Please check your configuration.", "error", null)
        }
    }

    fun triggerAlert(msg: String, type: String = "info") {
        onAlert?.invoke(msg, type, null)
    }

    LaunchedEffect(uiState.isSuccess, uiState.roleStatus) {
        if (uiState.isSuccess) {
            if (uiState.roleStatus == "pending") {
                onLoginSuccess("pending")
            } else {
                onLoginSuccess("approved")
            }
        }
    }

    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            triggerAlert(it, "error")
        }
    }

    if (!isSupabaseConfigured) {
        Box(
            modifier = Modifier.fillMaxSize().background(theme.colors.background),
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier.padding(32.dp).fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = theme.colors.card)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Configuration Error", fontSize = 24.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("The app is not configured.", color = theme.colors.textSecondary)
                }
            }
        }
        return
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        val isExpanded = maxWidth > 840.dp
        
        // Animated Background simulation (Pulse blobs)
        Box(modifier = Modifier.fillMaxSize()) {
            val infiniteTransition = rememberInfiniteTransition(label = "Pulse")
            val pulseAlpha by infiniteTransition.animateFloat(
                initialValue = 0.1f,
                targetValue = 0.2f,
                animationSpec = infiniteRepeatable(
                    animation = tween(2000),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "PulseAlpha"
            )

            Box(
                modifier = Modifier
                    .offset(x = (-100).dp, y = (-100).dp)
                    .size(if (isExpanded) 600.dp else 400.dp)
                    .background(theme.colors.accent.copy(alpha = pulseAlpha), RoundedCornerShape(if (isExpanded) 300.dp else 200.dp))
            )
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = 100.dp, y = 100.dp)
                    .size(if (isExpanded) 600.dp else 400.dp)
                    .background(theme.colors.success.copy(alpha = pulseAlpha), RoundedCornerShape(if (isExpanded) 300.dp else 200.dp))
            )
        }

        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp)
                .zIndex(50f)
        ) {
            ThemeSelector()
        }

        Row(
            modifier = Modifier.fillMaxSize().padding(if (isExpanded) 64.dp else 24.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (isExpanded) {
                // Branding Section for Tablet/Laptop
                Column(modifier = Modifier.weight(1f).padding(end = 48.dp)) {
                    Box(
                        modifier = Modifier
                            .size(100.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(theme.colors.buttonGradient[0], theme.colors.buttonGradient[1])
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = Color.White, modifier = Modifier.size(48.dp))
                    }
                    Spacer(Modifier.height(32.dp))
                    Text(
                        "Join the\nArena",
                        fontSize = 72.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        color = theme.colors.textPrimary,
                        lineHeight = 64.sp,
                        letterSpacing = (-2).sp
                    )
                    Spacer(Modifier.height(16.dp))
                    Text(
                        "The New Era of Sports Booking",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.colors.accent,
                        letterSpacing = 4.sp
                    )
                    Spacer(Modifier.height(32.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        listOf("CRICKET", "FOOTBALL", "BADMINTON").forEach { sport ->
                            Box(modifier = Modifier.clip(RoundedCornerShape(50.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(50.dp)).padding(horizontal = 16.dp, vertical = 8.dp)) {
                                Text(sport, fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                            }
                        }
                    }
                }
            }

            // Login Card
            Card(
                modifier = Modifier
                    .widthIn(max = 420.dp)
                    .fillMaxWidth(if (isExpanded) 0.4f else 1f)
                    .verticalScroll(rememberScrollState()),
                shape = RoundedCornerShape(32.dp),
                colors = CardDefaults.cardColors(containerColor = theme.colors.card.copy(alpha = 0.9f)),
                elevation = CardDefaults.cardElevation(defaultElevation = 24.dp),
                border = BorderStroke(1.dp, theme.colors.border)
            ) {
                Column(
                    modifier = Modifier.padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (!isExpanded) {
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(theme.colors.buttonGradient[0], theme.colors.buttonGradient[1])
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = Color.White, modifier = Modifier.size(36.dp))
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                    }

                    Text(
                        text = "Boxitt",
                        fontSize = if (isExpanded) 36.sp else 42.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary,
                        modifier = Modifier.graphicsLayer(rotationZ = -2f)
                    )
                    Text(
                        text = (if (mode == "forgot") "RESET ACCESS" else if (isSignUp) "NEW ERA OF SPORTS" else "WELCOME BACK"),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.colors.accent,
                        letterSpacing = 2.sp
                    )

                    Spacer(modifier = Modifier.height(32.dp))

                    // Mode Selector
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(theme.colors.backgroundSecondary.copy(alpha = 0.4f))
                            .border(1.dp, theme.colors.border.copy(alpha = 0.2f), RoundedCornerShape(16.dp))
                            .padding(6.dp)
                    ) {
                        Button(
                            onClick = { mode = "email" },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (mode == "email" || mode == "forgot") theme.colors.accent else Color.Transparent
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(vertical = 12.dp)
                        ) {
                            Text(
                                text = "EMAIL",
                                fontWeight = FontWeight.Black,
                                fontStyle = if (mode == "email" || mode == "forgot") FontStyle.Italic else FontStyle.Normal,
                                color = if (mode == "email" || mode == "forgot") Color.White else theme.colors.textSecondary
                            )
                        }
                        Button(
                            onClick = { mode = "google" },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (mode == "google") theme.colors.accent else Color.Transparent
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(vertical = 12.dp)
                        ) {
                            Text(
                                text = "GOOGLE",
                                fontWeight = FontWeight.Black,
                                fontStyle = if (mode == "google") FontStyle.Italic else FontStyle.Normal,
                                color = if (mode == "google") Color.White else theme.colors.textSecondary
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Error Display
                    AnimatedVisibility(visible = uiState.error != null) {
                        Surface(
                            color = MaterialTheme.colorScheme.errorContainer,
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)
                        ) {
                            Column(modifier = Modifier.padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.Error, null, tint = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.size(32.dp))
                                Spacer(modifier = Modifier.height(10.dp))
                                Text("AUTHENTICATION FAILED", fontSize = 14.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onErrorContainer)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(uiState.error ?: "", color = MaterialTheme.colorScheme.onErrorContainer, fontSize = 12.sp, textAlign = TextAlign.Center)
                            }
                        }
                    }

                    if (mode == "email") {
                        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Column {
                                Text("EMAIL ADDRESS", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                                Spacer(modifier = Modifier.height(4.dp))
                                OutlinedTextField(
                                    value = email,
                                    onValueChange = { email = it },
                                    placeholder = { Text("name@domain.com", color = Color.Gray.copy(alpha = 0.6f)) },
                                    leadingIcon = { Icon(Icons.Default.Mail, null, tint = theme.colors.textPrimary.copy(alpha = 0.3f)) },
                                    shape = RoundedCornerShape(16.dp),
                                    colors = TextFieldDefaults.outlinedTextFieldColors(
                                        containerColor = theme.colors.backgroundSecondary,
                                        focusedBorderColor = Color.Transparent,
                                        unfocusedBorderColor = Color.Transparent
                                    ),
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }

                            Column {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text(if (isSignUp) "CHOOSE PASSWORD" else "PASSWORD", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                                    if (!isSignUp) {
                                        Text("FORGOT?", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, modifier = Modifier.clickable { mode = "forgot" })
                                    }
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                OutlinedTextField(
                                    value = password,
                                    onValueChange = { password = it },
                                    placeholder = { Text("••••••••", color = Color.Gray.copy(alpha = 0.6f)) },
                                    leadingIcon = { Icon(Icons.Default.Lock, null, tint = theme.colors.textPrimary.copy(alpha = 0.3f)) },
                                    visualTransformation = PasswordVisualTransformation(),
                                    shape = RoundedCornerShape(16.dp),
                                    colors = TextFieldDefaults.outlinedTextFieldColors(
                                        containerColor = theme.colors.backgroundSecondary,
                                        focusedBorderColor = Color.Transparent,
                                        unfocusedBorderColor = Color.Transparent
                                    ),
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }

                            AnimatedVisibility(visible = isSignUp) {
                                Column {
                                    Text("CONFIRM PASSWORD", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    OutlinedTextField(
                                        value = confirmPassword,
                                        onValueChange = { confirmPassword = it },
                                        placeholder = { Text("••••••••", color = Color.Gray.copy(alpha = 0.6f)) },
                                        leadingIcon = { Icon(Icons.Default.Lock, null, tint = theme.colors.textPrimary.copy(alpha = 0.3f)) },
                                        visualTransformation = PasswordVisualTransformation(),
                                        shape = RoundedCornerShape(16.dp),
                                        colors = TextFieldDefaults.outlinedTextFieldColors(
                                            containerColor = theme.colors.backgroundSecondary,
                                            focusedBorderColor = Color.Transparent,
                                            unfocusedBorderColor = Color.Transparent
                                        ),
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            LoadingButton(
                                onClick = {
                                    if (isSignUp && password != confirmPassword) {
                                        triggerAlert("Passwords do not match", "error")
                                        return@LoadingButton
                                    }
                                    if (isSignUp) viewModel.signUp(email, password)
                                    else viewModel.login(email, password)
                                },
                                loading = uiState.isLoading,
                                text = if (isSignUp) "CREATE ACCOUNT" else "ENTER ARENA",
                                loadingText = if (isSignUp) "Verifying..." else "Authenticating...",
                                backgroundColor = theme.colors.accent
                            )

                            Text(
                                text = if (isSignUp) "MEMBER ALREADY? SIGN IN" else "NEW TO BOXITT? JOIN NOW",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                modifier = Modifier.clickable { isSignUp = !isSignUp; confirmPassword = "" }.align(Alignment.CenterHorizontally).padding(vertical = 4.dp)
                            )

                            // Resend Verification (matches web)
                            if (isSignUp && pendingVerificationEmail.isNotEmpty()) {
                                Column(
                                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    Text(
                                        text = "NO EMAIL YET?",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.colors.textDisabled,
                                        letterSpacing = 1.sp
                                    )
                                    LoadingButton(
                                        onClick = {
                                            if (pendingVerificationEmail.isNotEmpty()) {
                                                isResendingVerification = true
                                                scope.launch {
                                                    try {
                                                        viewModel.resendVerification(pendingVerificationEmail)
                                                        triggerAlert("Verification email resent. Check Inbox, Spam, and Promotions folders.", "success")
                                                    } catch (e: Exception) {
                                                        triggerAlert(e.message ?: "Unable to resend verification email right now.", "error")
                                                    } finally {
                                                        isResendingVerification = false
                                                    }
                                                }
                                            }
                                        },
                                        loading = isResendingVerification,
                                        text = "RESEND VERIFICATION",
                                        loadingText = "Resending...",
                                        backgroundColor = Color.Transparent,
                                        contentColor = theme.colors.textPrimary,
                                        borderColor = theme.colors.border.copy(alpha = 0.6f)
                                    )
                                }
                            }
                        }
                    }

                    if (mode == "forgot") {
                        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Column {
                                Text("EMAIL ADDRESS", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                                Spacer(modifier = Modifier.height(4.dp))
                                OutlinedTextField(
                                    value = email,
                                    onValueChange = { email = it },
                                    placeholder = { Text("name@domain.com", color = Color.Gray.copy(alpha = 0.6f)) },
                                    shape = RoundedCornerShape(16.dp),
                                    colors = TextFieldDefaults.outlinedTextFieldColors(
                                        containerColor = theme.colors.backgroundSecondary,
                                        focusedBorderColor = Color.Transparent,
                                        unfocusedBorderColor = Color.Transparent
                                    ),
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }

                            LoadingButton(
                                onClick = { viewModel.forgotPassword(email) },
                                loading = uiState.isLoading,
                                text = "SEND MAGIC LINK",
                                loadingText = "Sending...",
                                backgroundColor = theme.colors.success
                            )

                            Text("RETURN TO LOGIN", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled,
                                modifier = Modifier.clickable { mode = "email" }.align(Alignment.CenterHorizontally).padding(vertical = 4.dp))
                        }
                    }

                    if (mode == "google") {
                        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            LoadingButton(
                                onClick = {
                                    try {
                                        val authUrl = "${Supabase.BASE_URL}/auth/v1/authorize?provider=google&redirect_to=${Uri.encode("com.boxitt.app://auth-callback")}"
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(authUrl))
                                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                        context.startActivity(intent)
                                    } catch (e: Exception) {
                                        triggerAlert("Unable to start Google login.", "error")
                                    }
                                },
                                loading = uiState.isLoading,
                                text = "GOOGLE LOGIN",
                                loadingText = "Connecting...",
                                backgroundColor = theme.colors.card,
                                contentColor = theme.colors.textPrimary,
                                borderColor = theme.colors.border,
                                icon = { Icon(painter = painterResource(id = android.R.drawable.ic_menu_compass), contentDescription = null, tint = Color.Unspecified, modifier = Modifier.size(24.dp)) }
                            )

                            Text("ONE-TAP ACCESS TO YOUR SPORTS IDENTITY", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                        }
                    }
                }
            }
        }
    }
}

// Dummy painter for Google icon since we don't have the SVG resource easily accessible in a single file edit
@Composable
fun painterResource(id: Int) = androidx.compose.ui.res.painterResource(id)
