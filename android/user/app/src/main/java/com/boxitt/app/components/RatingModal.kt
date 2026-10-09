package com.boxitt.app.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.blur
import androidx.compose.ui.platform.LocalDensity
import com.boxitt.app.services.handleError
import com.boxitt.app.User
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.filled.Star

@Composable
fun RatingModal(
    matchId: String,
    locationId: String,
    user: User,
    onClose: () -> Unit,
    scope: CoroutineScope = rememberCoroutineScope()
) {
    val theme = LocalAppTheme.current
    val density = LocalDensity.current
    var rating by remember { mutableStateOf(0) }
    var hoverRating by remember { mutableStateOf(0) }
    var isSubmitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var hasRated by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }

    val backdropBg = if (theme.name == com.boxitt.app.theme.ThemeName.LIGHT) Color(0xFF0F172A).copy(alpha = 0.4f) else Color.Black.copy(alpha = 0.8f)

    var isVisible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { isVisible = true }

    LaunchedEffect(matchId, user.email) {
        try {
            val response = Supabase.client.postgrest["ratings"].select {
                filter {
                    eq("match_id", matchId)
                    eq("user_id", user.email)
                }
            }
            if (response.decodeList<RatingDbRow>().isNotEmpty()) {
                hasRated = true
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            loading = false
        }
    }

    Dialog(
        onDismissRequest = onClose,
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(backdropBg)
                .blur(16.dp)
                .clickable(
                    interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                    indication = null
                ) { onClose() },
            contentAlignment = Alignment.Center
        ) {
            AnimatedVisibility(
                visible = isVisible,
                enter = fadeIn(tween(300)) + scaleIn(tween(300), initialScale = 0.9f) + slideInVertically(tween(300)) { with(density) { 20.dp.roundToPx() } },
                exit = fadeOut(tween(300)) + scaleOut(tween(300), targetScale = 0.9f) + slideOutVertically(tween(300)) { with(density) { 20.dp.roundToPx() } }
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.9f)
                        .widthIn(max = 400.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(theme.colors.card)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
                        .clickable(
                            interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                            indication = null
                        ) { /* catch click */ }
                        .padding(32.dp)
                ) {
                    if (loading) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            CircularProgressIndicator(color = theme.colors.accent, strokeWidth = 4.dp, modifier = Modifier.size(64.dp))
                            Spacer(modifier = Modifier.height(24.dp))
                            Text("LOADING...", color = theme.colors.textPrimary, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, fontSize = 20.sp)
                        }
                    } else if (hasRated) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(64.dp)
                                    .shadow(theme.elevation.elevated, RoundedCornerShape(theme.radius.medium))
                                    .clip(RoundedCornerShape(theme.radius.medium))
                                    .background(theme.colors.success),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(32.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(24.dp))
                            Text(
                                text = "THANK YOU!",
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black,
                                fontStyle = FontStyle.Italic,
                                color = theme.colors.textPrimary
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Rating already recorded.",
                                fontSize = 14.sp,
                                color = theme.colors.textDisabled
                            )
                            Spacer(modifier = Modifier.height(32.dp))
                            Button(
                                onClick = { /* handled by pressScale */ },
                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary),
                                shape = RoundedCornerShape(theme.radius.medium),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(56.dp)
                                    .shadow(theme.elevation.elevated, RoundedCornerShape(theme.radius.medium))
                                    .pressScale { onClose() }
                            ) {
                                Text("CLOSE", color = theme.colors.background, fontWeight = FontWeight.Black, letterSpacing = 3.sp)
                            }
                        }
                    } else {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(64.dp)
                                    .shadow(theme.elevation.elevated, RoundedCornerShape(theme.radius.medium))
                                    .clip(RoundedCornerShape(theme.radius.medium))
                                    .background(Color(0xFFF59E0B)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.Star,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(32.dp).graphicsLayer {
                                        // Simulate fill-current if needed, but Star is already filled in Material Icons
                                    }
                                )
                            }
                            Spacer(modifier = Modifier.height(24.dp))
                            Text(
                                text = "RATE MATCH",
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black,
                                fontStyle = FontStyle.Italic,
                                color = theme.colors.textPrimary
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "How was your experience?",
                                fontSize = 14.sp,
                                color = theme.colors.textDisabled
                            )
                            Spacer(modifier = Modifier.height(32.dp))

                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                for (star in 1..5) {
                                    val isHighlighted = (if (hoverRating > 0) hoverRating else rating) >= star
                                    var isPressed by remember { mutableStateOf(false) }
                                    val scale by animateFloatAsState(
                                        targetValue = when {
                                            isPressed -> 0.9f
                                            isHighlighted -> 1.1f
                                            else -> 1.0f
                                        },
                                        animationSpec = tween(durationMillis = 100),
                                        label = "StarScale"
                                    )
                                    Icon(
                                        imageVector = if (isHighlighted) Icons.Filled.Star else Icons.Outlined.Star,
                                        contentDescription = null,
                                        tint = if (isHighlighted) Color(0xFFF59E0B) else theme.colors.textDisabled.copy(alpha = 0.2f),
                                        modifier = Modifier
                                            .size(40.dp)
                                            .graphicsLayer {
                                                scaleX = scale
                                                scaleY = scale
                                            }
                                            .pointerInput(Unit) {
                                                awaitPointerEventScope {
                                                    while (true) {
                                                        val event = awaitPointerEvent()
                                                        when (event.type) {
                                                            PointerEventType.Enter -> hoverRating = star
                                                            PointerEventType.Exit -> hoverRating = 0
                                                        }
                                                    }
                                                }
                                            }
                                            .pointerInput(Unit) {
                                                detectTapGestures(
                                                    onPress = {
                                                        isPressed = true
                                                        try { awaitRelease() } finally { isPressed = false }
                                                    },
                                                    onTap = { rating = star }
                                                )
                                            }
                                    )
                                }
                            }

                            if (error.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(error, color = theme.colors.error, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }

                            Spacer(modifier = Modifier.height(32.dp))

                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Button(
                                    onClick = { /* handled by pressScale */ },
                                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                                    shape = RoundedCornerShape(theme.radius.medium),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(56.dp)
                                        .shadow(theme.elevation.elevated, RoundedCornerShape(theme.radius.medium))
                                        .pressScale(enabled = !isSubmitting && rating > 0) {
                                            if (rating == 0) {
                                                error = "Select a rating"
                                                return@pressScale
                                            }
                                            isSubmitting = true
                                            scope.launch {
                                                try {
                                                    Supabase.client.postgrest["ratings"].insert(
                                                        RatingInsertRow(
                                                            location_id = locationId,
                                                            match_id = matchId,
                                                            user_id = user.email,
                                                            rating = rating,
                                                            created_at = java.time.Instant.now().toString()
                                                        )
                                                    )
                                                    onClose()
                                                } catch (e: Exception) {
                                                    error = handleError(e).message
                                                    isSubmitting = false
                                                }
                                            }
                                        },
                                    enabled = !isSubmitting && rating > 0
                                ) {
                                    Text(
                                        text = if (isSubmitting) "SUBMITTING..." else "SUBMIT",
                                        color = Color.White,
                                        fontWeight = FontWeight.Black,
                                        letterSpacing = 2.sp
                                    )
                                }
                                Text(
                                    text = "SKIP",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.colors.textDisabled,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { onClose() }
                                        .padding(vertical = 8.dp),
                                    textAlign = TextAlign.Center,
                                    letterSpacing = 3.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

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
                    try { awaitRelease() } finally { isPressed = false }
                },
                onTap = { onClick() }
            )
        }
}

@Serializable
private data class RatingDbRow(
    val id: String? = null
)

@Serializable
private data class RatingInsertRow(
    val location_id: String,
    val match_id: String,
    val user_id: String,
    val rating: Int,
    val created_at: String
)
