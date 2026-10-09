package com.boxitt.app.pages

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import com.boxitt.app.services.handleError
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalDensity
import coil.compose.AsyncImage
import com.boxitt.app.Location
import com.boxitt.app.User
import com.boxitt.app.components.RatingModal
import com.boxitt.app.components.ThemeSelector
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.Storage
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

import com.boxitt.app.SportType
import java.util.TimeZone

private const val BASKETBALL_KEY = "basketball_matches"

private fun getIsoString(date: Date): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
    sdf.timeZone = TimeZone.getTimeZone("UTC")
    return sdf.format(date)
}

@Serializable
data class BasketballPlayer(
    val name: String,
    val pts1: Int = 0,
    val pts2: Int = 0,
    val pts3: Int = 0,
    val rebounds: Int = 0,
    val assists: Int = 0,
    val steals: Int = 0,
    val blocks: Int = 0,
    val fouls: Int = 0
) {
    val totalPts: Int get() = pts1 + (pts2 * 2) + (pts3 * 3)
}

@Serializable
data class BasketballPageState(
    val currentMatch: BasketballMatch? = null,
    val view: String = "history",
    val teamA: String = "Team A",
    val teamB: String = "Team B",
    val scoreA: Int = 0,
    val scoreB: Int = 0,
    val quarter: Int = 1,
    val teamAPlayers: List<String> = emptyList(),
    val teamBPlayers: List<String> = emptyList(),
    val foulsA: Int = 0,
    val foulsB: Int = 0,
    val timeoutsA: Int = 0,
    val timeoutsB: Int = 0,
    val possession: String? = null,
    val shotClock: Int = 24
)

@Serializable
data class BasketballMatch(
    val id: String, val locationId: String, val teamA: String, val teamB: String,
    val scoreA: Int = 0, val scoreB: Int = 0, val quarter: Int = 1,
    val status: String = "Live",
    val createdAt: String = getIsoString(Date()),
    val finishedAt: String? = null,
    val teamAPlayers: List<BasketballPlayer> = emptyList(),
    val teamBPlayers: List<BasketballPlayer> = emptyList(),
    val foulsA: Int = 0,
    val foulsB: Int = 0,
    val timeoutsA: Int = 0,
    val timeoutsB: Int = 0,
    val possession: String? = null,
    val tossWinner: String? = null,
    val sport: SportType = SportType.BASKETBALL,
    val history: List<String> = emptyList(),
    val startTime: String? = null,
    val endTime: String? = null
)

@Composable
fun Modifier.pressClickable(
    enabled: Boolean = true,
    scale: Float = 0.98f,
    onClick: () -> Unit
): Modifier {
    var isPressed by remember { mutableStateOf(false) }
    val animatedScale by animateFloatAsState(
        targetValue = if (isPressed) scale else 1f,
        animationSpec = tween(durationMillis = 100),
        label = "PressScale"
    )
    val animatedTranslation by animateFloatAsState(
        targetValue = if (isPressed) 4f else 0f,
        animationSpec = tween(durationMillis = 100),
        label = "PressTranslation"
    )

    return this
        .graphicsLayer {
            scaleX = animatedScale
            scaleY = animatedScale
            translationY = animatedTranslation
        }
        .pointerInput(enabled) {
            if (!enabled) return@pointerInput
            detectTapGestures(
                onPress = {
                    isPressed = true
                    try {
                        awaitRelease()
                    } finally {
                        isPressed = false
                    }
                },
                onTap = { onClick() }
            )
        }
}

private fun BasketballPlayer.toJson() = JSONObject().apply {
    put("name", name)
    put("pts1", pts1)
    put("pts2", pts2)
    put("pts3", pts3)
    put("rebounds", rebounds)
    put("assists", assists)
    put("steals", steals)
    put("blocks", blocks)
    put("fouls", fouls)
}

private fun JSONObject.toBasketballPlayer() = BasketballPlayer(
    name = getString("name"),
    pts1 = optInt("pts1"),
    pts2 = optInt("pts2"),
    pts3 = optInt("pts3"),
    rebounds = optInt("rebounds"),
    assists = optInt("assists"),
    steals = optInt("steals"),
    blocks = optInt("blocks"),
    fouls = optInt("fouls")
)

