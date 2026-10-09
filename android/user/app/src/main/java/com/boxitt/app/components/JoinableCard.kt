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
import androidx.compose.material.icons.filled.Group
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.contexts.LocalAppTheme

@Composable
fun JoinableCard(
    isJoinable: Boolean,
    onToggle: (Boolean) -> Unit,
    disabled: Boolean = false,
    content: @Composable (() -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val infiniteTransition = rememberInfiniteTransition()

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(theme.radius.large))
            .background(if (isJoinable) theme.colors.accent.copy(alpha = 0.15f) else theme.colors.card)
            .border(2.dp, if (isJoinable) theme.colors.accent else theme.colors.border, RoundedCornerShape(theme.radius.large))
            .clickable(enabled = !disabled) { onToggle(!isJoinable) }
            .padding(16.dp)
    ) {
        // Decorative background element
        if (isJoinable) {
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
                        .background(if (isJoinable) theme.colors.accent else Color.White.copy(alpha = 0.05f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Group,
                        contentDescription = null,
                        tint = if (isJoinable) Color.White else theme.colors.textDisabled,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "FIND PLAYERS",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isJoinable) theme.colors.textPrimary else theme.colors.textDisabled,
                        letterSpacing = 2.sp,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                    )
                    Text(
                        text = if (isJoinable) "Allow others to join" else "Private session",
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isJoinable) theme.colors.accent else theme.colors.textDisabled,
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
                        .background(if (isJoinable) theme.colors.accent.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.05f))
                        .border(1.5.dp, if (isJoinable) theme.colors.accent else theme.colors.border, CircleShape)
                        .padding(horizontal = 3.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    val thumbOffset by animateDpAsState(targetValue = if (isJoinable) 28.dp else 0.dp)
                    Box(
                        modifier = Modifier
                            .offset(x = thumbOffset)
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(if (isJoinable) Color.White else theme.colors.textDisabled),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isJoinable) {
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
                visible = isJoinable && content != null,
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
                    content?.invoke()
                }
            }
        }
    }
}
