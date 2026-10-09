package com.boxitt.app.components

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.boxitt.app.Booking
import com.boxitt.app.R
import com.boxitt.app.User
import com.boxitt.app.contexts.LocalAppTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun GenericScorer(
    booking: Booking,
    user: User,
    onBack: () -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()
    var teamAScore by remember { mutableStateOf(0) }
    var teamBScore by remember { mutableStateOf(0) }
    var isFinished by remember { mutableStateOf(false) }
    var showRating by remember { mutableStateOf(false) }

    fun getWinner(): String {
        return when {
            teamAScore > teamBScore -> "${booking.name}'s Team"
            teamBScore > teamAScore -> "Opponent's Team"
            else -> "It's a Tie!"
        }
    }

    fun handleFinishMatch() {
        isFinished = true
        scope.launch {
            delay(1500)
            showRating = true
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        // Decorative background blur elements
        Box(
            modifier = Modifier
                .offset(x = (-100).dp, y = (-100).dp)
                .size(400.dp)
                .blur(120.dp)
                .clip(CircleShape)
                .background(theme.colors.accent.copy(alpha = 0.2f))
        )

        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border)
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(theme.colors.accent)
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        AsyncImage(
                            model = "file:///android_asset/public/logo.png",
                            contentDescription = "Boxitt",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }
                    Column {
                        Text(
                            text = "${booking.sport.uppercase()} SCORER",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textPrimary,
                            fontStyle = FontStyle.Italic
                        )
                        Text(
                            text = "LIVE BROADCAST",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textDisabled,
                            letterSpacing = 2.sp
                        )
                    }
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(theme.colors.textPrimary)
                        .clickable { onBack() }
                        .padding(horizontal = 20.dp, vertical = 10.dp)
                ) {
                    Text(
                        text = "EXIT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.background,
                        letterSpacing = 1.sp
                    )
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // MONITOR: The Professional Scoreboard
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth().shadow(12.dp, RoundedCornerShape(24.dp)),
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF020617)) // bg-slate-950
                    ) {
                        Column(modifier = Modifier.padding(24.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(bottom = 20.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color.Red))
                                    Text("LIVE SCORE STREAM", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 2.sp)
                                }
                            }

                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("${booking.name.uppercase()}'S TEAM", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.Gray, maxLines = 1)
                                    Spacer(Modifier.height(8.dp))
                                    AnimatedContent(targetState = teamAScore, label = "ScoreA") {
                                        Text("$it", fontSize = 56.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White)
                                    }
                                }
                                Box(modifier = Modifier.padding(horizontal = 16.dp)) {
                                    Text("VS", fontSize = 10.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.accent.copy(0.5f))
                                }
                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("OPPONENT TEAM", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.Gray, maxLines = 1)
                                    Spacer(Modifier.height(8.dp))
                                    AnimatedContent(targetState = teamBScore, label = "ScoreB") {
                                        Text("$it", fontSize = 56.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White)
                                    }
                                }
                            }
                        }
                    }
                }

                if (!isFinished) {
                    // CONSOLE: Tactical Controls
                    item {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            listOf("HOME" to teamAScore, "AWAY" to teamBScore).forEach { (side, _) ->
                                Card(
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(20.dp),
                                    colors = CardDefaults.cardColors(containerColor = theme.colors.card),
                                    border = BorderStroke(1.dp, theme.colors.border)
                                ) {
                                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(side, fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Box(
                                                modifier = Modifier
                                                    .size(56.dp)
                                                    .clip(RoundedCornerShape(12.dp))
                                                    .background(theme.colors.accent)
                                                    .clickable { if(side == "HOME") teamAScore++ else teamBScore++ }
                                                    .padding(8.dp),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(Icons.Default.Add, null, tint = Color.White)
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .size(56.dp)
                                                    .clip(RoundedCornerShape(12.dp))
                                                    .background(theme.colors.backgroundSecondary)
                                                    .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                                                    .clickable { if(side == "HOME") teamAScore = (teamAScore - 1).coerceAtLeast(0) else teamBScore = (teamBScore - 1).coerceAtLeast(0) }
                                                    .padding(8.dp),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(Icons.Default.Remove, null, tint = theme.colors.textPrimary)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    item {
                        Button(
                            onClick = { handleFinishMatch() },
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.error)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Default.Close, null)
                                Text("FINALIZE MATCH", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                            }
                        }
                    }
                } else {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(32.dp)).background(theme.colors.success.copy(0.1f)).border(1.dp, theme.colors.success.copy(0.2f), RoundedCornerShape(32.dp)).padding(40.dp), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.CheckCircle, null, tint = theme.colors.success, modifier = Modifier.size(64.dp))
                                Spacer(Modifier.height(16.dp))
                                Text(if (teamAScore > teamBScore) "${booking.name.uppercase()}'S TEAM WINS" else if (teamBScore > teamAScore) "OPPONENT WINS" else "DRAW MATCH", fontSize = 22.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                Text("OFFICIAL TERMINATION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.success, letterSpacing = 2.sp)
                            }
                        }
                    }
                    item {
                        Button(
                            onClick = { onBack() },
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Default.History, null, tint = theme.colors.background)
                                Text("RETURN TO ARCHIVES", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 1.sp)
                            }
                        }
                    }
                }
            }
        }

        if (showRating) {
            RatingModal(
                matchId = booking.id,
                locationId = booking.locationId,
                user = user,
                onClose = { showRating = false }
            )
        }
    }
}
