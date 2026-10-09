package com.boxitt.app.contexts

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import com.boxitt.app.services.Storage
import com.boxitt.app.theme.AppTheme
import com.boxitt.app.theme.ThemeName
import com.boxitt.app.theme.lightTheme
import com.boxitt.app.theme.themes

object ThemeManager {
    var currentThemeName by mutableStateOf(ThemeName.LIGHT)
        private set

    val currentTheme: AppTheme
        get() = themes[currentThemeName] ?: lightTheme

    fun init() {
        val saved = Storage.get("app-theme")
        val themeEnum = try {
            ThemeName.valueOf(saved ?: "")
        } catch (e: Exception) {
            ThemeName.LIGHT
        }
        currentThemeName = themeEnum
    }

    fun setTheme(theme: ThemeName) {
        currentThemeName = theme
        Storage.set("app-theme", theme.name)
    }
}

val LocalAppTheme: ProvidableCompositionLocal<AppTheme> = staticCompositionLocalOf { lightTheme }

@Composable
fun ThemeProvider(content: @Composable () -> Unit) {
    val theme = ThemeManager.currentTheme
    CompositionLocalProvider(LocalAppTheme provides theme) {
        content()
    }
}




