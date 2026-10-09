package com.boxitt.app.pages

import androidx.activity.compose.BackHandler
import android.widget.Toast
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.boxitt.app.SportType
import com.boxitt.app.contexts.LocalAppTheme

data class SportInfo(
    val icon: String,
    val gradientStart: Color,
    val gradientEnd: Color,
    val shadowColor: Color
)

@Composable
fun SportSelector(
    onSelect: (SportType) -> Unit,
    onLogout: () -> Unit,
    onProfile: (() -> Unit)? = null,
    onConfirm: ((String, () -> Unit, (() -> Unit)?, String?, String?, Boolean?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val configuration = LocalConfiguration.current
    val screenWidth = configuration.screenWidthDp.dp
    val vw6 = screenWidth * 0.06f
    val context = LocalContext.current
    var lastBackPressTime by remember { mutableStateOf(0L) }

    // Native Hardware Back Button Interception with 2s double-tap window
    BackHandler {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastBackPressTime < 2000L) {
            if (onConfirm != null) {
                onConfirm(
                    "Are you sure you want to log out?",
                    { onLogout() },
                    null,
                    "LOGOUT",
                    "CANCEL",
                    true
                )
            } else {
                onLogout()
            }
        } else {
            lastBackPressTime = currentTime
            Toast.makeText(context, "Click again for logout", Toast.LENGTH_SHORT).show()
        }
    }

    val sportInfo = mapOf(
        SportType.CRICKET    to SportInfo("🏏", Color(0xFF34D399), Color(0xFF059669), Color(0x6610B981)),
        SportType.FOOTBALL   to SportInfo("⚽", Color(0xFF60A5FA), Color(0xFF2563EB), Color(0x663B82F6)),
        SportType.TENNIS     to SportInfo("🎾", Color(0xFFA3E635), Color(0xFF65A30D), Color(0x6684CC16)),
        SportType.BASKETBALL to SportInfo("🏀", Color(0xFFFB923C), Color(0xFFEA580C), Color(0x66F97316)),
        SportType.BADMINTON  to SportInfo("🏸", Color(0xFF38BDF8), Color(0xFF0284C7), Color(0x660EA5E9)),
        SportType.PICKLEBALL to SportInfo("🏓", Color(0xFF2DD4BF), Color(0xFF0D9488), Color(0x6614B8A6)),
        SportType.SWIMMING   to SportInfo("🏊‍♂️", Color(0xFF22D3EE), Color(0xFF0891B2), Color(0x6606B6D4)),
        SportType.GAME_ZONE  to SportInfo("🎮", Color(0xFFA855F7), Color(0xFF6366F1), Color(0x668B5CF6))
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        // Background Decorative Elements
        Box(
            modifier = Modifier
                .offset(x = (-screenWidth * 0.2f), y = (-screenWidth * 0.2f))
                .size(screenWidth * 0.6f)
                .blur(100.dp)
                .background(theme.colors.accent.copy(alpha = 0.15f), CircleShape)
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = (screenWidth * 0.2f), y = (screenWidth * 0.2f))
                .size(screenWidth * 0.6f)
                .blur(100.dp)
                .background(theme.colors.success.copy(alpha = 0.15f), CircleShape)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = vw6)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.height(vw6 * 2))

            Text(
                text = buildAnnotatedString {
                    withStyle(style = SpanStyle(color = theme.colors.textPrimary)) {
                        append("SELECT YOUR ")
                    }
                    withStyle(style = SpanStyle(color = theme.colors.accent)) {
                        append("SPORT")
                    }
                },
                fontSize = 40.sp,
                fontWeight = FontWeight.Black,
                fontStyle = FontStyle.Italic,
                textAlign = TextAlign.Center,
                lineHeight = 44.sp,
                modifier = Modifier.padding(bottom = (vw6 * 0.33f))
            )

            Text(
                text = "CHOOSE A SPORT TO FIND AVAILABLE ARENAS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = theme.colors.textDisabled,
                textAlign = TextAlign.Center,
                letterSpacing = 3.sp,
                modifier = Modifier.padding(bottom = vw6 * 2)
            )

            val sports = SportType.values().toList()
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(vw6)
            ) {
                // Since LazyVerticalGrid inside a scrollable Column is tricky,
                // and the web uses a simple grid, we'll implement it with Rows for 2 columns.
                sports.chunked(2).forEach { rowSports ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(vw6)
                    ) {
                        rowSports.forEach { sport ->
                            val info = sportInfo[sport]
                            SportCard(
                                sport = sport,
                                info = info,
                                modifier = Modifier.weight(1f),
                                onSelect = onSelect
                            )
                        }
                        // Fill space if the last row has only one item
                        if (rowSports.size == 1) {
                            Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(vw6 * 2))
        }
    }
}

@Composable
fun SportCard(
    sport: SportType,
    info: SportInfo?,
    modifier: Modifier = Modifier,
    onSelect: (SportType) -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.95f else 1f,
        animationSpec = tween(durationMillis = 200)
    )
    val translationY by animateFloatAsState(
        targetValue = if (isPressed) 4f else 0f,
        animationSpec = tween(durationMillis = 200)
    )

    Box(
        modifier = modifier
            .aspectRatio(0.8f)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .shadow(
                elevation = if (isPressed) 4.dp else 12.dp,
                shape = RoundedCornerShape(32.dp),
                ambientColor = info?.shadowColor ?: Color.Black,
                spotColor = info?.shadowColor ?: Color.Black
            )
            .clip(RoundedCornerShape(32.dp))
            .background(
                if (info != null)
                    Brush.verticalGradient(listOf(info.gradientStart, info.gradientEnd))
                else
                    Brush.verticalGradient(listOf(Color.Gray, Color.DarkGray))
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = { onSelect(sport) }
            ),
        contentAlignment = Alignment.Center
    ) {
        // Glossy Overlay Effect (top reflection)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .drawWithContent {
                    drawContent()
                    drawRect(
                        brush = Brush.verticalGradient(
                            0f to Color.White.copy(alpha = 0.15f),
                            0.5f to Color.Transparent
                        )
                    )
                }
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = info?.icon ?: "🏃",
                fontSize = 56.sp,
                modifier = Modifier.graphicsLayer {
                    this.translationY = translationY
                }
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = sport.name.uppercase(),
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                textAlign = TextAlign.Center,
                letterSpacing = 1.sp
            )
        }

        // Reflection Effect (bottom right)
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = 20.dp, y = 20.dp)
                .size(100.dp)
                .blur(40.dp)
                .background(Color.White.copy(alpha = 0.15f), CircleShape)
        )
    }
}



