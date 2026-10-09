package com.boxitt.app.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp

enum class ThemeName {
    LIGHT, DARK, BOXITT
}

data class AppThemeColors(
    val background: Color,
    val backgroundSecondary: Color,
    val card: Color,
    val cardElevated: Color,
    val border: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textDisabled: Color,
    val accent: Color,
    val accentGlow: Color,
    val success: Color,
    val warning: Color,
    val error: Color,
    val buttonGradient: List<Color>
)

data class AppThemeElevation(
    val card: Dp,
    val elevated: Dp,
    val floating: Dp,
    val modal: Dp
)

data class AppThemeRadius(
    val small: Dp,
    val medium: Dp,
    val large: Dp
)

data class AppTheme(
    val name: ThemeName,
    val colors: AppThemeColors,
    val elevation: AppThemeElevation,
    val radius: AppThemeRadius
)




