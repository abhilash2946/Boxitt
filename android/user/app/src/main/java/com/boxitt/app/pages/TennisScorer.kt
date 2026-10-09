package com.boxitt.app.pages

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.boxitt.app.Location
import com.boxitt.app.SportType
import com.boxitt.app.User
import com.boxitt.app.components.RatingModal
import com.boxitt.app.components.ThemeSelector
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.Storage
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.postgrest.postgrest
import com.boxitt.app.services.handleError
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.*
import kotlin.math.abs

private const val TENNIS_KEY = "tennis_matches"

@Serializable
data class TennisStats(
    val aces: Int = 0,
    val winners: Int = 0,
    val unforcedErrors: Int = 0,
    val firstServesIn: Int = 0,
    val totalServes: Int = 0,
    val doubleFaults: Int = 0
)

@Serializable
data class TennisMatch(
    val id: String,
    val locationId: String,
    val playerA: String,
    val playerB: String,
    val pointsA: Int = 0,
    val pointsB: Int = 0,
    val isAdA: Boolean = false,
    val isAdB: Boolean = false,
    val gamesA: Int = 0,
    val gamesB: Int = 0,
    val setsA: Int = 0,
    val setsB: Int = 0,
    val status: String = "Live", // "Live" | "Finished"
    val createdAt: String = Instant.now().toString(),
    val finishedAt: String? = null,
    val sport: SportType = SportType.TENNIS,
    val tossWinner: String? = null,
    val optedTo: String? = null, // "Serve" | "Receive"
    val server: String = "A",
    val statsA: TennisStats = TennisStats(),
    val statsB: TennisStats = TennisStats(),
    val setHistory: List<Pair<Int, Int>> = emptyList(),
    val setFormat: Int = 2, // 2 for Best of 3, 3 for Best of 5
    val startTime: String? = null,
    val endTime: String? = null
)

@Serializable
private data class TennisPageState(
    val currentMatch: TennisMatch? = null,
    val view: String = "history",
    val playerA: String = "Player A",
    val playerB: String = "Player B",
    val pointsA: Int = 0,
    val pointsB: Int = 0,
    val isAdA: Boolean = false,
    val isAdB: Boolean = false,
    val gamesA: Int = 0,
    val gamesB: Int = 0,
    val setsA: Int = 0,
    val setsB: Int = 0,
    val tossWinner: String? = null,
    val optedTo: String? = null,
    val server: String = "A",
    val statsA: TennisStats = TennisStats(),
    val statsB: TennisStats = TennisStats(),
    val setHistory: List<Pair<Int, Int>> = emptyList(),
    val setFormat: Int = 2,
    val isSecondServe: Boolean = false
)

private fun TennisStats.toJson() = JSONObject().apply {
    put("aces", aces); put("winners", winners); put("unforcedErrors", unforcedErrors); put("firstServesIn", firstServesIn); put("totalServes", totalServes); put("doubleFaults", doubleFaults)
}

private fun JSONObject.toTennisStats() = TennisStats(
    aces = optInt("aces"), winners = optInt("winners"), unforcedErrors = optInt("unforcedErrors"),
    firstServesIn = optInt("firstServesIn"), totalServes = optInt("totalServes"), doubleFaults = optInt("doubleFaults")
)

private fun TennisMatch.toJson() = JSONObject().apply {
    put("id", id); put("locationId", locationId); put("playerA", playerA); put("playerB", playerB)
    put("pointsA", pointsA); put("pointsB", pointsB); put("isAdA", isAdA); put("isAdB", isAdB)
    put("gamesA", gamesA); put("gamesB", gamesB); put("setsA", setsA); put("setsB", setsB)
    put("status", status); put("createdAt", createdAt); put("sport", sport.value)
    finishedAt?.let { put("finishedAt", it) }
    put("tossWinner", tossWinner); put("optedTo", optedTo); put("server", server)
    put("statsA", statsA.toJson()); put("statsB", statsB.toJson())
    val sh = JSONArray(); setHistory.forEach { sh.put(JSONObject().apply { put("a", it.first); put("b", it.second) }) }; put("setHistory", sh)
    put("setFormat", setFormat)
}

private fun JSONObject.toTennisMatch() = TennisMatch(
    id = getString("id"),
    locationId = getString("locationId"),
    playerA = getString("playerA"),
    playerB = getString("playerB"),
    pointsA = optInt("pointsA"),
    pointsB = optInt("pointsB"),
    isAdA = optBoolean("isAdA"),
    isAdB = optBoolean("isAdB"),
    gamesA = optInt("gamesA"),
    gamesB = optInt("gamesB"),
    setsA = optInt("setsA"),
    setsB = optInt("setsB"),
    status = optString("status", "Live"),
    createdAt = optString("createdAt", ""),
    finishedAt = if (has("finishedAt")) optString("finishedAt") else null,
    sport = SportType.values().find { it.value == optString("sport") } ?: SportType.TENNIS,
    tossWinner = if (has("tossWinner")) optString("tossWinner") else null,
    optedTo = if (has("optedTo")) optString("optedTo") else null,
    server = optString("server", "A"),
    statsA = optJSONObject("statsA")?.toTennisStats() ?: TennisStats(),
    statsB = optJSONObject("statsB")?.toTennisStats() ?: TennisStats(),
    setHistory = optJSONArray("setHistory")?.let { arr -> (0 until arr.length()).map { i -> val o = arr.getJSONObject(i); o.getInt("a") to o.getInt("b") } } ?: emptyList(),
    setFormat = optInt("setFormat", 2),
    startTime = if (has("startTime")) optString("startTime") else if (has("start_time")) optString("start_time") else null,
    endTime = if (has("endTime")) optString("endTime") else if (has("end_time")) optString("end_time") else null
)

