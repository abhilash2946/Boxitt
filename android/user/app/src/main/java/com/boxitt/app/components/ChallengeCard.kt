package com.boxitt.app.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.contexts.LocalAppTheme

@Composable
fun ChallengeCard(
    isEnabled: Boolean,
    onToggle: (Boolean) -> Unit,
    disabled: Boolean = false,
    content: @Composable (ColumnScope.() -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val infiniteTransition = rememberInfiniteTransition()

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(theme.radius.large))
            .background(if (isEnabled) theme.colors.accent.copy(alpha = 0.15f) else theme.colors.card)
            .border(2.dp, if (isEnabled) theme.colors.accent else theme.colors.border, RoundedCornerShape(theme.radius.large))
            .clickable(enabled = !disabled) { onToggle(!isEnabled) }
            .padding(16.dp)
    ) {
        // Decorative background element
        if (isEnabled) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 16.dp, y = (-16).dp)
                    .size(100.dp)
                    .background(theme.colors.accent.copy(alpha = 0.1f), CircleShape)
            )
        }
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (isEnabled) theme.colors.accent else Color.White.copy(alpha = 0.05f)),
                    contentAlignment = Alignment.Center
                ) {
                    // Using FlashOn as a substitute for Swords/Challenge icon
                    Icon(
                        imageVector = Icons.Default.FlashOn,
                        contentDescription = null,
                        tint = if (isEnabled) Color.White else theme.colors.textDisabled,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "CHALLENGE",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isEnabled) theme.colors.textPrimary else theme.colors.textDisabled,
                        letterSpacing = 2.sp,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                    )
                    Text(
                        text = if (isEnabled) "Searching nearby • 5KM Radius" else "Private mode • Hidden",
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isEnabled) theme.colors.accent else theme.colors.textDisabled,
                        modifier = Modifier.padding(top = 2.dp),
                        letterSpacing = 1.sp
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Toggle Switch Simulation
                Box(
                    modifier = Modifier
                        .size(width = 56.dp, height = 28.dp)
                        .clip(CircleShape)
                        .background(if (isEnabled) theme.colors.accent.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.05f))
                        .border(1.5.dp, if (isEnabled) theme.colors.accent else theme.colors.border, CircleShape)
                        .padding(horizontal = 3.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    val thumbOffset by animateDpAsState(targetValue = if (isEnabled) 28.dp else 0.dp)
                    Box(
                        modifier = Modifier
                            .offset(x = thumbOffset)
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(if (isEnabled) Color.White else theme.colors.textDisabled),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isEnabled) {
                            val pulseScale by infiniteTransition.animateFloat(
                                initialValue = 1f,
                                targetValue = 1.5f,
                                animationSpec = infiniteRepeatable(
                                    animation = tween(1000),
                                    repeatMode = RepeatMode.Restart
                                )
                            )
                            val pulseAlpha by infiniteTransition.animateFloat(
                                initialValue = 0.6f,
                                targetValue = 0f,
                                animationSpec = infiniteRepeatable(
                                    animation = tween(1000),
                                    repeatMode = RepeatMode.Restart
                                )
                            )
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(theme.colors.accent.copy(alpha = pulseAlpha))
                                    .size((6 * pulseScale).dp)
                            )
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(theme.colors.accent)
                            )
                        }
                    }
                }
            }

            AnimatedVisibility(
                visible = isEnabled,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 24.dp)
                ) {
                    Divider(color = theme.colors.border.copy(alpha = 0.4f))
                    Spacer(modifier = Modifier.height(24.dp))
                    Row(
                        modifier = Modifier.padding(bottom = if (content != null) 24.dp else 0.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy((-12).dp)) {
                            for (i in 0..2) {
                                val dotScale by infiniteTransition.animateFloat(
                                    initialValue = 1f,
                                    targetValue = 1.2f,
                                    animationSpec = infiniteRepeatable(
                                        animation = tween(1000, delayMillis = i * 300),
                                        repeatMode = RepeatMode.Reverse
                                    )
                                )
                                Box(
                                    modifier = Modifier
                                        .size(24.dp)
                                        .graphicsLayer {
                                            scaleX = dotScale
                                            scaleY = dotScale
                                        }
                                        .border(2.dp, theme.colors.card, CircleShape)
                                        .clip(CircleShape)
                                        .background(Color.White)
                                        .padding(6.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .clip(CircleShape)
                                            .background(theme.colors.accent)
                                    )
                                }
                            }
                        }

                        val rowAlpha by infiniteTransition.animateFloat(
                            initialValue = 0.4f,
                            targetValue = 1f,
                            animationSpec = infiniteRepeatable(
                                animation = tween(1000),
                                repeatMode = RepeatMode.Reverse
                            )
                        )

                        Row(
                            verticalAlignment = Alignment.CenterVertically, 
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.alpha(rowAlpha)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = null,
                                tint = theme.colors.accent,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = "Searching for players...",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.accent,
                                letterSpacing = 1.sp
                            )
                        }
                    }
                    
                    if (content != null) {
                        Column(modifier = Modifier.clickable(enabled = false) { /* Prevent parent click */ }) {
                            content()
                        }
                    }
                }
            }
        }
    }
}
