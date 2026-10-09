package com.boxitt.app.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

val lightTheme = AppTheme(
    name = ThemeName.LIGHT,
    colors = AppThemeColors(
        background = Color(0xFFFDFDFF),
        backgroundSecondary = Color(0xFFF1F5F9),
        card = Color(0xFFFFFFFF),
        cardElevated = Color(0xFFF8FAFC),
        border = Color(0xFFE2E8F0),
        textPrimary = Color(0xFF0F172A),
        textSecondary = Color(0xFF475569),
        textDisabled = Color(0xFF94A3B8),
        accent = Color(0xFF2563EB),
        accentGlow = Color(0xFF60A5FA),
        success = Color(0xFF059669),
        warning = Color(0xFFF59E0B),
        error = Color(0xFFE11D48),
        buttonGradient = listOf(Color(0xFF2563EB), Color(0xFF1D4ED8))
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