private fun loadTennis(ctx: android.content.Context, locId: String): List<TennisMatch> {
    return try {
        val raw = ctx.getSharedPreferences("scorer", android.content.Context.MODE_PRIVATE).getString(TENNIS_KEY, null) ?: return emptyList()
        val arr = JSONArray(raw)
        (0 until arr.length()).map { arr.getJSONObject(it).toTennisMatch() }.filter { it.locationId == locId }
    } catch (e: Exception) {
        android.util.Log.e("TennisScorer", handleError(e).message)
        emptyList()
    }
}

private fun saveTennis(ctx: android.content.Context, match: TennisMatch) {
    try {
        val prefs = ctx.getSharedPreferences("scorer", android.content.Context.MODE_PRIVATE)
        val raw = prefs.getString(TENNIS_KEY, null)
        val all = if (raw != null) {
            val a = JSONArray(raw)
            (0 until a.length()).map { a.getJSONObject(it).toTennisMatch() }.toMutableList()
        } else mutableListOf()
        val idx = all.indexOfFirst { it.id == match.id }
        if (idx != -1) all[idx] = match else all.add(0, match)
        val arr = JSONArray(); all.forEach { arr.put(it.toJson()) }
        prefs.edit().putString(TENNIS_KEY, arr.toString()).apply()
    } catch (e: Exception) {
        android.util.Log.e("TennisScorer", handleError(e).message)
    }
}


fun formatTennisPoints(p: Int, isAd: Boolean): String = when {
    isAd -> "AD"; p == 0 -> "0"; p == 1 -> "15"; p == 2 -> "30"; else -> "40"
}