private fun BasketballMatch.toJson() = JSONObject().apply {
    try {
        put("id", id)
        put("locationId", locationId)
        put("teamA", teamA)
        put("teamB", teamB)
        put("scoreA", scoreA)
        put("scoreB", scoreB)
        put("quarter", quarter)
        put("status", status)
        put("createdAt", createdAt)
        finishedAt?.let { put("finishedAt", it) }
        put("foulsA", foulsA)
        put("foulsB", foulsB)
        put("timeoutsA", timeoutsA)
        put("timeoutsB", timeoutsB)
        possession?.let { put("possession", it) }
        tossWinner?.let { put("tossWinner", it) }
        put("teamAPlayers", JSONArray().apply { teamAPlayers.forEach { put(it.toJson()) } })
        put("teamBPlayers", JSONArray().apply { teamBPlayers.forEach { put(it.toJson()) } })
        put("history", JSONArray(history))
        put("sport", sport.name)
    } catch (e: Exception) {
        android.util.Log.e("BasketballScorer", handleError(e).message)
    }
}
private fun JSONObject.toBasketballMatch(): BasketballMatch {
    val teamAArr = optJSONArray("teamAPlayers")
    val teamAPlayers = if (teamAArr != null) (0 until teamAArr.length()).map { teamAArr.getJSONObject(it).toBasketballPlayer() } else emptyList()
    val teamBArr = optJSONArray("teamBPlayers")
    val teamBPlayers = if (teamBArr != null) (0 until teamBArr.length()).map { teamBArr.getJSONObject(it).toBasketballPlayer() } else emptyList()
    val histArr = optJSONArray("history")
    val history = if (histArr != null) (0 until histArr.length()).map { histArr.getString(it) } else emptyList()

    return BasketballMatch(
        id = getString("id"),
        locationId = getString("locationId"),
        teamA = getString("teamA"),
        teamB = getString("teamB"),
        scoreA = optInt("scoreA"),
        scoreB = optInt("scoreB"),
        quarter = optInt("quarter", 1),
        status = optString("status", "Live"),
        createdAt = optString("createdAt", ""),
        finishedAt = if (has("finishedAt")) optString("finishedAt") else null,
        teamAPlayers = teamAPlayers,
        teamBPlayers = teamBPlayers,
        foulsA = optInt("foulsA"),
        foulsB = optInt("foulsB"),
        timeoutsA = optInt("timeoutsA"),
        timeoutsB = optInt("timeoutsB"),
        possession = if (has("possession")) getString("possession") else null,
        tossWinner = if (has("tossWinner")) getString("tossWinner") else null,
        history = history,
        sport = if (has("sport")) SportType.valueOf(getString("sport")) else SportType.BASKETBALL,
        startTime = if (has("startTime")) optString("startTime") else if (has("start_time")) optString("start_time") else null,
        endTime = if (has("endTime")) optString("endTime") else if (has("end_time")) optString("end_time") else null
    )
}

private fun loadBasketball(context: android.content.Context, locationId: String): List<BasketballMatch> {
    return try {
        val raw = context.getSharedPreferences("scorer", android.content.Context.MODE_PRIVATE).getString(BASKETBALL_KEY, null) ?: return emptyList()
        val arr = JSONArray(raw)
        (0 until arr.length()).map { arr.getJSONObject(it).toBasketballMatch() }.filter { it.locationId == locationId }
    } catch (e: Exception) {
        android.util.Log.e("BasketballScorer", handleError(e).message)
        emptyList()
    }
}

private fun saveBasketball(context: android.content.Context, match: BasketballMatch) {
    try {
        val prefs = context.getSharedPreferences("scorer", android.content.Context.MODE_PRIVATE)
        val raw = prefs.getString(BASKETBALL_KEY, null)
        val all = if (raw != null) { val a = JSONArray(raw); (0 until a.length()).map { a.getJSONObject(it).toBasketballMatch() }.toMutableList() } else mutableListOf()
        val idx = all.indexOfFirst { it.id == match.id }; if (idx != -1) all[idx] = match else all.add(0, match)
        val arr = JSONArray(); all.forEach { arr.put(it.toJson()) }
        prefs.edit().putString(BASKETBALL_KEY, arr.toString()).apply()
    } catch (e: Exception) {
        android.util.Log.e("BasketballScorer", handleError(e).message)
    }
}

@Composable
private fun h1(text: String, color: Color, spanText: String, spanColor: Color) {
    Row {
        Text(
            text = text,
            fontSize = 20.sp,
            fontWeight = FontWeight.Black,
            fontStyle = FontStyle.Italic,
            color = color,
            letterSpacing = (-1).sp,
            lineHeight = 20.sp
        )
        Text(
            text = spanText,
            fontSize = 20.sp,
            fontWeight = FontWeight.Black,
            fontStyle = FontStyle.Italic,
            color = spanColor,
            letterSpacing = (-1).sp,
            lineHeight = 20.sp
        )
    }
}

@Composable
private fun p(text: String, color: Color) {
    Text(
        text = text,
        fontSize = 8.sp,
        fontWeight = FontWeight.Black,
        color = color,
        letterSpacing = 3.2.sp,
        modifier = Modifier.padding(top = 4.dp)
    )
}

