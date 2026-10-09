package com.boxitt.app.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

val boxTheme = AppTheme(
    name = ThemeName.BOXITT,
    colors = AppThemeColors(
        background = Color(0xFFE7F7E7),
        backgroundSecondary = Color(0xFFD8EFD8),
        card = Color(0xFFFFFFFF),
        cardElevated = Color(0xFFC7E8C7),
        border = Color(0xFFBDDBBD),
        textPrimary = Color(0xFF0A2A0A),
        textSecondary = Color(0xFF2D4F2D),
        textDisabled = Color(0xFF8EB08E),
        accent = Color(0xFF006305),
        accentGlow = Color(0xFF22C55E),
        success = Color(0xFF22C55E),
        warning = Color(0xFFF59E0B),
        error = Color(0xFFDC2626),
        buttonGradient = listOf(Color(0xFF004D04), Color(0xFF006305))
    ),
    elevation = AppThemeElevation(
        card = 4.dp,
        elevated = 6.dp,
        floating = 10.dp,
        modal = 20.dp
    ),
    radius = AppThemeRadius(
        small = 12.dp,
        medium = 16.dp,
        large = 28.dp
    )
)




