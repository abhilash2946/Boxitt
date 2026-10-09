package com.boxitt.app.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Converts a number to Dp based on the viewport width (screenWidth).
 * 1.vw = 1% of screen width.
 */
val Int.vw: Dp
    @Composable
    get() = (LocalConfiguration.current.screenWidthDp * (this / 100f)).dp

val Double.vw: Dp
    @Composable
    get() = (LocalConfiguration.current.screenWidthDp * (this / 100.0)).dp

val Float.vw: Dp
    @Composable
    get() = (LocalConfiguration.current.screenWidthDp * (this / 100f)).dp

/**
 * Clamps a Dp value between min and max.
 */
@Composable
fun clamp(min: Dp, value: Dp, max: Dp): Dp {
    return when {
        value < min -> min
        value > max -> max
        else -> value
    }
}