@Composable
fun BasketballScorer(
    location: Location, user: User,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null, onBack: (() -> Unit)? = null
) {
    val theme = LocalAppTheme.current; val context = LocalContext.current
    val ORANGE = Color(0xFFF97316)
    val PAGE_ID = "basketball_scorer_${location.id}"
    val scope = rememberCoroutineScope()

    val savedState = remember { Storage.getPageState<BasketballPageState>(PAGE_ID) ?: BasketballPageState() }

    var matches by remember { mutableStateOf<List<BasketballMatch>>(emptyList()) }
    var currentMatch by remember { mutableStateOf(savedState.currentMatch) }
    var view by remember { mutableStateOf(savedState.view) }
    var teamA by remember { mutableStateOf(savedState.teamA) }
    var teamB by remember { mutableStateOf(savedState.teamB) }
    var scoreA by remember { mutableStateOf(savedState.scoreA) }
    var scoreB by remember { mutableStateOf(savedState.scoreB) }
    var quarter by remember { mutableStateOf(savedState.quarter) }
    var foulsA by remember { mutableStateOf(savedState.foulsA) }
    var foulsB by remember { mutableStateOf(savedState.foulsB) }
    var timeoutsA by remember { mutableStateOf(savedState.timeoutsA) }
    var timeoutsB by remember { mutableStateOf(savedState.timeoutsB) }
    var possession by remember { mutableStateOf(savedState.possession) }
    var shotClock by remember { mutableStateOf(savedState.shotClock) }
    var isShotClockRunning by remember { mutableStateOf(false) }
    var teamAPlayerNames by remember { mutableStateOf(savedState.teamAPlayers.ifEmpty { List(12) { "" } }) }
    var teamBPlayerNames by remember { mutableStateOf(savedState.teamBPlayers.ifEmpty { List(12) { "" } }) }
    var selectedPlayerIdx by remember { mutableStateOf<Int?>(null) }
    var selectedTeam by remember { mutableStateOf<String?>(null) }

    var showRating by remember { mutableStateOf(false) }
    var showToss by remember { mutableStateOf(false) }
    var isCoinSpinning by remember { mutableStateOf(false) }
    var coinTargetAngle by remember { mutableFloatStateOf(0f) }
    var coinSpinDuration by remember { mutableLongStateOf(2600L) }
    val coinRotation by animateFloatAsState(
        targetValue = coinTargetAngle,
        animationSpec = tween(durationMillis = coinSpinDuration.toInt(), easing = FastOutSlowInEasing),
        label = "coin"
    )

    LaunchedEffect(PAGE_ID, currentMatch, view, teamA, teamB, scoreA, scoreB, quarter, foulsA, foulsB, timeoutsA, timeoutsB, possession, shotClock, teamAPlayerNames, teamBPlayerNames) {
        Storage.setPageState(PAGE_ID, BasketballPageState(currentMatch, view, teamA, teamB, scoreA, scoreB, quarter, teamAPlayerNames, teamBPlayerNames, foulsA, foulsB, timeoutsA, timeoutsB, possession, shotClock))
    }

    LaunchedEffect(isShotClockRunning, shotClock) {
        if (isShotClockRunning && shotClock > 0) {
            delay(1000)
            shotClock--
            if (shotClock == 0) isShotClockRunning = false
        }
    }

    LaunchedEffect(location.id) { matches = loadBasketball(context, location.id) }

    fun syncToSupabase(m: BasketballMatch) {
        val isUuid = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE).matches(m.id)
        if (isUuid) {
            scope.launch {
                try {
                    val scoreA = m.scoreA.toString()
                    val scoreB = m.scoreB.toString()
                    val statusStr = if (m.status.equals("finished", ignoreCase = true)) "finished" else "live"
                    val isoNow = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())

                    Supabase.client.postgrest["matches"].update({
                        set("score_a", scoreA)
                        set("score_b", scoreB)
                        set("status", statusStr)
                        set("updated_at", isoNow)
                    }) {
                        filter { or { eq("id", m.id); eq("challenge_id", m.id) } }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("BasketballScorer", "Failed to sync score to Supabase", e)
                }
            }
        }
    }

    fun persist(m: BasketballMatch) {
        currentMatch = m
        saveBasketball(context, m)
        matches = loadBasketball(context, location.id)
        syncToSupabase(m)
    }

    fun handleStat(team: String, type: String, value: Int = 1) {
        val m = currentMatch ?: return
        val players = (if (team == "A") m.teamAPlayers else m.teamBPlayers).toMutableList()
        val idx = selectedPlayerIdx ?: 0
        if (idx >= players.size) return
        val p = players[idx]
        val updatedP = when (type) {
            "PTS" -> if (value == 1) p.copy(pts1 = p.pts1 + 1) else if (value == 2) p.copy(pts2 = p.pts2 + 1) else p.copy(pts3 = p.pts3 + 1)
            "REB" -> p.copy(rebounds = p.rebounds + 1)
            "AST" -> p.copy(assists = p.assists + 1)
            "STL" -> p.copy(steals = p.steals + 1)
            "BLK" -> p.copy(blocks = p.blocks + 1)
            "FOUL" -> p.copy(fouls = p.fouls + 1)
            else -> p
        }
        players[idx] = updatedP
        var nSA = scoreA; var nSB = scoreB; var nFA = foulsA; var nFB = foulsB
        if (type == "PTS") {
            if (team == "A") nSA += value else nSB += value
            shotClock = 24; isShotClockRunning = false
            possession = if (team == "A") "B" else "A"
        }
        else if (type == "FOUL") {
            if (team == "A") nFA++ else nFB++
            if (shotClock < 14) shotClock = 14
        }
        scoreA = nSA; scoreB = nSB; foulsA = nFA; foulsB = nFB
        persist(m.copy(
            scoreA = nSA, scoreB = nSB,
            teamAPlayers = if(team=="A") players else m.teamAPlayers,
            teamBPlayers = if(team=="B") players else m.teamBPlayers,
            foulsA = nFA, foulsB = nFB,
            possession = possession,
            history = m.history + "$team: ${p.name} $type $value"
        ))
    }

    fun handleToss() {
        if (isCoinSpinning) return
        isCoinSpinning = true
        val secureRandom = java.security.SecureRandom()
        val isA = secureRandom.nextBoolean()
        val extra = 7 + secureRandom.nextInt(8)
        val angle = if (isA) 0f else 180f
        coinSpinDuration = 2800L
        coinTargetAngle += extra * 360f + angle - (coinTargetAngle % 360f)
        scope.launch {
            delay(coinSpinDuration)
            isCoinSpinning = false
            val winnerName = if (isA) teamA else teamB
            possession = if (isA) "A" else "B"
            currentMatch = currentMatch?.copy(tossWinner = winnerName, possession = possession)
            onAlert?.invoke("$winnerName WON THE TOSS", "success", null)
        }
    }

    if (showToss) {
        Dialog(onDismissRequest = { if (!isCoinSpinning) showToss = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            val density = LocalDensity.current
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.9f)), contentAlignment = Alignment.Center) {
                Column(
                    modifier = Modifier.padding(32.dp).clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(2.dp, theme.colors.border, RoundedCornerShape(28.dp)).padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    Text("MATCH TOSS", fontSize = 24.sp, fontWeight = FontWeight.Black, color = ORANGE, letterSpacing = 4.sp)

                    Box(
                        modifier = Modifier.size(160.dp).graphicsLayer {
                            rotationY = coinRotation
                            cameraDistance = 12f * density.density
                        },
                        contentAlignment = Alignment.Center
                    ) {
                        val absRot = Math.abs(coinRotation % 360f)
                        val isFront = absRot < 90f || absRot > 270f

                        // Front Face - Team A
                        Box(
                            modifier = Modifier.fillMaxSize().graphicsLayer { alpha = if (isFront) 1f else 0f }.clip(CircleShape).background(Brush.linearGradient(listOf(ORANGE, Color(0xFFC2410C)))).border(8.dp, Color(0xFFFFB366), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.Stars, null, tint = Color.White, modifier = Modifier.size(48.dp))
                                Text(teamA.take(8).uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White)
                            }
                        }

                        // Back Face - Team B
                        Box(
                            modifier = Modifier.fillMaxSize().graphicsLayer { rotationY = 180f; alpha = if (!isFront) 1f else 0f }.clip(CircleShape).background(Brush.linearGradient(listOf(Color.DarkGray, Color.Black))).border(8.dp, Color.Gray, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.SportsBasketball, null, tint = ORANGE, modifier = Modifier.size(48.dp))
                                Text(teamB.take(8).uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White)
                            }
                        }
                    }

                    if (!isCoinSpinning) {
                        Button(onClick = { handleToss() }, colors = ButtonDefaults.buttonColors(containerColor = ORANGE), shape = RoundedCornerShape(20.dp), modifier = Modifier.height(56.dp).fillMaxWidth()) {
                            Text("SPIN COIN", fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                        }
                    } else {
                        Text("SPINNING...", fontSize = 16.sp, fontWeight = FontWeight.Black, color = ORANGE, modifier = Modifier.padding(vertical = 16.dp))
                    }
                }
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        // Decorative Blurs
        Box(modifier = Modifier.offset(x = (-40).dp, y = (-40).dp).size(240.dp).blur(120.dp).clip(CircleShape).background(theme.colors.accent.copy(alpha = 0.2f)))
        Box(modifier = Modifier.align(Alignment.BottomEnd).offset(x = 40.dp, y = 40.dp).size(240.dp).blur(120.dp).clip(CircleShape).background(theme.colors.success.copy(alpha = 0.2f)))

        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(theme.colors.card.copy(alpha = 0.9f))
                    .border(1.dp, theme.colors.border)
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .shadow(theme.elevation.elevated, RoundedCornerShape(8.dp))
                            .clip(RoundedCornerShape(8.dp))
                            .background(ORANGE)
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
                        h1(text = "BOXITT ", color = theme.colors.textPrimary, spanText = "BASKETBALL", spanColor = ORANGE)
                        p(text = "LIVE SCOREBOARD", color = theme.colors.textDisabled)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    ThemeSelector()
                    if (view == "live") {
                        IconButton(
                            onClick = { /* handled by pressClickable */ },
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(theme.colors.backgroundSecondary)
                                .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                                .pressClickable(scale = 0.9f) { view = "history" }
                        ) {
                            Icon(Icons.Default.History, null, tint = theme.colors.textPrimary, modifier = Modifier.size(20.dp))
                        }
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(theme.colors.textPrimary)
                            .pressClickable { onBack?.invoke() }
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Text("EXIT", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 1.sp)
                    }
                }
            }

            AnimatedContent(targetState = view, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "ViewTransition") { v ->
                when (v) {
                    "history" -> LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        item {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                                Column {
                                    Text(location.name, fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    Spacer(Modifier.height(8.dp))
                                    Row(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(20.dp))
                                            .background(theme.colors.backgroundSecondary)
                                            .border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))
                                            .padding(horizontal = 14.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(Icons.Default.History, null, tint = ORANGE, modifier = Modifier.size(14.dp))
                                        Text("MATCH HISTORY", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    }
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(ORANGE)
                                        .pressClickable { view = "setup" }
                                        .padding(horizontal = 20.dp, vertical = 12.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(16.dp))
                                        Text("NEW MATCH", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 1.sp)
                                    }
                                }
                            }
                        }
                                if (matches.isEmpty()) {
                                    item {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(20.dp))
                                                .background(theme.colors.backgroundSecondary)
                                                .drawBehind {
                                                    val stroke = Stroke(
                                                        width = 2.dp.toPx(),
                                                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f), 0f)
                                                    )
                                                    drawRoundRect(
                                                        color = theme.colors.border,
                                                        style = stroke,
                                                        cornerRadius = CornerRadius(20.dp.toPx())
                                                    )
                                                }
                                                .padding(vertical = 80.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text("NO MATCH RECORDS FOUND", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.6.sp)
                                        }
                                    }
                                } else {
                            itemsIndexed(matches) { _, m ->
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .shadow(theme.elevation.card, RoundedCornerShape(20.dp))
                                        .clip(RoundedCornerShape(20.dp))
                                        .background(theme.colors.card)
                                        .border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))
                                        .padding(20.dp)
                                ) {
                                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                Icon(Icons.Default.Timer, null, tint = theme.colors.textDisabled, modifier = Modifier.size(14.dp))
                                                val dateText = remember(m.startTime, m.endTime, m.createdAt) {
                                                    if (!m.startTime.isNullOrEmpty()) {
                                                        try {
                                                            val inFmt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault())
                                                            val timeFmt = java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault())
                                                            val dateFmt = java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale.getDefault())
                                                            val startD = inFmt.parse(m.startTime)
                                                            if (startD != null) {
                                                                if (!m.endTime.isNullOrEmpty()) {
                                                                    val endD = inFmt.parse(m.endTime)
                                                                    if (endD != null) {
                                                                        "${dateFmt.format(startD)} • ${timeFmt.format(startD)} - ${timeFmt.format(endD)}"
                                                                    } else {
                                                                        "${dateFmt.format(startD)} • ${timeFmt.format(startD)}"
                                                                    }
                                                                } else {
                                                                    "${dateFmt.format(startD)} • ${timeFmt.format(startD)}"
                                                                }
                                                            } else m.createdAt
                                                        } catch (e: Exception) { m.createdAt }
                                                    } else {
                                                        try {
                                                            val parsed = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault()).parse(m.createdAt)
                                                            if (parsed != null) java.text.SimpleDateFormat("dd/MM/yyyy, hh:mm a", java.util.Locale.getDefault()).format(parsed) else m.createdAt
                                                        } catch (e: Exception) { m.createdAt }
                                                    }
                                                }
                                                Text(dateText, fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(20.dp))
                                                    .background(if (m.status == "Live") ORANGE else theme.colors.textPrimary)
                                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                                            ) {
                                                Text(m.status.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (m.status == "Live") Color.White else theme.colors.background, letterSpacing = 1.8.sp)
                                            }
                                        }
                                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(m.teamA, fontSize = 16.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                                Text("${m.scoreA}", fontSize = 32.sp, fontWeight = FontWeight.Black, color = ORANGE)
                                            }
                                            Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(theme.colors.backgroundSecondary), contentAlignment = Alignment.Center) {
                                                Text("VS", fontSize = 9.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textDisabled)
                                            }
                                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(m.teamB, fontSize = 16.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                                Text("${m.scoreB}", fontSize = 32.sp, fontWeight = FontWeight.Black, color = ORANGE)
                                            }
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .shadow(theme.elevation.elevated, RoundedCornerShape(14.dp))
                                                .clip(RoundedCornerShape(14.dp))
                                                .background(theme.colors.textPrimary)
                                                .pressClickable {
                                                    currentMatch = m
                                                    scoreA = m.scoreA
                                                    scoreB = m.scoreB
                                                    quarter = m.quarter
                                                    view = "live"
                                                }
                                                .padding(vertical = 14.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text("RESUME MATCH", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 2.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    "review" -> LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(24.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        item {
                            Column {
                                Text("PRO MATCH REVIEW", fontSize = 28.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = FontStyle.Italic)
                                Text("${teamA.uppercase()} VS ${teamB.uppercase()}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                            }
                        }
                        
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(24.dp),
                                colors = CardDefaults.cardColors(containerColor = theme.colors.card),
                                border = BorderStroke(1.dp, theme.colors.border)
                            ) {
                                Row(modifier = Modifier.padding(24.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(teamA.take(12), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                                        Text("$scoreA", fontSize = 48.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                    }
                                    Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(theme.colors.backgroundSecondary), contentAlignment = Alignment.Center) {
                                        Text("VS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                    }
                                    Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(teamB.take(12), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                                        Text("$scoreB", fontSize = 48.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                    }
                                }
                            }
                        }

                        item {
                            Text("DENSITY PERFORMANCE METRICS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = ORANGE, letterSpacing = 2.sp)
                        }

                        listOf(currentMatch?.teamAPlayers to teamA, currentMatch?.teamBPlayers to teamB).forEach { (players, teamName) ->
                            item {
                                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))) {
                                    Column {
                                        Box(modifier = Modifier.fillMaxWidth().background(theme.colors.backgroundSecondary).padding(12.dp)) {
                                            Text(teamName.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, letterSpacing = 1.sp)
                                        }
                                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                                Text("PLAYER", modifier = Modifier.weight(2f), fontSize = 8.sp, color = theme.colors.textDisabled)
                                                Text("PTS", modifier = Modifier.weight(0.8f), fontSize = 8.sp, color = theme.colors.textDisabled, textAlign = TextAlign.Center)
                                                Text("REB", modifier = Modifier.weight(0.8f), fontSize = 8.sp, color = theme.colors.textDisabled, textAlign = TextAlign.Center)
                                                Text("AST", modifier = Modifier.weight(0.8f), fontSize = 8.sp, color = theme.colors.textDisabled, textAlign = TextAlign.Center)
                                                Text("F", modifier = Modifier.weight(0.8f), fontSize = 8.sp, color = theme.colors.textDisabled, textAlign = TextAlign.Center)
                                            }
                                            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), color = theme.colors.border.copy(0.3f))
                                            players?.filter { it.name.isNotBlank() }?.forEach { p ->
                                                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                                    Text(p.name, modifier = Modifier.weight(2f), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                                                    Text("${p.totalPts}", modifier = Modifier.weight(0.8f), fontSize = 12.sp, fontWeight = FontWeight.Black, color = ORANGE, textAlign = TextAlign.Center)
                                                    Text("${p.rebounds}", modifier = Modifier.weight(0.8f), fontSize = 10.sp, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                                    Text("${p.assists}", modifier = Modifier.weight(0.8f), fontSize = 10.sp, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                                    Text("${p.fouls}", modifier = Modifier.weight(0.8f), fontSize = 10.sp, color = if(p.fouls >= 5) Color.Red else theme.colors.textDisabled, textAlign = TextAlign.Center)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        item {
                            Button(
                                onClick = { view = "live" },
                                modifier = Modifier.fillMaxWidth().height(56.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = ORANGE),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Icon(Icons.Default.ArrowBack, null)
                                Spacer(Modifier.width(8.dp))
                                Text("BACK TO LIVE COURT", fontWeight = FontWeight.Black)
                            }
                        }
                        
                        item {
                            TextButton(onClick = { view = "history" }, modifier = Modifier.fillMaxWidth()) {
                                Text("RETURN TO HISTORY", color = theme.colors.textDisabled, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                    "setup" -> LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(24.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        item {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("PRO MATCH SETUP", fontSize = 32.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, letterSpacing = (-1).sp)
                                Text("CONFIGURING SQUADS & TOSS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                            }
                        }
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                                listOf("A" to teamA, "B" to teamB).forEach { (side, name) ->
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(20.dp)) {
                                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(if(side=="A") ORANGE else Color.Gray))
                                                Text("TEAM $side NAME", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            }
                                            OutlinedTextField(
                                                value = if(side=="A") teamA else teamB,
                                                onValueChange = { if(side=="A") teamA = it else teamB = it },
                                                placeholder = { Text("Enter Team $side Name", color = theme.colors.textDisabled) },
                                                modifier = Modifier.fillMaxWidth(),
                                                shape = RoundedCornerShape(12.dp),
                                                colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedBorderColor = ORANGE, unfocusedBorderColor = Color.Transparent)
                                            )
                                            Text("SQUAD ROSTER (12 PLAYERS)", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                                (0 until 12).forEach { idx ->
                                                    OutlinedTextField(
                                                        value = if(side=="A") teamAPlayerNames[idx] else teamBPlayerNames[idx],
                                                        onValueChange = { val newList = (if(side=="A") teamAPlayerNames else teamBPlayerNames).toMutableList(); newList[idx] = it; if(side=="A") teamAPlayerNames = newList else teamBPlayerNames = newList },
                                                        placeholder = { Text("Player ${idx + 1}", color = theme.colors.textDisabled) },
                                                        modifier = Modifier.fillMaxWidth(),
                                                        shape = RoundedCornerShape(8.dp),
                                                        textStyle = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium),
                                                        colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedBorderColor = ORANGE, unfocusedBorderColor = theme.colors.border.copy(0.3f))
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        item {
                            Button(
                                onClick = { showToss = true },
                                modifier = Modifier.fillMaxWidth().height(60.dp).border(1.dp, ORANGE, RoundedCornerShape(16.dp)),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.card)
                            ) {
                                Icon(Icons.Default.Casino, null, tint = ORANGE)
                                Spacer(Modifier.width(8.dp))
                                Text("PERFORM MATCH TOSS", color = theme.colors.textPrimary, fontWeight = FontWeight.Black)
                            }
                        }
                        item {
                            Button(
                                onClick = {
                                    if (teamA.isBlank() || teamB.isBlank()) { onAlert?.invoke("Enter team names", "error", null); return@Button }
                                    val playersA = teamAPlayerNames.mapIndexed { idx, name -> BasketballPlayer(name.ifBlank { "Player A${idx+1}" }) }
                                    val playersB = teamBPlayerNames.mapIndexed { idx, name -> BasketballPlayer(name.ifBlank { "Player B${idx+1}" }) }
                                    val m = BasketballMatch(id = "BB-${System.currentTimeMillis()}", locationId = location.id, teamA = teamA, teamB = teamB, teamAPlayers = playersA, teamBPlayers = playersB, tossWinner = currentMatch?.tossWinner, possession = possession)
                                    persist(m)
                                    scoreA = 0; scoreB = 0; quarter = 1; foulsA = 0; foulsB = 0; timeoutsA = 0; timeoutsB = 0; shotClock = 24; view = "live"
                                },
                                modifier = Modifier.fillMaxWidth().height(64.dp).shadow(theme.elevation.elevated, RoundedCornerShape(20.dp)),
                                colors = ButtonDefaults.buttonColors(containerColor = ORANGE),
                                shape = RoundedCornerShape(20.dp)
                            ) {
                                Icon(Icons.Default.PlayArrow, null)
                                Spacer(Modifier.width(8.dp))
                                Text("START PROFESSIONAL MATCH", fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                            }
                        }
                        item {
                            TextButton(onClick = { view = "history" }) {
                                Text("CANCEL", color = theme.colors.textDisabled, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                    else -> {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // Professional Scoreboard
                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth().shadow(12.dp, RoundedCornerShape(24.dp)),
                                    shape = RoundedCornerShape(24.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
                                ) {
                                    Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                        // Quarter Progress Bar
                                        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            (1..4).forEach { q ->
                                                Box(modifier = Modifier.weight(1f).height(4.dp).clip(CircleShape).background(if(quarter >= q) ORANGE else Color.Gray.copy(0.3f)))
                                            }
                                        }

                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                            Column {
                                                Text("QUARTER", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.Gray, letterSpacing = 2.sp)
                                                Text("$quarter", fontSize = 24.sp, fontWeight = FontWeight.Black, color = Color.White)
                                            }
                                            
                                            // Shot Clock Display
                                            Box(modifier = Modifier.size(70.dp).clip(CircleShape).background(if(shotClock < 5) Color(0xFF991B1B) else Color.Black).border(2.dp, if(shotClock < 5) Color.Red else ORANGE, CircleShape), contentAlignment = Alignment.Center) {
                                                Text("$shotClock", fontSize = 32.sp, fontWeight = FontWeight.Black, color = if(shotClock < 5) Color.Red else ORANGE)
                                            }

                                            Column(horizontalAlignment = Alignment.End) {
                                                Text("POSSESSION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.Gray, letterSpacing = 2.sp)
                                                val infiniteTransition = rememberInfiniteTransition(label = "possession")
                                                val alpha by infiniteTransition.animateFloat(
                                                    initialValue = 0.4f,
                                                    targetValue = 1f,
                                                    animationSpec = infiniteRepeatable(tween(800, easing = LinearEasing), RepeatMode.Reverse),
                                                    label = "pulse"
                                                )
                                                Icon(Icons.Default.SportsBasketball, null, tint = if(possession != null) ORANGE.copy(alpha = alpha) else Color.Gray, modifier = Modifier.size(24.dp))
                                            }
                                        }

                                        Spacer(Modifier.height(24.dp))
                                        
                                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                            // Team A
                                            Column(modifier = Modifier.weight(1f).clickable { possession = "A" }, horizontalAlignment = Alignment.CenterHorizontally) {
                                                if (possession == "A") Icon(Icons.Default.ArrowDropDown, null, tint = ORANGE)
                                                Text(teamA.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Gray, textAlign = TextAlign.Center, maxLines = 1)
                                                Text("$scoreA", fontSize = 56.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = (-2).sp)
                                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    Text("FOULS: $foulsA", fontSize = 9.sp, color = if(foulsA >= 5) Color.Red else Color.Gray)
                                                    if(foulsA >= 5) Box(modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(Color.Red).padding(horizontal = 4.dp)) { Text("BONUS", fontSize = 7.sp, color = Color.White, fontWeight = FontWeight.Black) }
                                                }
                                                Text("T.O: $timeoutsA", fontSize = 9.sp, color = Color.Gray)
                                            }

                                            Text("VS", fontSize = 12.sp, fontWeight = FontWeight.Black, color = ORANGE.copy(0.5f))

                                            // Team B
                                            Column(modifier = Modifier.weight(1f).clickable { possession = "B" }, horizontalAlignment = Alignment.CenterHorizontally) {
                                                if (possession == "B") Icon(Icons.Default.ArrowDropDown, null, tint = ORANGE)
                                                Text(teamB.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Gray, textAlign = TextAlign.Center, maxLines = 1)
                                                Text("$scoreB", fontSize = 56.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = (-2).sp)
                                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    Text("FOULS: $foulsB", fontSize = 9.sp, color = if(foulsB >= 5) Color.Red else Color.Gray)
                                                    if(foulsB >= 5) Box(modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(Color.Red).padding(horizontal = 4.dp)) { Text("BONUS", fontSize = 7.sp, color = Color.White, fontWeight = FontWeight.Black) }
                                                }
                                                Text("T.O: $timeoutsB", fontSize = 9.sp, color = Color.Gray)
                                            }
                                        }
                                    }
                                }
                            }

                            // Tactical Controls (Shot Clock & Quarter)
                            item {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = { isShotClockRunning = !isShotClockRunning },
                                        modifier = Modifier.weight(1.5f).height(50.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = if(isShotClockRunning) theme.colors.error else theme.colors.success),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text(if(isShotClockRunning) "STOP CLOCK" else "START CLOCK", fontSize = 10.sp, fontWeight = FontWeight.Black)
                                    }
                                    Button(
                                        onClick = { shotClock = 24; isShotClockRunning = true },
                                        modifier = Modifier.weight(1f).height(50.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = theme.colors.card),
                                        border = BorderStroke(1.dp, theme.colors.border),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text("RESET 24s", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                    }
                                    Button(
                                        onClick = { shotClock = 14; isShotClockRunning = true },
                                        modifier = Modifier.weight(1f).height(50.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = theme.colors.card),
                                        border = BorderStroke(1.dp, theme.colors.border),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text("RESET 14s", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                    }
                                }
                            }

                            // Match Flow
                            item {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = { if(quarter < 4) { quarter++; foulsA = 0; foulsB = 0; shotClock = 24; isShotClockRunning = false } },
                                        modifier = Modifier.weight(1f),
                                        colors = ButtonDefaults.buttonColors(containerColor = theme.colors.backgroundSecondary),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text("NEXT QUARTER", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                    }
                                    Button(
                                        onClick = { 
                                            if(selectedTeam == "A") { timeoutsA++; persist(currentMatch!!.copy(timeoutsA = timeoutsA)) }
                                            else if(selectedTeam == "B") { timeoutsB++; persist(currentMatch!!.copy(timeoutsB = timeoutsB)) }
                                        },
                                        modifier = Modifier.weight(1f),
                                        colors = ButtonDefaults.buttonColors(containerColor = theme.colors.backgroundSecondary),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text("TIMEOUT", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                    }
                                }
                            }

                            // Player Roster Selector
                            item {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("SELECT ACTIVE PLAYER", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    listOf("A" to teamA, "B" to teamB).forEach { (side, name) ->
                                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            val players = if(side=="A") currentMatch?.teamAPlayers else currentMatch?.teamBPlayers
                                            players?.forEachIndexed { idx, p ->
                                                val isSelected = selectedTeam == side && selectedPlayerIdx == idx
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(12.dp))
                                                        .background(if(isSelected) ORANGE else theme.colors.card)
                                                        .border(1.dp, if(isSelected) Color.Transparent else theme.colors.border, RoundedCornerShape(12.dp))
                                                        .clickable { selectedTeam = side; selectedPlayerIdx = idx; possession = side }
                                                        .padding(horizontal = 14.dp, vertical = 10.dp)
                                                ) {
                                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                        Text(p.name.take(10), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = if(isSelected) Color.White else theme.colors.textPrimary)
                                                        Text("${p.totalPts} PTS | ${p.fouls} F", fontSize = 8.sp, color = if(isSelected) Color.White.copy(0.7f) else theme.colors.textDisabled)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Statistical Actions
                            item {
                                if (selectedTeam != null) {
                                    Column(modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(theme.colors.card).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Text("LOG STATS FOR ${if(selectedTeam=="A") teamA else teamB}", fontSize = 9.sp, fontWeight = FontWeight.Black, color = ORANGE, letterSpacing = 2.sp)
                                        
                                        // Points
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            listOf(1, 2, 3).forEach { pts ->
                                                Button(
                                                    onClick = { handleStat(selectedTeam!!, "PTS", pts) },
                                                    modifier = Modifier.weight(1f).height(50.dp),
                                                    colors = ButtonDefaults.buttonColors(containerColor = if(pts==3) ORANGE else theme.colors.backgroundSecondary),
                                                    shape = RoundedCornerShape(12.dp)
                                                ) {
                                                    Text("+$pts PT", color = if(pts==3) Color.White else theme.colors.textPrimary, fontWeight = FontWeight.Black)
                                                }
                                            }
                                        }
                                        
                                        // General Stats
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            listOf("REB" to "REBOUND", "AST" to "ASSIST", "STL" to "STEAL").forEach { (type, label) ->
                                                Button(
                                                    onClick = { handleStat(selectedTeam!!, type) },
                                                    modifier = Modifier.weight(1f),
                                                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.backgroundSecondary),
                                                    shape = RoundedCornerShape(10.dp)
                                                ) {
                                                    Text(label, fontSize = 9.sp, color = theme.colors.textPrimary, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        }

                                        // Discipline
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Button(
                                                onClick = { handleStat(selectedTeam!!, "BLK") },
                                                modifier = Modifier.weight(1f),
                                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.backgroundSecondary),
                                                shape = RoundedCornerShape(10.dp)
                                            ) {
                                                Text("BLOCK", fontSize = 9.sp, color = theme.colors.textPrimary, fontWeight = FontWeight.Bold)
                                            }
                                            Button(
                                                onClick = { handleStat(selectedTeam!!, "FOUL") },
                                                modifier = Modifier.weight(1f),
                                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.error.copy(0.1f)),
                                                border = BorderStroke(1.dp, theme.colors.error),
                                                shape = RoundedCornerShape(10.dp)
                                            ) {
                                                Text("FOUL", fontSize = 9.sp, color = theme.colors.error, fontWeight = FontWeight.Black)
                                            }
                                        }
                                    }
                                } else {
                                    Box(modifier = Modifier.fillMaxWidth().height(100.dp).clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)), contentAlignment = Alignment.Center) {
                                        Text("SELECT A PLAYER TO LOG STATS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    }
                                }
                            }

                            // Finalize
                            item {
                                Row(modifier = Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Button(
                                        onClick = { view = "review" },
                                        modifier = Modifier.weight(1f).height(56.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = theme.colors.backgroundSecondary),
                                        shape = RoundedCornerShape(16.dp)
                                    ) {
                                        Icon(Icons.Default.Analytics, null, tint = theme.colors.textPrimary, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text("METRICS", color = theme.colors.textPrimary, fontWeight = FontWeight.Black)
                                    }
                                    Button(
                                        onClick = { 
                                            currentMatch?.let { m ->
                                                val fin = m.copy(scoreA = scoreA, scoreB = scoreB, quarter = quarter, status = "Finished", finishedAt = getIsoString(Date()))
                                                persist(fin)
                                                Storage.clearPageState(PAGE_ID)
                                                scope.launch { delay(1500); showRating = true }
                                            }
                                        },
                                        modifier = Modifier.weight(1f).height(56.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = theme.colors.error),
                                        shape = RoundedCornerShape(16.dp)
                                    ) {
                                        Text("FINALIZE", fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        if (showRating) RatingModal(matchId = currentMatch?.id ?: "BB-${System.currentTimeMillis()}", locationId = location.id, user = user, onClose = { showRating = false })
    }
}



