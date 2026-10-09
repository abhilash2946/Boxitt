package com.boxitt.app.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.zIndex
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.contexts.ThemeManager
import com.boxitt.app.theme.ThemeName

@Composable
private fun Modifier.pressScale(
    enabled: Boolean = true,
    scale: Float = 0.9f,
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

@Composable
fun ThemeSelector() {
    val theme = LocalAppTheme.current
    var isOpen by remember { mutableStateOf(false) }

    val themeOptions = listOf(
        ThemeOption(ThemeName.DARK, "Dark Mode", Icons.Default.Brightness2, Color(0xFF3B82F6)),
        ThemeOption(ThemeName.BOXITT, "Boxitt Mode", Icons.Default.Inventory2, Color(0xFF10B981)),
        ThemeOption(ThemeName.LIGHT, "Light Mode", Icons.Default.WbSunny, Color(0xFF2563EB))
    )

    Box(modifier = Modifier.wrapContentSize()) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .shadow(theme.elevation.card, RoundedCornerShape(12.dp))
                .clip(RoundedCornerShape(12.dp))
                .background(theme.colors.card)
                .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                .pressScale(scale = 0.9f) { isOpen = !isOpen },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Palette,
                contentDescription = "Theme Selector",
                tint = theme.colors.textPrimary,
                modifier = Modifier.size(24.dp)
            )
        }

        if (isOpen) {
            // Screen-wide scrim to dismiss
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        detectTapGestures(onTap = { isOpen = false })
                    }
                    .zIndex(99f)
            )
        }

        AnimatedVisibility(
            visible = isOpen,
            enter = fadeIn() + expandVertically(expandFrom = Alignment.Top) + scaleIn(initialScale = 0.9f, transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, 0f)),
            exit = fadeOut() + shrinkVertically(shrinkTowards = Alignment.Top) + scaleOut(targetScale = 0.9f, transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, 0f)),
            modifier = Modifier.align(Alignment.TopEnd).padding(top = 52.dp).offset(x = (-20).dp, y = 10.dp).zIndex(100f)
        ) {
            Box(
                modifier = Modifier
                    .width(220.dp)
                    .shadow(theme.elevation.modal, RoundedCornerShape(32.dp))
                    .clip(RoundedCornerShape(32.dp))
                    .background(theme.colors.background)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(32.dp))
                    .padding(12.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    themeOptions.forEach { option ->
                        val isSelected = theme.name == option.id
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .shadow(4.dp, RoundedCornerShape(20.dp))
                                .clip(RoundedCornerShape(20.dp))
                                .background(if (isSelected) theme.colors.backgroundSecondary else Color.Transparent)
                                .pressScale(scale = 0.95f) {
                                    ThemeManager.setTheme(option.id)
                                    isOpen = false
                                }
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(option.color.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = option.icon,
                                        contentDescription = option.label,
                                        tint = option.color,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                                Text(
                                    text = option.label,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isSelected) theme.colors.textPrimary else theme.colors.textDisabled,
                                    letterSpacing = 1.sp
                                )
                            }
                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = "Selected",
                                    tint = theme.colors.success,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private data class ThemeOption(
    val id: ThemeName,
    val label: String,
    val icon: ImageVector,
    val color: Color
)
