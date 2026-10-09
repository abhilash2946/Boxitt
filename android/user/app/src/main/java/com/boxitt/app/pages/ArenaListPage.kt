package com.boxitt.app.pages

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.Location
import com.boxitt.app.components.ArenaCard
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.hooks.UserProfileViewModel
import com.boxitt.app.services.LocationService
import com.boxitt.app.utils.DistanceUtils
import kotlinx.coroutines.launch

@Composable
fun ArenaListPage(onNavigateToDetails: (String) -> Unit = {}) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()
    val userProfileViewModel = remember { UserProfileViewModel(scope) }

    var arenas by remember { mutableStateOf<List<Location>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        userProfileViewModel.fetchCurrentUserProfile()
    }

    LaunchedEffect(Unit) {
        try {
            arenas = LocationService.getLocations()
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            // Silently handle error — arenas stays empty
        } finally {
            loading = false
        }
    }

    val userProfile = userProfileViewModel.currentUserProfile
    val sortedArenas = remember(arenas, userProfile) {
        if (userProfile?.latitude != null && userProfile.longitude != null) {
            arenas.sortedBy { arena ->
                if (arena.latitude != null && arena.longitude != null) {
                    DistanceUtils.calculateDistance(
                        userProfile.latitude, userProfile.longitude,
                        arena.latitude, arena.longitude
                    )
                } else Double.MAX_VALUE
            }
        } else arenas
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        if (loading) {
            val infiniteTransition = rememberInfiniteTransition(label = "loading")
            val rotation by infiniteTransition.animateFloat(
                initialValue = 0f,
                targetValue = 360f,
                animationSpec = infiniteRepeatable(
                    animation = tween(1000, easing = LinearEasing),
                    repeatMode = RepeatMode.Restart
                ),
                label = "rotation"
            )

            val borderColor = theme.colors.border
            val accentColor = theme.colors.accent

            Canvas(
                modifier = Modifier
                    .size(48.dp)
                    .align(Alignment.Center)
            ) {
                drawCircle(
                    color = borderColor,
                    style = Stroke(width = 4.dp.toPx())
                )
                drawArc(
                    color = accentColor,
                    startAngle = rotation,
                    sweepAngle = 90f,
                    useCenter = false,
                    style = Stroke(width = 4.dp.toPx())
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .widthIn(max = 1200.dp)
                    .align(Alignment.TopCenter)
                    .padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(32.dp),
                contentPadding = PaddingValues(top = 24.dp, bottom = 80.dp)
            ) {
                item {
                    Text(
                        text = "AVAILABLE ARENAS",
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        letterSpacing = (-1.5).sp,
                        color = theme.colors.textPrimary
                    )
                }

                if (sortedArenas.isEmpty()) {
                    item {
                        val borderColor = theme.colors.border
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 64.dp)
                                .height(200.dp)
                                .clip(RoundedCornerShape(24.dp))
                                .background(theme.colors.card)
                                .drawBehind {
                                    val stroke = Stroke(
                                        width = 2.dp.toPx(),
                                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f), 0f)
                                    )
                                    drawRoundRect(
                                        color = borderColor,
                                        style = stroke,
                                        cornerRadius = CornerRadius(24.dp.toPx())
                                    )
                                }
                                .padding(32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "NO ARENAS FOUND",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 1.sp
                            )
                        }
                    }
                } else {
                    items(sortedArenas) { arena ->
                        ArenaCard(
                            arena = arena,
                            onNavigateToDetails = onNavigateToDetails,
                            userLat = userProfile?.latitude,
                            userLon = userProfile?.longitude
                        )
                    }
                }
            }
        }
    }
}