@Composable
fun TennisScorer(
    location: Location, user: User,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null, onBack: (() -> Unit)? = null
) {
    val theme = LocalAppTheme.current; val context = LocalContext.current
    val PAGE_ID = "tennis_scorer_${location.id}"
    val scope = rememberCoroutineScope()
    val savedState = remember { Storage.getPageState<TennisPageState>(PAGE_ID) ?: TennisPageState() }

    var matches by remember { mutableStateOf<List<TennisMatch>>(emptyList()) }
    var currentMatch by remember { mutableStateOf<TennisMatch?>(savedState.currentMatch) }
    var view by remember { mutableStateOf(savedState.view) }
    var playerA by remember { mutableStateOf(savedState.playerA) }
    var playerB by remember { mutableStateOf(savedState.playerB) }
    var pointsA by remember { mutableStateOf(savedState.pointsA) }
    var pointsB by remember { mutableStateOf(savedState.pointsB) }
    var isAdA by remember { mutableStateOf(savedState.isAdA) }
    var isAdB by remember { mutableStateOf(savedState.isAdB) }
    var gamesA by remember { mutableStateOf(savedState.gamesA) }
    var gamesB by remember { mutableStateOf(savedState.gamesB) }
    var setsA by remember { mutableStateOf(savedState.setsA) }
    var setsB by remember { mutableStateOf(savedState.setsB) }
    var tossWinner by remember { mutableStateOf(savedState.tossWinner) }
    var optedTo by remember { mutableStateOf(savedState.optedTo) }
    var server by remember { mutableStateOf(savedState.server) }
    var statsA by remember { mutableStateOf(savedState.statsA) }
    var statsB by remember { mutableStateOf(savedState.statsB) }
    var setHistory by remember { mutableStateOf(savedState.setHistory) }
    var setFormat by remember { mutableIntStateOf(savedState.setFormat) }
    var isSecondServe by remember { mutableStateOf(savedState.isSecondServe) }
    var showRating by remember { mutableStateOf(false) }

    // Toss Animation State
    var showToss by remember { mutableStateOf(false) }
    var tossResult by remember { mutableStateOf<String?>(null) }
    var isCoinSpinning by remember { mutableStateOf(false) }
    var coinSpinDuration by remember { mutableLongStateOf(2600L) }
    var coinTargetAngle by remember { mutableFloatStateOf(0f) }
    val coinRotation by animateFloatAsState(
        targetValue = coinTargetAngle,
        animationSpec = tween(durationMillis = coinSpinDuration.toInt(), easing = FastOutSlowInEasing),
        label = "coin"
    )

    LaunchedEffect(currentMatch, view, playerA, playerB, pointsA, pointsB, isAdA, isAdB, gamesA, gamesB, setsA, setsB, tossWinner, optedTo, server, statsA, statsB, setHistory, setFormat, isSecondServe) {
        Storage.setPageState(PAGE_ID, TennisPageState(currentMatch, view, playerA, playerB, pointsA, pointsB, isAdA, isAdB, gamesA, gamesB, setsA, setsB, tossWinner, optedTo, server, statsA, statsB, setHistory, setFormat, isSecondServe))
    }

    LaunchedEffect(location.id) { matches = loadTennis(context, location.id) }

    fun syncToSupabase(m: TennisMatch) {
        val isUuid = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE).matches(m.id)
        if (isUuid) {
            scope.launch {
                try {
                    val scoreA = m.setsA.toString()
                    val scoreB = m.setsB.toString()
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
                    android.util.Log.e("TennisScorer", "Failed to sync score to Supabase", e)
                }
            }
        }
    }

    fun persist(m: TennisMatch) {
        currentMatch = m
        saveTennis(context, m)
        matches = loadTennis(context, location.id)
        syncToSupabase(m)
    }

    suspend fun winSet(p: String, m: TennisMatch) {
        var sA = m.setsA; var sB = m.setsB
        val currentHistory = m.setHistory.toMutableList()
        currentHistory.add(m.gamesA to m.gamesB)
        setHistory = currentHistory
        val winningSets = if (setFormat == 2) 2 else 3
        
        if (p == "A") {
            sA += 1; setsA = sA
            if (sA == winningSets) {
                persist(m.copy(setsA = sA, status = "Finished", finishedAt = java.time.Instant.now().toString(), setHistory = currentHistory))
                Storage.clearPageState(PAGE_ID)
                delay(1500)
                view = "review"
                return
            }
        } else {
            sB += 1; setsB = sB
            if (sB == winningSets) {
                persist(m.copy(setsB = sB, status = "Finished", finishedAt = java.time.Instant.now().toString(), setHistory = currentHistory))
                Storage.clearPageState(PAGE_ID)
                delay(1500)
                view = "review"
                return
            }
        }
        persist(m.copy(setsA = sA, setsB = sB, gamesA = 0, gamesB = 0, setHistory = currentHistory))
        gamesA = 0; gamesB = 0
    }

    suspend fun winGame(p: String, m: TennisMatch) {
        var gA = m.gamesA; var gB = m.gamesB
        pointsA = 0; pointsB = 0; isAdA = false; isAdB = false
        // Switch server after every game
        server = if (server == "A") "B" else "A"
        
        if (p == "A") {
            gA += 1; gamesA = gA
            if (gA >= 6 && gA - gB >= 2) { winSet("A", m.copy(gamesA = gA, pointsA = 0, pointsB = 0, isAdA = false, isAdB = false, server = server)); return }
        } else {
            gB += 1; gamesB = gB
            if (gB >= 6 && gB - gA >= 2) { winSet("B", m.copy(gamesB = gB, pointsA = 0, pointsB = 0, isAdA = false, isAdB = false, server = server)); return }
        }
        persist(m.copy(gamesA = gA, gamesB = gB, pointsA = 0, pointsB = 0, isAdA = false, isAdB = false, server = server))
    }

    fun handlePoint(player: String) {
        val m = currentMatch ?: return
        val nm = m.copy(pointsA = pointsA, pointsB = pointsB, isAdA = isAdA, isAdB = isAdB, gamesA = gamesA, gamesB = gamesB, setsA = setsA, setsB = setsB)
        if (player == "A") {
            if (isAdB) { isAdB = false; persist(nm.copy(isAdB = false)); return }
            if (pointsA == 3 && pointsB < 3) { scope.launch { winGame("A", nm) }; return }
            if (pointsA == 3 && pointsB == 3) { if (isAdA) { scope.launch { winGame("A", nm) }; return }; isAdA = true; persist(nm.copy(isAdA = true)); return }
            val np = pointsA + 1; pointsA = np; persist(nm.copy(pointsA = np))
        } else {
            if (isAdA) { isAdA = false; persist(nm.copy(isAdA = false)); return }
            if (pointsB == 3 && pointsA < 3) { scope.launch { winGame("B", nm) }; return }
            if (pointsB == 3 && pointsA == 3) { if (isAdB) { scope.launch { winGame("B", nm) }; return }; isAdB = true; persist(nm.copy(isAdB = true)); return }
            val np = pointsB + 1; pointsB = np; persist(nm.copy(pointsB = np))
        }
    }

    fun trackMetric(side: String, type: String) {
        val m = currentMatch ?: return
        if (side == "A") {
            statsA = when(type) {
                "ace" -> { isSecondServe = false; statsA.copy(aces = statsA.aces + 1, winners = statsA.winners + 1, firstServesIn = if(!isSecondServe) statsA.firstServesIn + 1 else statsA.firstServesIn, totalServes = statsA.totalServes + 1) }
                "winner" -> statsA.copy(winners = statsA.winners + 1)
                "unforced" -> statsA.copy(unforcedErrors = statsA.unforcedErrors + 1)
                "serveIn" -> { val inc = if(!isSecondServe) 1 else 0; isSecondServe = false; statsA.copy(firstServesIn = statsA.firstServesIn + inc, totalServes = statsA.totalServes + 1) }
                "serveFault" -> {
                    if (isSecondServe) {
                        isSecondServe = false
                        statsA.copy(doubleFaults = statsA.doubleFaults + 1, totalServes = statsA.totalServes + 1)
                    } else {
                        isSecondServe = true
                        statsA.copy(totalServes = statsA.totalServes + 1)
                    }
                }
                else -> statsA
            }
        } else {
            statsB = when(type) {
                "ace" -> { isSecondServe = false; statsB.copy(aces = statsB.aces + 1, winners = statsB.winners + 1, firstServesIn = if(!isSecondServe) statsB.firstServesIn + 1 else statsB.firstServesIn, totalServes = statsB.totalServes + 1) }
                "winner" -> statsB.copy(winners = statsB.winners + 1)
                "unforced" -> statsB.copy(unforcedErrors = statsB.unforcedErrors + 1)
                "serveIn" -> { val inc = if(!isSecondServe) 1 else 0; isSecondServe = false; statsB.copy(firstServesIn = statsB.firstServesIn + inc, totalServes = statsB.totalServes + 1) }
                "serveFault" -> {
                    if (isSecondServe) {
                        isSecondServe = false
                        statsB.copy(doubleFaults = statsB.doubleFaults + 1, totalServes = statsB.totalServes + 1)
                    } else {
                        isSecondServe = true
                        statsB.copy(totalServes = statsB.totalServes + 1)
                    }
                }
                else -> statsB
            }
        }
        persist(m.copy(statsA = statsA, statsB = statsB))
        // If double fault, award point to other player
        if (type == "serveFault" && !isSecondServe) {
            handlePoint(if (side == "A") "B" else "A")
        }
    }

    fun startMatch() {
        if (playerA.isBlank() || playerB.isBlank()) { onAlert?.invoke("Enter both player names", "error", null); return }
        if (tossWinner == null || optedTo == null) { onAlert?.invoke("Please complete the toss", "error", null); return }
        
        val startServer = if ((tossWinner == "A" && optedTo == "Serve") || (tossWinner == "B" && optedTo == "Receive")) "A" else "B"
        
        val newMatch = TennisMatch(
            id = "TN-${System.currentTimeMillis()}", 
            locationId = location.id, 
            playerA = playerA, 
            playerB = playerB,
            tossWinner = tossWinner,
            optedTo = optedTo,
            server = startServer,
            setFormat = setFormat
        )
        persist(newMatch); pointsA = 0; pointsB = 0; isAdA = false; isAdB = false; gamesA = 0; gamesB = 0; setsA = 0; setsB = 0; server = startServer
        statsA = TennisStats(); statsB = TennisStats(); setHistory = emptyList(); view = "live"; isSecondServe = false
    }

    fun handleTossAction() {
        if (isCoinSpinning) return
        isCoinSpinning = true
        tossResult = "flipping"
        val secureRandom = java.security.SecureRandom()
        val isAWinner = secureRandom.nextBoolean()
        val winner = if (isAWinner) "A" else "B"
        val extraRotations = 7 + secureRandom.nextInt(8)
        val landingFaceAngle = if (isAWinner) 0f else 180f
        coinSpinDuration = 2800L + (secureRandom.nextDouble() * 800L).toLong()
        // Cumulative rotation to ensure it always spins forward and triggers animation
        coinTargetAngle += extraRotations * 360f + landingFaceAngle - (coinTargetAngle % 360f)

        scope.launch {
            delay(coinSpinDuration)
            tossWinner = winner
            tossResult = if (winner == "A") (playerA.ifBlank { "Player A" }) else (playerB.ifBlank { "Player B" })
            isCoinSpinning = false
        }
    }

    fun resumeMatch(m: TennisMatch) {
        currentMatch = m; playerA = m.playerA; playerB = m.playerB
        pointsA = m.pointsA; pointsB = m.pointsB; isAdA = m.isAdA; isAdB = m.isAdB
        gamesA = m.gamesA; gamesB = m.gamesB; setsA = m.setsA; setsB = m.setsB; 
        tossWinner = m.tossWinner; optedTo = m.optedTo; server = m.server
        statsA = m.statsA; statsB = m.statsB; setHistory = m.setHistory; setFormat = m.setFormat
        isSecondServe = false; view = "live"
    }


    Box(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        // Decorative Blurs
        Box(modifier = Modifier.offset(x = (-40).dp, y = (-40).dp).size(300.dp).blur(120.dp).clip(CircleShape).background(theme.colors.accent.copy(alpha = 0.2f)))
        Box(modifier = Modifier.align(Alignment.BottomEnd).offset(x = 40.dp, y = 40.dp).size(300.dp).blur(120.dp).clip(CircleShape).background(theme.colors.success.copy(alpha = 0.2f)))

        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(modifier = Modifier.fillMaxWidth().background(theme.colors.card.copy(0.9f)).border(1.dp, theme.colors.border).padding(horizontal = 20.dp, vertical = 16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(modifier = Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(theme.colors.accent).padding(8.dp), contentAlignment = Alignment.Center) {
                        AsyncImage(
                            model = "file:///android_asset/public/logo.png",
                            contentDescription = "Boxitt",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }
                    Column {
                        Text(
                            text = buildAnnotatedString {
                                append("BOXITT ")
                                withStyle(SpanStyle(color = theme.colors.accent)) {
                                    append("TENNIS")
                                }
                            },
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            fontStyle = FontStyle.Italic,
                            color = theme.colors.textPrimary,
                            letterSpacing = (-1).sp
                        )
                        Text("LIVE SCOREBOARD", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    ThemeSelector()
                    if (view == "live") IconButton(onClick = { view = "history" }, modifier = Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))) { Icon(Icons.Default.History, null, tint = theme.colors.textSecondary) }
                    Box(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(theme.colors.textPrimary).clickable { onBack?.invoke() }.padding(horizontal = 24.dp, vertical = 12.dp)) {
                        Text("EXIT", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 2.sp)
                    }
                }
            }

            AnimatedContent(targetState = view, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "ViewTransition") { v ->
                when (v) {
                    "history" -> LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        item {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                                Column {
                                    Text(location.name.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                                    Spacer(Modifier.height(8.dp))
                                    Row(modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(theme.colors.backgroundSecondary.copy(0.4f)).border(1.dp, theme.colors.border.copy(0.4f), RoundedCornerShape(20.dp)).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Icon(Icons.Default.History, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                                        Text("MATCH HISTORY", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    }
                                }
                                Box(modifier = Modifier.shadow(theme.elevation.elevated, RoundedCornerShape(14.dp)).clip(RoundedCornerShape(14.dp)).background(theme.colors.accent).clickable { view = "setup" }.padding(horizontal = 24.dp, vertical = 14.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(18.dp))
                                        Text("NEW MATCH", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 2.sp)
                                    }
                                }
                            }
                        }
                        if (matches.isEmpty()) {
                            item {
                                Box(modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(20.dp)).background(Color.White.copy(0.05f)).border(2.dp, theme.colors.border.copy(0.4f), RoundedCornerShape(20.dp)).padding(60.dp), contentAlignment = Alignment.Center) {
                                    Text("NO MATCH RECORDS FOUND", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                }
                            }
                        } else {
                            itemsIndexed(matches) { _, m ->
                                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(24.dp)) {
                                    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Icon(Icons.Default.Timer, null, tint = theme.colors.textDisabled, modifier = Modifier.size(14.dp))
                                                val dateStr = remember(m.startTime, m.endTime, m.createdAt) {
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
                                                Text(dateStr, fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                            }
                                            val infiniteTransition = rememberInfiniteTransition(label = "Pulse")
                                            val alpha by infiniteTransition.animateFloat(initialValue = 1f, targetValue = 0.5f, animationSpec = infiniteRepeatable(animation = tween(1000), repeatMode = RepeatMode.Reverse), label = "Alpha")
                                            Box(modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(if (m.status == "Live") theme.colors.accent else theme.colors.accent.copy(0.2f)).then(if (m.status == "Live") Modifier.alpha(alpha) else Modifier).padding(horizontal = 12.dp, vertical = 6.dp)) {
                                                Text(m.status.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (m.status == "Live") Color.White else theme.colors.accent, letterSpacing = 1.sp)
                                            }
                                        }
                                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(m.playerA.uppercase(), fontSize = 18.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                                Spacer(Modifier.height(8.dp))
                                                Box(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(theme.colors.accent.copy(0.15f)).padding(horizontal = 10.dp, vertical = 4.dp)) {
                                                    Text("Sets: ${m.setsA}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 1.sp)
                                                }
                                            }
                                            Box(modifier = Modifier.size(44.dp).clip(CircleShape).border(1.dp, theme.colors.border.copy(0.4f), CircleShape).background(Color.White.copy(0.05f)), contentAlignment = Alignment.Center) {
                                                Text("VS", fontSize = 10.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textDisabled)
                                            }
                                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(m.playerB.uppercase(), fontSize = 18.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                                Spacer(Modifier.height(8.dp))
                                                Box(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(theme.colors.accent.copy(0.15f)).padding(horizontal = 10.dp, vertical = 4.dp)) {
                                                    Text("Sets: ${m.setsB}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 1.sp)
                                                }
                                            }
                                        }
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(56.dp)
                                                    .clip(RoundedCornerShape(16.dp))
                                                    .background(theme.colors.backgroundSecondary)
                                                    .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                                                    .clickable { currentMatch = m; view = "setup" },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(Icons.Default.Edit, contentDescription = "Edit Setup", tint = theme.colors.textSecondary, modifier = Modifier.size(20.dp))
                                            }

                                            Box(
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .height(56.dp)
                                                    .clip(RoundedCornerShape(16.dp))
                                                    .background(theme.colors.accent)
                                                    .clickable { resumeMatch(m) },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    Icon(if (m.status == "Finished") Icons.Default.BarChart else Icons.Default.PlayArrow, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                                                    Text(
                                                        if (m.status == "Finished") "VIEW PERFORMANCE" else "RESUME MATCH",
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Black,
                                                        color = Color.White,
                                                        letterSpacing = 2.sp
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "setup" -> LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        item {
                            Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("SETUP MATCH", fontSize = 32.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary)
                                Text("CONFIGURE PLAYERS & TOSS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                            }
                        }
                        item {
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(24.dp)) {
                                Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                    Column {
                                        Text("PLAYER A", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        Spacer(Modifier.height(8.dp))
                                        OutlinedTextField(value = playerA, onValueChange = { playerA = it }, placeholder = { Text("Enter Name", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                                    }
                                    Column {
                                        Text("PLAYER B", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        Spacer(Modifier.height(8.dp))
                                        OutlinedTextField(value = playerB, onValueChange = { playerB = it }, placeholder = { Text("Enter Name", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                                    }
                                }
                            }
                        }
                        
                        item {
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(24.dp)) {
                                Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                    Column {
                                        Text("SET FORMAT", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        Spacer(Modifier.height(12.dp))
                                        Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            listOf(2 to "BEST OF 3", 3 to "BEST OF 5").forEach { (valFormat, label) ->
                                                Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (setFormat == valFormat) theme.colors.accent else Color.Transparent).clickable { setFormat = valFormat }.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                                                    Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (setFormat == valFormat) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        item {
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(24.dp)) {
                                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text("TOSS SYSTEM", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        if (tossWinner == null) {
                                            Box(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFFD97706)).clickable { showToss = true; tossResult = null; isCoinSpinning = false }.padding(horizontal = 24.dp, vertical = 12.dp)) {
                                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                    Icon(Icons.Default.RotateLeft, null, tint = Color.White, modifier = Modifier.size(16.dp))
                                                    Text("SPIN COIN", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 1.sp)
                                                }
                                            }
                                        } else {
                                            IconButton(onClick = { tossWinner = null; optedTo = null }, modifier = Modifier.size(32.dp)) {
                                                Icon(Icons.Default.Refresh, null, tint = theme.colors.textDisabled)
                                            }
                                        }
                                    }

                                    if (tossWinner != null) {
                                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.success.copy(0.1f)).padding(16.dp), contentAlignment = Alignment.Center) {
                                                Text(buildAnnotatedString {
                                                    withStyle(SpanStyle(color = theme.colors.textDisabled, fontWeight = FontWeight.Black, fontSize = 9.sp)) { append("WINNER: ") }
                                                    withStyle(SpanStyle(color = theme.colors.success, fontWeight = FontWeight.Black, fontSize = 14.sp)) { append(if(tossWinner=="A") playerA.uppercase() else playerB.uppercase()) }
                                                })
                                            }
                                            
                                            Text("DECISION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                listOf("Serve", "Receive").forEach { choice ->
                                                    Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (optedTo == choice) theme.colors.accent else Color.Transparent).clickable { optedTo = choice }.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                                                        Text(choice.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (optedTo == choice) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        Box(modifier = Modifier.fillMaxWidth().height(80.dp).clip(RoundedCornerShape(16.dp)).background(theme.colors.backgroundSecondary.copy(0.5f)).border(1.dp, theme.colors.border.copy(0.5f), RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                                            Text("TOSS PENDING", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        }
                                    }
                                }
                            }
                        }
                        
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                Button(onClick = { startMatch() }, modifier = Modifier.fillMaxWidth().height(64.dp).shadow(theme.elevation.elevated, RoundedCornerShape(20.dp)), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent), shape = RoundedCornerShape(20.dp)) {
                                    Icon(Icons.Default.PlayArrow, null, modifier = Modifier.size(24.dp))
                                    Spacer(Modifier.width(12.dp))
                                    Text("START MATCH", fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 4.sp)
                                }
                                TextButton(onClick = { view = "history" }, modifier = Modifier.fillMaxWidth()) {
                                    Text("CANCEL", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                }
                            }
                        }
                    }

                    "review" -> LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        item {
                            Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("MATCH SUMMARY", fontSize = 32.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary)
                                Text("FINAL STATISTICS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                            }
                        }
                        
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth().shadow(12.dp, RoundedCornerShape(24.dp)),
                                shape = RoundedCornerShape(24.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
                            ) {
                                Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text(playerA.uppercase(), fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
                                            Text(if (setsA > setsB) "WINNER" else "", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                        }
                                        Text("${setsA} - ${setsB}", fontSize = 48.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White, modifier = Modifier.padding(horizontal = 16.dp))
                                        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text(playerB.uppercase(), fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
                                            Text(if (setsB > setsA) "WINNER" else "", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                        }
                                    }
                                    
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                                        setHistory.forEachIndexed { i, set ->
                                            Column(modifier = Modifier.padding(horizontal = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text("S${i+1}", fontSize = 8.sp, color = Color.Gray, fontWeight = FontWeight.Black)
                                                Text("${set.first}-${set.second}", fontSize = 16.sp, color = Color.White, fontWeight = FontWeight.Black)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        item {
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(24.dp)) {
                                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Text("MATCH STATS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    listOf(
                                        "ACES" to (statsA.aces to statsB.aces),
                                        "WINNERS" to (statsA.winners to statsB.winners),
                                        "UNFORCED ERRORS" to (statsA.unforcedErrors to statsB.unforcedErrors),
                                        "DOUBLE FAULTS" to (statsA.doubleFaults to statsB.doubleFaults),
                                        "1ST SERVE %" to (
                                            (if (statsA.totalServes > 0) (statsA.firstServesIn * 100 / statsA.totalServes) else 0) to 
                                            (if (statsB.totalServes > 0) (statsB.firstServesIn * 100 / statsB.totalServes) else 0)
                                        )
                                    ).forEach { (label, values) ->
                                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                            Text(label, fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                                Text("${values.first}${if (label.contains("%")) "%" else ""}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
                                                Box(modifier = Modifier.weight(3f).height(8.dp).clip(CircleShape).background(theme.colors.backgroundSecondary)) {
                                                    val total = values.first + values.second
                                                    val ratio = if (total > 0) values.first.toFloat() / total else 0.5f
                                                    Box(modifier = Modifier.fillMaxHeight().fillMaxWidth(ratio).background(theme.colors.accent))
                                                }
                                                Text("${values.second}${if (label.contains("%")) "%" else ""}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, modifier = Modifier.weight(1f))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        item {
                            Button(onClick = { view = "history" }, modifier = Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary)) {
                                Text("DONE", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 2.sp)
                            }
                        }
                    }

                    else -> {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // MONITOR: The Professional Scoreboard
                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth().shadow(12.dp, RoundedCornerShape(24.dp)),
                                    shape = RoundedCornerShape(24.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
                                ) {
                                    Column(modifier = Modifier.padding(24.dp)) {
                                        // Header Strip
                                        Row(
                                            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color.Red))
                                                Text("LIVE MATCH", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 2.sp)
                                            }
                                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                    itemsIndexed(setHistory) { i, set ->
                                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                            Text("S${i+1}", fontSize = 6.sp, color = Color.Gray, fontWeight = FontWeight.Black)
                                                            Text("${set.first}-${set.second}", fontSize = 9.sp, color = Color.White, fontWeight = FontWeight.Black)
                                                        }
                                                    }
                                                }
                                                Column(horizontalAlignment = Alignment.End) {
                                                    Text("SETS", fontSize = 6.sp, fontWeight = FontWeight.Black, color = Color.Gray)
                                                    Text("$setsA - $setsB", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                                }
                                            }
                                        }

                                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                            val infiniteTransition = rememberInfiniteTransition(label = "ServerPulse")
                                            val pulseAlpha by infiniteTransition.animateFloat(initialValue = 1f, targetValue = 0.3f, animationSpec = infiniteRepeatable(animation = tween(800), repeatMode = RepeatMode.Reverse), label = "Pulse")

                                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    if (server == "A") Icon(Icons.Default.SportsTennis, null, tint = theme.colors.accent, modifier = Modifier.size(10.dp).alpha(pulseAlpha))
                                                    Text(playerA.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (server == "A") Color.White else Color.Gray, maxLines = 1)
                                                }
                                                Spacer(Modifier.height(8.dp))
                                                AnimatedContent(targetState = formatTennisPoints(pointsA, isAdA), label = "PointsA") {
                                                    Text(it, fontSize = 56.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White)
                                                }
                                            }
                                            Box(modifier = Modifier.padding(horizontal = 16.dp)) {
                                                Text("G: $gamesA-$gamesB", fontSize = 10.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.accent.copy(0.7f))
                                            }
                                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    if (server == "B") Icon(Icons.Default.SportsTennis, null, tint = theme.colors.accent, modifier = Modifier.size(10.dp).alpha(pulseAlpha))
                                                    Text(playerB.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (server == "B") Color.White else Color.Gray, maxLines = 1)
                                                }
                                                Spacer(Modifier.height(8.dp))
                                                AnimatedContent(targetState = formatTennisPoints(pointsB, isAdB), label = "PointsB") {
                                                    Text(it, fontSize = 56.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White)
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            if (currentMatch?.status == "Live") {
                                // TACTICAL CONTROLS
                                item {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        listOf("A" to playerA, "B" to playerB).forEach { (side, name) ->
                                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Button(
                                                    onClick = { handlePoint(side) },
                                                    modifier = Modifier.fillMaxWidth().height(80.dp),
                                                    shape = RoundedCornerShape(20.dp),
                                                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent)
                                                ) {
                                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                        Icon(Icons.Default.Add, null, modifier = Modifier.size(20.dp))
                                                        Text("POINT", fontSize = 10.sp, fontWeight = FontWeight.Black)
                                                    }
                                                }
                                                // Quick Stats Buttons
                                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    listOf("ace" to "ACE", "winner" to "WIN", "unforced" to "UE").forEach { (type, label) ->
                                                        Box(
                                                            modifier = Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(8.dp)).clickable { trackMetric(side, type); if(type=="ace") handlePoint(side) }.padding(vertical = 8.dp),
                                                            contentAlignment = Alignment.Center
                                                        ) {
                                                            Text(label, fontSize = 7.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                // SERVE METRICS
                                item {
                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(20.dp),
                                        colors = CardDefaults.cardColors(containerColor = theme.colors.card),
                                        border = BorderStroke(1.dp, theme.colors.border)
                                    ) {
                                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                                Text("SERVE TRACKING (${if(server=="A") playerA else playerB})", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                                Box(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(if(isSecondServe) theme.colors.error.copy(0.1f) else theme.colors.success.copy(0.1f)).padding(horizontal = 8.dp, vertical = 2.dp)) {
                                                    Text(if(isSecondServe) "2nd SERVE" else "1st SERVE", fontSize = 8.sp, fontWeight = FontWeight.Black, color = if(isSecondServe) theme.colors.error else theme.colors.success)
                                                }
                                            }
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                                Button(
                                                    onClick = { trackMetric(server, "serveIn") },
                                                    modifier = Modifier.weight(1f).height(44.dp),
                                                    shape = RoundedCornerShape(12.dp),
                                                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.success.copy(0.1f)),
                                                    border = BorderStroke(1.dp, theme.colors.success.copy(0.3f))
                                                ) {
                                                    Text("SERVE IN", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.success)
                                                }
                                                Button(
                                                    onClick = { trackMetric(server, "serveFault") },
                                                    modifier = Modifier.weight(1f).height(44.dp),
                                                    shape = RoundedCornerShape(12.dp),
                                                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.error.copy(0.1f)),
                                                    border = BorderStroke(1.dp, theme.colors.error.copy(0.3f))
                                                ) {
                                                    Text(if(isSecondServe) "DBL FAULT" else "FAULT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.error)
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                // LIVE STATS SUMMARY
                                item {
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.accent.copy(0.05f)).border(1.dp, theme.colors.accent.copy(0.1f), RoundedCornerShape(20.dp)).padding(16.dp)) {
                                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                                Text("LIVE DENSITY METRICS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                Text("${playerA.firstOrNull() ?: 'A'} VS ${playerB.firstOrNull() ?: 'B'}", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                            }
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    Text("ACES: ${statsA.aces} - ${statsB.aces}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                    Text("WINNERS: ${statsA.winners} - ${statsB.winners}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                    Text("DF: ${statsA.doubleFaults} - ${statsB.doubleFaults}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.error)
                                                }
                                                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    Text("UE: ${statsA.unforcedErrors} - ${statsB.unforcedErrors}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                    val s1a = if(statsA.totalServes > 0) "${statsA.firstServesIn * 100 / statsA.totalServes}%" else "0%"
                                                    val s1b = if(statsB.totalServes > 0) "${statsB.firstServesIn * 100 / statsB.totalServes}%" else "0%"
                                                    Text("1st SRV: $s1a - $s1b", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                                }
                                            }
                                        }
                                    }
                                }

                                item {
                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(20.dp),
                                        colors = CardDefaults.cardColors(containerColor = theme.colors.card),
                                        border = BorderStroke(1.dp, theme.colors.border)
                                    ) {
                                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Icon(Icons.Default.Settings, null, tint = theme.colors.accent, modifier = Modifier.size(14.dp))
                                                Text("MATCH COMMAND", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                            }
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Button(
                                                    onClick = { pointsA = 0; pointsB = 0; isAdA = false; isAdB = false; currentMatch?.let { persist(it.copy(pointsA = 0, pointsB = 0, isAdA = false, isAdB = false)) } },
                                                    modifier = Modifier.weight(1f).height(48.dp),
                                                    shape = RoundedCornerShape(12.dp),
                                                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.backgroundSecondary),
                                                    border = BorderStroke(1.dp, theme.colors.border)
                                                ) {
                                                    Text("RESET POINTS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                }
                                                Button(
                                                    onClick = { currentMatch?.let { m -> scope.launch { val fin = m.copy(status = "Finished", finishedAt = Instant.now().toString()); persist(fin); Storage.clearPageState(PAGE_ID); delay(1000); view = "review" } } },
                                                    modifier = Modifier.weight(1f).height(48.dp),
                                                    shape = RoundedCornerShape(12.dp),
                                                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.error.copy(0.1f)),
                                                    border = BorderStroke(1.dp, theme.colors.error.copy(0.3f))
                                                ) {
                                                    Text("END SESSION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.error)
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                item {
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(32.dp)).background(theme.colors.success.copy(0.1f)).border(1.dp, theme.colors.success.copy(0.2f), RoundedCornerShape(32.dp)).padding(40.dp), contentAlignment = Alignment.Center) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                            Icon(Icons.Default.CheckCircle, null, tint = theme.colors.success, modifier = Modifier.size(64.dp))
                                            Text(if (setsA > setsB) "${playerA.uppercase()} WINS" else "${playerB.uppercase()} WINS", fontSize = 24.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                            Text("OFFICIAL TERMINATION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.success, letterSpacing = 2.sp)
                                        }
                                    }
                                }
                                item {
                                    Button(
                                        onClick = { view = "history" },
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

                }
            }
        }
        if (showRating) RatingModal(matchId = currentMatch?.id ?: "TN-${System.currentTimeMillis()}", locationId = location.id, user = user, onClose = { showRating = false })
        
        // ── Coin toss modal ───────────────────────────────────────────────────
        if (showToss) {
            Dialog(onDismissRequest = { if (!isCoinSpinning) showToss = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
                Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.9f)), contentAlignment = Alignment.Center) {
                    val densityVal = LocalDensity.current.density
                    Column(
                        modifier = Modifier
                            .padding(32.dp)
                            .clip(RoundedCornerShape(28.dp))
                            .background(theme.colors.card)
                            .border(2.dp, theme.colors.border, RoundedCornerShape(28.dp))
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        Text("⚡ TENNIS TOSS ⚡", fontSize = 24.sp, fontWeight = FontWeight.Black, color = Color(0xFFF59E0B))

                        Box(
                            modifier = Modifier
                                .size(160.dp)
                                .graphicsLayer {
                                    rotationY = coinRotation
                                    cameraDistance = 12f * densityVal
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            val absRot = Math.abs(coinRotation % 360f)
                            val isFront = absRot < 90f || absRot > 270f
                            Box(
                                modifier = Modifier.fillMaxSize().graphicsLayer { alpha = if (isFront) 1f else 0f }.clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFFFBBF24), Color(0xFFD97706)))).border(8.dp, Color(0xFFFCD34D), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Default.Person, null, tint = Color(0xFF78350F), modifier = Modifier.size(40.dp))
                                    Text(playerA.ifBlank { "Player A" }.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF78350F), textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 8.dp))
                                }
                            }
                            Box(
                                modifier = Modifier.fillMaxSize().graphicsLayer { rotationY = 180f; alpha = if (!isFront) 1f else 0f }.clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFF3B82F6), Color(0xFF1D4ED8)))).border(8.dp, Color(0xFF60A5FA), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Default.Person, null, tint = Color.White, modifier = Modifier.size(40.dp))
                                    Text(playerB.ifBlank { "Player B" }.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 8.dp))
                                }
                            }
                        }

                        if (tossResult != null && tossResult != "flipping") {
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.success.copy(0.1f)).border(2.dp, theme.colors.success.copy(0.3f), RoundedCornerShape(20.dp)).padding(20.dp), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("WINNER", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.success, letterSpacing = 2.sp)
                                    Text(tossResult ?: "", fontSize = 28.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                }
                            }
                            
                            Text("DECIDE ON ACTION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                listOf("Serve", "Receive").forEach { choice ->
                                    Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (optedTo == choice) theme.colors.accent else Color.Transparent).clickable { optedTo = choice }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                                        Text(choice.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (optedTo == choice) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                    }
                                }
                            }
                        }
                        Button(onClick = { if (tossWinner != null && optedTo != null) showToss = false else handleTossAction() }, enabled = !isCoinSpinning, modifier = Modifier.fillMaxWidth().height(54.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary), shape = RoundedCornerShape(16.dp)) {
                            Text(if (isCoinSpinning) "SPINNING..." else if(tossWinner != null && optedTo != null) "CONFIRM" else "SPIN COIN", fontSize = 13.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 2.sp)
                        }
                        TextButton(onClick = { if (!isCoinSpinning) showToss = false }, modifier = Modifier.fillMaxWidth()) {
                            Text("CLOSE", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        }
                    }
                }
            }
        }
    }
}
