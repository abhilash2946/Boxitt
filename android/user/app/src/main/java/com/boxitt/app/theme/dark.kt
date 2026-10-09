package com.boxitt.app.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

val darkTheme = AppTheme(
    name = ThemeName.DARK,
    colors = AppThemeColors(
        background = Color(0xFF080C14),
        backgroundSecondary = Color(0xFF101624),
        card = Color(0xFF121A2B),
        cardElevated = Color(0xFF1C263D),
        border = Color(0xFF202B45),
        textPrimary = Color(0xFFF8FAFC),
        textSecondary = Color(0xFF94A3B8),
        textDisabled = Color(0xFF475569),
        accent = Color(0xFF6366F1),
        accentGlow = Color(0xFF818CF8),
        success = Color(0xFF10B981),
        warning = Color(0xFFF59E0B),
        error = Color(0xFFF43F5E),
        buttonGradient = listOf(Color(0xFF4F46E5), Color(0xFF6366F1))
    ),
    elevation = AppThemeElevation(
        card = 2.dp,
        elevated = 4.dp,
        floating = 8.dp,
        modal = 16.dp
    ),
    radius = AppThemeRadius(
        small = 12.dp,
        medium = 16.dp,
        large = 24.dp
    )
)




