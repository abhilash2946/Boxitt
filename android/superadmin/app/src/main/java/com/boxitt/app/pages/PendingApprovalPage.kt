package com.boxitt.app.pages

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.GppMaybe
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.boxitt.app.components.ThemeSelector
import com.boxitt.app.contexts.LocalAppTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
private fun Modifier.pressScale(
    enabled: Boolean = true,
    scale: Float = 0.95f,
    onClick: () -> Unit
): Modifier {
    var isPressed by remember { mutableStateOf(false) }
    val animatedScale by animateFloatAsState(
        targetValue = if (isPressed) scale else 1f,
        animationSpec = tween(durationMillis = 100),
        label = "PressScale"
    )
    return this
        .graphicsLayer {
            scaleX = animatedScale
            scaleY = animatedScale
        }
        .pointerInput(enabled) {
            if (!enabled) return@pointerInput
            detectTapGestures(
                onPress = {
                    isPressed = true
                    try {
                        awaitRelease()
                    } finally {
                        isPressed = false
                    }
                },
                onTap = { onClick() }
            )
        }
}

@Composable
fun PendingApprovalPage(
    onNavigate: (String) -> Unit
) {
    val theme = LocalAppTheme.current
    val density = LocalDensity.current

    // Entrance Animations
    val scale = remember { Animatable(0.9f) }
    val opacity = remember { Animatable(0f) }
    val rotationX = remember { Animatable(20f) }

    // 3D Flip Animation for Icon
    val iconRotationY = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        launch {
            scale.animateTo(1f, animationSpec = tween(800, easing = EaseOut))
        }
        launch {
            opacity.animateTo(1f, animationSpec = tween(800))
        }
        launch {
            rotationX.animateTo(0f, animationSpec = tween(800, easing = EaseOut))
        }
        // Periodic 3D Flip every 5 seconds
        while(true) {
            delay(5000)
            iconRotationY.animateTo(180f, animationSpec = tween(800, easing = LinearOutSlowInEasing))
            delay(2000)
            iconRotationY.animateTo(0f, animationSpec = tween(800, easing = LinearOutSlowInEasing))
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        // Background Decor
        Box(
            modifier = Modifier
                .offset(x = (-100).dp, y = (-100).dp)
                .size(400.dp)
                .blur(120.dp)
                .background(theme.colors.accent.copy(alpha = 0.2f), CircleShape)
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = 100.dp, y = 100.dp)
                .size(300.dp)
                .blur(100.dp)
                .background(theme.colors.success.copy(alpha = 0.2f), CircleShape)
        )

        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 32.dp, end = 32.dp)
                .zIndex(50f)
        ) {
            ThemeSelector()
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .graphicsLayer {
                    this.scaleX = scale.value
                    this.scaleY = scale.value
                    this.alpha = opacity.value
                    this.rotationX = rotationX.value
                    this.cameraDistance = 12f * density.density
                },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 448.dp)
                    .clip(RoundedCornerShape(theme.radius.large))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
                    .padding(horizontal = 48.dp, vertical = 48.dp),
                contentAlignment = Alignment.Center
            ) {
                // Card Inner Decor
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .size(128.dp)
                        .offset(x = 32.dp, y = (-32).dp)
                        .blur(48.dp)
                        .background(theme.colors.accent.copy(alpha = 0.05f), CircleShape)
                )

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(96.dp)
                            .graphicsLayer {
                                rotationY = iconRotationY.value
                                cameraDistance = 12f * density.density
                            }
                            .rotate(3f)
                            .clip(RoundedCornerShape(32.dp))
                            .background(theme.colors.accent),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.GppMaybe,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(48.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(40.dp))

                    Text(
                        text = buildAnnotatedString {
                            append("ACCOUNT ")
                            withStyle(SpanStyle(color = theme.colors.accent)) {
                                append("PENDING")
                            }
                        },
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        color = theme.colors.textPrimary,
                        letterSpacing = (-2).sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 44.sp
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(40.dp))
                            .background(theme.colors.backgroundSecondary.copy(alpha = 0.4f))
                            .border(1.dp, theme.colors.border.copy(alpha = 0.2f), RoundedCornerShape(40.dp))
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                            modifier = Modifier.padding(bottom = 16.dp)
                        ) {
                            val infiniteTransition = rememberInfiniteTransition(label = "Pulse")
                            val pulseAlpha by infiniteTransition.animateFloat(
                                initialValue = 0.4f,
                                targetValue = 1f,
                                animationSpec = infiniteRepeatable(
                                    animation = tween(1000),
                                    repeatMode = RepeatMode.Reverse
                                ),
                                label = "PulseAlpha"
                            )
                            Icon(
                                imageVector = Icons.Default.Timer,
                                contentDescription = null,
                                tint = theme.colors.accentGlow.copy(alpha = pulseAlpha),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "VERIFICATION IN PROGRESS",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.accentGlow,
                                letterSpacing = 3.sp
                            )
                        }
                        Text(
                            text = "Your account is currently being reviewed by our administrators. You will be granted access once your profile is verified.",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = theme.colors.textSecondary,
                            textAlign = TextAlign.Center,
                            lineHeight = 22.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Text(
                        text = "YOU WILL RECEIVE A NOTIFICATION ONCE YOUR ACCOUNT IS APPROVED.",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textDisabled,
                        textAlign = TextAlign.Center,
                        letterSpacing = 4.sp,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )

                    Spacer(modifier = Modifier.height(32.dp))

                    Button(
                        onClick = { onNavigate("login") },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                        shape = RoundedCornerShape(32.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(64.dp)
                            .pressScale { onNavigate("login") },
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = null,
                            tint = Color(0xFF0F172A),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            "RETURN TO LOGIN",
                            color = Color(0xFF0F172A),
                            fontWeight = FontWeight.Black,
                            fontSize = 11.sp,
                            letterSpacing = 1.sp
                        )
                    }
                }
            }
        }
    }
}



