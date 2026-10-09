package com.boxitt.app.pages

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.hilt.navigation.compose.hiltViewModel
import com.boxitt.app.components.LoadingButton
import com.boxitt.app.components.ThemeSelector
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.Storage
import com.boxitt.app.services.Supabase
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class LoginPageState(
    val email: String = "",
    val mode: String = "google",
    val isSignUp: Boolean = true
)

@Composable
fun GoogleIcon(modifier: Modifier = Modifier.size(24.dp)) {
    Canvas(modifier = modifier) {
        val width = size.width
        val height = size.height
        val scaleX = width / 24f
        val scaleY = height / 24f

        // Blue path
        val bluePath = Path().apply {
            moveTo(22.56f * scaleX, 12.25f * scaleY)
            cubicTo(22.56f * scaleX, 11.47f * scaleY, 22.49f * scaleX, 10.72f * scaleY, 22.36f * scaleX, 10f * scaleY)
            lineTo(12f * scaleX, 10f * scaleY)
            lineTo(12f * scaleX, 14.26f * scaleY)
            lineTo(17.92f * scaleX, 14.26f * scaleY)
            cubicTo(17.66f * scaleX, 15.63f * scaleY, 16.88f * scaleX, 16.79f * scaleY, 15.71f * scaleX, 17.57f * scaleY)
            lineTo(15.71f * scaleX, 20.34f * scaleY)
            lineTo(19.28f * scaleX, 20.34f * scaleY)
            cubicTo(21.36f * scaleX, 18.42f * scaleY, 22.56f * scaleX, 15.6f * scaleY, 22.56f * scaleX, 12.25f * scaleY)
            close()
        }
        drawPath(bluePath, Color(0xFF4285F4))

        // Green path
        val greenPath = Path().apply {
            moveTo(12f * scaleX, 23f * scaleY)
            cubicTo(14.97f * scaleX, 23f * scaleY, 17.46f * scaleX, 22.02f * scaleY, 19.28f * scaleX, 20.34f * scaleY)
            lineTo(15.71f * scaleX, 17.57f * scaleY)
            cubicTo(14.73f * scaleX, 18.23f * scaleY, 13.48f * scaleX, 18.63f * scaleY, 12f * scaleX, 18.63f * scaleY)
            cubicTo(9.14f * scaleX, 18.63f * scaleY, 6.71f * scaleX, 16.7f * scaleY, 5.84f * scaleX, 14.1f * scaleY)
            lineTo(2.18f * scaleX, 14.1f * scaleY)
            lineTo(2.18f * scaleX, 16.94f * scaleY)
            cubicTo(3.99f * scaleX, 20.53f * scaleY, 7.7f * scaleX, 23f * scaleY, 12f * scaleX, 23f * scaleY)
            close()
        }
        drawPath(greenPath, Color(0xFF34A853))

        // Yellow path
        val yellowPath = Path().apply {
            moveTo(5.84f * scaleX, 14.09f * scaleY)
            cubicTo(5.62f * scaleX, 13.43f * scaleY, 5.49f * scaleX, 12.73f * scaleY, 5.49f * scaleX, 12f * scaleY)
            cubicTo(5.49f * scaleX, 11.27f * scaleY, 5.62f * scaleX, 10.57f * scaleY, 5.84f * scaleX, 9.91f * scaleY)
            lineTo(5.84f * scaleX, 7.07f * scaleY)
            lineTo(2.18f * scaleX, 7.07f * scaleY)
            cubicTo(1.43f * scaleX, 8.55f * scaleY, 1f * scaleX, 10.22f * scaleY, 1f * scaleX, 12f * scaleY)
            cubicTo(1f * scaleX, 13.78f * scaleY, 1.43f * scaleX, 15.45f * scaleY, 2.18f * scaleX, 16.93f * scaleY)
            lineTo(5.03f * scaleX, 14.71f * scaleY)
            lineTo(5.84f * scaleX, 14.09f * scaleY)
            close()
        }
        drawPath(yellowPath, Color(0xFFFBBC05))

        // Red path
        val redPath = Path().apply {
            moveTo(12f * scaleX, 5.38f * scaleY)
            cubicTo(13.62f * scaleX, 5.38f * scaleY, 15.06f * scaleX, 5.94f * scaleY, 16.21f * scaleX, 7.02f * scaleY)
            lineTo(19.36f * scaleX, 3.87f * scaleY)
            cubicTo(17.45f * scaleX, 2.09f * scaleY, 14.97f * scaleX, 1f * scaleY, 12f * scaleX, 1f * scaleY)
            cubicTo(7.7f * scaleX, 1f * scaleY, 3.99f * scaleX, 3.47f * scaleY, 2.18f * scaleX, 7.07f * scaleY)
            lineTo(5.84f * scaleX, 9.91f * scaleY)
            cubicTo(6.71f * scaleX, 7.31f * scaleY, 9.14f * scaleX, 5.38f * scaleY, 12f * scaleX, 5.38f * scaleY)
            close()
        }
        drawPath(redPath, Color(0xFFEA4335))
    }
}

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

    fun triggerAlert(msg: String, type: String = "info") {
        onAlert?.invoke(msg, type, null)
    }

    // State persistence
    LaunchedEffect(email, mode, isSignUp) {
        Storage.setPageState(PAGE_ID, LoginPageState(email, mode, isSignUp))
    }

    // Config Check
    LaunchedEffect(Unit) {
        if (Supabase.BASE_URL.isEmpty() || !Supabase.BASE_URL.startsWith("http")) {
            isSupabaseConfigured = false
            triggerAlert("Database is not configured correctly. Please check your configuration.", "error")
        }
    }

    // Auth state callbacks
    LaunchedEffect(uiState.isSuccess, uiState.requiresVerification, uiState.roleStatus, uiState.isAlreadyRegistered) {
        if (uiState.isAlreadyRegistered) {
            pendingVerificationEmail = ""
            isSignUp = false
            password = ""
            confirmPassword = ""
            triggerAlert("User already exists. Please sign in.", "info")
        } else if (uiState.isSuccess) {
            Storage.clearPageState(PAGE_ID)
            if (isSignUp) {
                if (uiState.requiresVerification) {
                    pendingVerificationEmail = email.trim()
                    triggerAlert("Verification email requested. Check Inbox, Spam, and Promotions. If it does not arrive, use Resend Verification.", "success")
                } else {
                    pendingVerificationEmail = ""
                    triggerAlert("Account created successfully.", "success")
                    onLoginSuccess(email)
                }
            } else if (mode == "forgot") {
                triggerAlert("Password reset link sent!", "success")
            } else {
                if (uiState.roleStatus == "rejected") {
                    triggerAlert("Your account request was rejected. Please contact support.", "error")
                } else {
                    onLoginSuccess(email)
                }
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
                            .size(96.dp)
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
                    Spacer(Modifier.height(24.dp))
                    val annotatedTitle = buildAnnotatedString {
                        append("Join the\n")
                        withStyle(SpanStyle(color = theme.colors.accent)) {
                            append("Arena")
                        }
                    }
                    Text(
                        text = annotatedTitle,
                        fontSize = 72.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        color = theme.colors.textPrimary,
                        lineHeight = 68.sp,
                        letterSpacing = (-2).sp
                    )
                    Spacer(Modifier.height(16.dp))
                    Text(
                        text = "THE NEW ERA OF SPORTS BOOKING",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.colors.textDisabled,
                        letterSpacing = 4.sp
                    )
                    Spacer(Modifier.height(24.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        listOf("Cricket", "Football", "Badminton").forEach { sport ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50.dp))
                                    .background(theme.colors.card)
                                    .border(1.dp, theme.colors.border, RoundedCornerShape(50.dp))
                                    .padding(horizontal = 16.dp, vertical = 8.dp)
                            ) {
                                Text(
                                    text = sport.uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.colors.textSecondary,
                                    letterSpacing = 1.sp
                                )
                            }
                        }
                    }
                }
            }

            // Login Card
            Card(
                modifier = Modifier
                    .widthIn(max = 440.dp)
                    .fillMaxWidth(if (isExpanded) 0.45f else 1f)
                    .verticalScroll(rememberScrollState()),
                shape = RoundedCornerShape(32.dp),
                colors = CardDefaults.cardColors(containerColor = theme.colors.card.copy(alpha = 0.95f)),
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
                            Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = Color.White, modifier = Modifier.size(40.dp))
                        }
                        Spacer(modifier = Modifier.height(24.dp))
                    }

                    Text(
                        text = "BOXITT",
                        fontSize = if (isExpanded) 36.sp else 42.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        color = theme.colors.textPrimary,
                        letterSpacing = (-1).sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = (if (mode == "forgot") "Reset access" else if (isSignUp) "New Era of Sports" else "Welcome Back").uppercase(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.colors.accent,
                        letterSpacing = 3.sp
                    )

                    Spacer(modifier = Modifier.height(32.dp))

                    // Mode Selector Tabs
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(theme.colors.backgroundSecondary.copy(alpha = 0.8f))
                            .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                            .padding(6.dp)
                    ) {
                        Button(
                            onClick = { mode = "email" },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (mode == "email") theme.colors.accent else Color.Transparent
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(vertical = 12.dp)
                        ) {
                            Text(
                                text = "EMAIL",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                fontStyle = if (mode == "email") FontStyle.Italic else FontStyle.Normal,
                                color = if (mode == "email") Color.White else theme.colors.textSecondary,
                                letterSpacing = 1.sp
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
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                fontStyle = if (mode == "google") FontStyle.Italic else FontStyle.Normal,
                                color = if (mode == "google") Color.White else theme.colors.textSecondary,
                                letterSpacing = 1.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Error Display Banner
                    AnimatedVisibility(visible = uiState.error != null) {
                        Surface(
                            color = MaterialTheme.colorScheme.errorContainer,
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)
                        ) {
                            Column(modifier = Modifier.padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.Error, null, tint = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.size(32.dp))
                                Spacer(modifier = Modifier.height(10.dp))
                                Text("AUTHENTICATION FAILED", fontSize = 12.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onErrorContainer, letterSpacing = 1.sp)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(uiState.error ?: "", color = MaterialTheme.colorScheme.onErrorContainer, fontSize = 12.sp, textAlign = TextAlign.Center)
                            }
                        }
                    }

                    if (mode == "email") {
                        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                            Column {
                                Text("EMAIL ADDRESS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = email,
                                    onValueChange = { email = it },
                                    placeholder = { Text("name@domain.com", color = theme.colors.textSecondary.copy(alpha = 0.5f), fontSize = 14.sp) },
                                    leadingIcon = { Icon(Icons.Default.Mail, null, tint = theme.colors.textPrimary.copy(alpha = 0.4f)) },
                                    shape = RoundedCornerShape(16.dp),
                                    colors = TextFieldDefaults.outlinedTextFieldColors(
                                        containerColor = theme.colors.backgroundSecondary,
                                        focusedBorderColor = theme.colors.accent.copy(alpha = 0.3f),
                                        unfocusedBorderColor = Color.Transparent
                                    ),
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }

                            Column {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = if (isSignUp) "CHOOSE PASSWORD" else "PASSWORD",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.colors.textDisabled,
                                        letterSpacing = 1.sp
                                    )
                                    if (!isSignUp) {
                                        Text(
                                            text = "FORGOT?",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Black,
                                            color = theme.colors.accent,
                                            letterSpacing = 1.sp,
                                            modifier = Modifier.clickable { mode = "forgot" }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = password,
                                    onValueChange = { password = it },
                                    placeholder = { Text("••••••••", color = theme.colors.textSecondary.copy(alpha = 0.5f), fontSize = 14.sp) },
                                    leadingIcon = { Icon(Icons.Default.Lock, null, tint = theme.colors.textPrimary.copy(alpha = 0.4f)) },
                                    visualTransformation = PasswordVisualTransformation(),
                                    shape = RoundedCornerShape(16.dp),
                                    colors = TextFieldDefaults.outlinedTextFieldColors(
                                        containerColor = theme.colors.backgroundSecondary,
                                        focusedBorderColor = theme.colors.accent.copy(alpha = 0.3f),
                                        unfocusedBorderColor = Color.Transparent
                                    ),
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }

                            AnimatedVisibility(visible = isSignUp) {
                                Column {
                                    Text("CONFIRM PASSWORD", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    OutlinedTextField(
                                        value = confirmPassword,
                                        onValueChange = { confirmPassword = it },
                                        placeholder = { Text("••••••••", color = theme.colors.textSecondary.copy(alpha = 0.5f), fontSize = 14.sp) },
                                        leadingIcon = { Icon(Icons.Default.Lock, null, tint = theme.colors.textPrimary.copy(alpha = 0.4f)) },
                                        visualTransformation = PasswordVisualTransformation(),
                                        shape = RoundedCornerShape(16.dp),
                                        colors = TextFieldDefaults.outlinedTextFieldColors(
                                            containerColor = theme.colors.backgroundSecondary,
                                            focusedBorderColor = theme.colors.accent.copy(alpha = 0.3f),
                                            unfocusedBorderColor = Color.Transparent
                                        ),
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(4.dp))

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
                                letterSpacing = 1.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        isSignUp = !isSignUp
                                        confirmPassword = ""
                                    }
                                    .padding(vertical = 6.dp)
                            )

                            // Resend Verification section
                            if (isSignUp && pendingVerificationEmail.isNotEmpty()) {
                                Column(
                                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
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
                                                        viewModel.resendVerificationEmail(pendingVerificationEmail)
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
                        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                            Column {
                                Text("EMAIL ADDRESS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = email,
                                    onValueChange = { email = it },
                                    placeholder = { Text("name@domain.com", color = theme.colors.textSecondary.copy(alpha = 0.5f), fontSize = 14.sp) },
                                    leadingIcon = { Icon(Icons.Default.Mail, null, tint = theme.colors.textPrimary.copy(alpha = 0.4f)) },
                                    shape = RoundedCornerShape(16.dp),
                                    colors = TextFieldDefaults.outlinedTextFieldColors(
                                        containerColor = theme.colors.backgroundSecondary,
                                        focusedBorderColor = theme.colors.accent.copy(alpha = 0.3f),
                                        unfocusedBorderColor = Color.Transparent
                                    ),
                                    singleLine = true,
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

                            Text(
                                text = "RETURN TO LOGIN",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 1.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { mode = "email" }
                                    .padding(vertical = 6.dp)
                            )
                        }
                    }

                    if (mode == "google") {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
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
                                icon = { GoogleIcon() }
                            )

                            Text(
                                text = "ONE-TAP ACCESS TO YOUR SPORTS IDENTITY",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.colors.textDisabled,
                                letterSpacing = 1.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
        }
    }
}
