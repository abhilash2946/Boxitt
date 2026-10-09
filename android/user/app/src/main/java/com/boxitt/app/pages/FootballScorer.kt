package com.boxitt.app.pages

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.draw.blur
import androidx.compose.runtime.saveable.rememberSaveable
import coil.compose.AsyncImage
import com.boxitt.app.Location
import com.boxitt.app.User
import com.boxitt.app.components.RatingModal
import com.boxitt.app.components.ThemeSelector
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.postgrest.postgrest
import com.boxitt.app.services.handleError
import android.util.Log
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private const val FOOTBALL_KEY = "football_matches"

data class FootballPlayer(
    val name: String,
    val goals: Int = 0,
    val yellowCards: Int = 0,
    val redCards: Int = 0,
    val isSub: Boolean = false
)

data class FootballEvent(
    val time: String,
    val type: String,
    val team: String,
    val player: String,
    val detail: String = ""
)

data class FootballStats(
    val corners: Int = 0,
    val shotsOnTarget: Int = 0,
    val offsides: Int = 0
)

data class FootballMatch(
    val id: String, val locationId: String, val teamA: String, val teamB: String,
    val scoreA: Int = 0, val scoreB: Int = 0, val period: Int = 1,
    val status: String = "Live",
    val createdAt: String = java.time.Instant.now().toString(),
    val finishedAt: String? = null,
    val isExpired: Boolean = false,
    val sport: com.boxitt.app.SportType = com.boxitt.app.SportType.FOOTBALL,
    val teamAPlayers: List<FootballPlayer> = emptyList(),
    val teamBPlayers: List<FootballPlayer> = emptyList(),
    val events: List<FootballEvent> = emptyList(),
    val statsA: FootballStats = FootballStats(),
    val statsB: FootballStats = FootballStats(),
    val tossWinner: String? = null,
    val kickOffTeam: String? = null,
    val matchTimeSeconds: Int = 0,
    val startTime: String? = null,
    val endTime: String? = null
)

// ─── JSON Helpers ────────────────────────────────────────────────────────────

private fun FootballPlayer.toJson() = JSONObject().apply {
    put("name", name); put("goals", goals); put("yellowCards", yellowCards); put("redCards", redCards); put("isSub", isSub)
}
private fun JSONObject.toPlayer() = FootballPlayer(
    name = getString("name"), goals = optInt("goals"), yellowCards = optInt("yellowCards"), redCards = optInt("redCards"), isSub = optBoolean("isSub")
)

private fun FootballEvent.toJson() = JSONObject().apply {
    put("time", time); put("type", type); put("team", team); put("player", player); put("detail", detail)
}
private fun JSONObject.toEvent() = FootballEvent(
    time = getString("time"), type = getString("type"), team = getString("team"), player = getString("player"), detail = optString("detail")
)

private fun FootballStats.toJson() = JSONObject().apply {
    put("corners", corners); put("shotsOnTarget", shotsOnTarget); put("offsides", offsides)
}
private fun JSONObject.toStats() = FootballStats(
    corners = optInt("corners"), shotsOnTarget = optInt("shotsOnTarget"), offsides = optInt("offsides")
)

private fun FootballMatch.toJson() = JSONObject().apply {
    put("id", id); put("locationId", locationId); put("teamA", teamA); put("teamB", teamB)
    put("scoreA", scoreA); put("scoreB", scoreB); put("period", period); put("status", status)
    put("createdAt", createdAt); finishedAt?.let { put("finishedAt", it) }
    put("isExpired", isExpired); put("sport", sport.value)
    startTime?.let { put("startTime", it) }; endTime?.let { put("endTime", it) }
    put("teamAPlayers", JSONArray(teamAPlayers.map { it.toJson() }))
    put("teamBPlayers", JSONArray(teamBPlayers.map { it.toJson() }))
    put("events", JSONArray(events.map { it.toJson() }))
    put("statsA", statsA.toJson()); put("statsB", statsB.toJson())
    put("tossWinner", tossWinner); put("kickOffTeam", kickOffTeam)
    put("matchTimeSeconds", matchTimeSeconds)
}

private fun JSONObject.toFootballMatch(): FootballMatch {
    val st = if (has("startTime")) optString("startTime") else if (has("start_time")) optString("start_time") else null
    val et = if (has("endTime")) optString("endTime") else if (has("end_time")) optString("end_time") else null
    return FootballMatch(
        id = getString("id"), locationId = getString("locationId"), teamA = getString("teamA"), teamB = getString("teamB"),
        scoreA = optInt("scoreA"), scoreB = optInt("scoreB"), period = optInt("period", 1), status = optString("status", "Live"),
        createdAt = optString("createdAt", ""), finishedAt = if (has("finishedAt")) optString("finishedAt") else null,
        isExpired = optBoolean("isExpired", false),
        sport = com.boxitt.app.SportType.entries.find { it.value == optString("sport") } ?: com.boxitt.app.SportType.FOOTBALL,
        startTime = st, endTime = et,
        teamAPlayers = optJSONArray("teamAPlayers")?.let { arr -> (0 until arr.length()).map { arr.getJSONObject(it).toPlayer() } } ?: emptyList(),
        teamBPlayers = optJSONArray("teamBPlayers")?.let { arr -> (0 until arr.length()).map { arr.getJSONObject(it).toPlayer() } } ?: emptyList(),
    events = optJSONArray("events")?.let { arr -> (0 until arr.length()).map { arr.getJSONObject(it).toEvent() } } ?: emptyList(),
    statsA = optJSONObject("statsA")?.toStats() ?: FootballStats(),
    statsB = optJSONObject("statsB")?.toStats() ?: FootballStats(),
    tossWinner = optString("tossWinner", null),
    kickOffTeam = optString("kickOffTeam", null),
    matchTimeSeconds = optInt("matchTimeSeconds", 0)
)

private fun loadFootball(ctx: android.content.Context, locId: String): List<FootballMatch> {
    return try {
        val raw = ctx.getSharedPreferences("scorer", android.content.Context.MODE_PRIVATE).getString(FOOTBALL_KEY, null) ?: return emptyList()
        val arr = JSONArray(raw)
        (0 until arr.length()).map { arr.getJSONObject(it).toFootballMatch() }.filter { it.locationId == locId }
    } catch (e: Exception) {
        Log.e("FootballScorer", handleError(e).message)
        emptyList()
    }
}

private fun saveFootball(ctx: android.content.Context, match: FootballMatch) {
    try {
        val prefs = ctx.getSharedPreferences("scorer", android.content.Context.MODE_PRIVATE)
        val raw = prefs.getString(FOOTBALL_KEY, null)
        val all = if (raw != null) { val a = JSONArray(raw); (0 until a.length()).map { a.getJSONObject(it).toFootballMatch() }.toMutableList() } else mutableListOf()
        val idx = all.indexOfFirst { it.id == match.id }; if (idx != -1) all[idx] = match else all.add(0, match)
        val arr = JSONArray(); all.forEach { arr.put(it.toJson()) }
        prefs.edit().putString(FOOTBALL_KEY, arr.toString()).apply()
    } catch (e: Exception) {
        Log.e("FootballScorer", handleError(e).message)
    }
}

private fun savePageState(ctx: android.content.Context, pageId: String, state: JSONObject) {
    ctx.getSharedPreferences("page_state", android.content.Context.MODE_PRIVATE).edit().putString(pageId, state.toString()).apply()
}

private fun loadPageState(ctx: android.content.Context, pageId: String): JSONObject? {
    val raw = ctx.getSharedPreferences("page_state", android.content.Context.MODE_PRIVATE).getString(pageId, null) ?: return null
    return try { JSONObject(raw) } catch (e: Exception) { null }
}

private fun clearPageState(ctx: android.content.Context, pageId: String) {
    ctx.getSharedPreferences("page_state", android.content.Context.MODE_PRIVATE).edit().remove(pageId).apply()
}

@Composable
fun FootballScorer(
    location: Location, user: User,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null, onBack: (() -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val PAGE_ID = "football_scorer_${location.id}"

    val savedState = remember { loadPageState(context, PAGE_ID) }

    var matches by remember { mutableStateOf<List<FootballMatch>>(emptyList()) }
    var currentMatch by remember { mutableStateOf<FootballMatch?>(
        savedState?.optJSONObject("currentMatch")?.toFootballMatch()
    ) }
    var view by rememberSaveable { mutableStateOf(savedState?.optString("view", "history") ?: "history") }
    var teamA by rememberSaveable { mutableStateOf(savedState?.optString("teamA", "Team A") ?: "Team A") }
    var teamB by rememberSaveable { mutableStateOf(savedState?.optString("teamB", "Team B") ?: "Team B") }
    
    // Squads
    var teamASquad by remember { mutableStateOf<List<String>>(List(15) { "" }) }
    var teamBSquad by remember { mutableStateOf<List<String>>(List(15) { "" }) }
    
    // Toss
    var tossWinner by remember { mutableStateOf<String?>(null) }
    var kickOffTeam by remember { mutableStateOf<String?>(null) }
    var showToss by remember { mutableStateOf(false) }
    var isCoinSpinning by remember { mutableStateOf(false) }
    var coinTargetAngle by remember { mutableFloatStateOf(0f) }

    var showRating by remember { mutableStateOf(false) }
    var pendingAction by remember { mutableStateOf<Pair<String, String>?>(null) } // side to type

    LaunchedEffect(location.id) { matches = loadFootball(context, location.id) }

    // Match Timer
    var isTimerRunning by remember { mutableStateOf(false) }
    LaunchedEffect(isTimerRunning, view) {
        while (isTimerRunning && view == "live") {
            delay(1000)
            currentMatch?.let { m ->
                val updated = m.copy(matchTimeSeconds = m.matchTimeSeconds + 1)
                currentMatch = updated
                saveFootball(context, updated)
            }
        }
    }

    fun syncToSupabase(m: FootballMatch) {
        val isUuid = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE).matches(m.id)
        if (isUuid) {
            scope.launch {
                try {
                    val scoreA = m.goalsA.toString()
                    val scoreB = m.goalsB.toString()
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
                    Log.e("FootballScorer", "Failed to sync score to Supabase", e)
                }
            }
        }
    }

    fun persist(m: FootballMatch) {
        currentMatch = m
        saveFootball(context, m)
        matches = loadFootball(context, location.id)
        syncToSupabase(m)
    }

    fun formatMatchTime(totalSeconds: Int): String {
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return if (minutes < 45) {
            String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds)
        } else {
            val stoppage = minutes - 45
            String.format(Locale.getDefault(), "45:00+%d", stoppage)
        }
    }

    fun addEvent(type: String, team: String, playerName: String, detail: String = "") {
        currentMatch?.let { m ->
            val time = formatMatchTime(m.matchTimeSeconds)
            val newEvent = FootballEvent(time, type, team, playerName, detail)
            var newScoreA = m.scoreA
            var newScoreB = m.scoreB
            
            val updatedPlayersA = m.teamAPlayers.map { p ->
                if (team == "A" && p.name == playerName) {
                    when (type) {
                        "GOAL" -> { newScoreA++; p.copy(goals = p.goals + 1) }
                        "YELLOW" -> p.copy(yellowCards = p.yellowCards + 1)
                        "RED" -> p.copy(redCards = p.redCards + 1)
                        else -> p
                    }
                } else p
            }
            val updatedPlayersB = m.teamBPlayers.map { p ->
                if (team == "B" && p.name == playerName) {
                    when (type) {
                        "GOAL" -> { newScoreB++; p.copy(goals = p.goals + 1) }
                        "YELLOW" -> p.copy(yellowCards = p.yellowCards + 1)
                        "RED" -> p.copy(redCards = p.redCards + 1)
                        else -> p
                    }
                } else p
            }
            
            persist(m.copy(
                events = m.events + newEvent,
                scoreA = newScoreA,
                scoreB = newScoreB,
                teamAPlayers = updatedPlayersA,
                teamBPlayers = updatedPlayersB
            ))
        }
    }

    fun updateStat(side: String, stat: String) {
        currentMatch?.let { m ->
            val newStatsA = if (side == "A") {
                when (stat) {
                    "corner" -> m.statsA.copy(corners = m.statsA.corners + 1)
                    "shot" -> m.statsA.copy(shotsOnTarget = m.statsA.shotsOnTarget + 1)
                    "offside" -> m.statsA.copy(offsides = m.statsA.offsides + 1)
                    else -> m.statsA
                }
            } else m.statsA
            val newStatsB = if (side == "B") {
                when (stat) {
                    "corner" -> m.statsB.copy(corners = m.statsB.corners + 1)
                    "shot" -> m.statsB.copy(shotsOnTarget = m.statsB.shotsOnTarget + 1)
                    "offside" -> m.statsB.copy(offsides = m.statsB.offsides + 1)
                    else -> m.statsB
                }
            } else m.statsB
            persist(m.copy(statsA = newStatsA, statsB = newStatsB))
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        // Background Decor
        Box(modifier = Modifier.align(Alignment.TopStart).offset(x = (-100).dp, y = (-100).dp).size(400.dp).blur(120.dp).background(Brush.radialGradient(colors = listOf(theme.colors.accent.copy(alpha = 0.2f), Color.Transparent))))
        Box(modifier = Modifier.align(Alignment.BottomEnd).offset(x = 100.dp, y = 100.dp).size(400.dp).blur(120.dp).background(Brush.radialGradient(colors = listOf(theme.colors.success.copy(alpha = 0.2f), Color.Transparent))))

        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth().shadow(theme.elevation.card).background(theme.colors.card).border(1.dp, theme.colors.border).padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(modifier = Modifier.size(44.dp).shadow(theme.elevation.elevated, RoundedCornerShape(theme.radius.small)).clip(RoundedCornerShape(theme.radius.small)).background(theme.colors.accent).padding(8.dp), contentAlignment = Alignment.Center) {
                        AsyncImage(model = "file:///android_asset/public/logo.png", contentDescription = "Boxitt", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                    }
                    Column {
                        Text(text = buildAnnotatedString { append("BOXITT "); withStyle(SpanStyle(color = theme.colors.accent)) { append("FOOTBALL") } }, fontSize = 20.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, letterSpacing = (-0.5).sp)
                        Text(text = "LIVE SCOREBOARD", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp, modifier = Modifier.padding(top = 2.dp))
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    ThemeSelector()
                    if (view != "history") {
                        IconButton(onClick = { view = "history"; isTimerRunning = false }, modifier = Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))) {
                            Icon(Icons.Default.History, null, tint = theme.colors.textPrimary)
                        }
                    }
                    Box(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(theme.colors.textPrimary).clickable { onBack?.invoke() }.padding(horizontal = 16.dp, vertical = 10.dp)) {
                        Text(text = "EXIT", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 1.sp)
                    }
                }
            }

            AnimatedContent(targetState = view, transitionSpec = { (fadeIn(animationSpec = tween(400)) + slideInVertically(animationSpec = tween(400)) { it / 10 }).togetherWith(fadeOut(animationSpec = tween(400)) + slideOutVertically(animationSpec = tween(400)) { -it / 10 }) }, label = "ViewTransition") { v ->
                when (v) {
                    "history" -> LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        item {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                                Column {
                                    Text(location.name.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                                    Spacer(Modifier.height(8.dp))
                                    Row(modifier = Modifier.shadow(theme.elevation.card, RoundedCornerShape(theme.radius.large)).clip(RoundedCornerShape(theme.radius.large)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large)).padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Icon(Icons.Default.History, null, tint = theme.colors.accent, modifier = Modifier.size(14.dp))
                                        Text("MATCH HISTORY", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    }
                                }
                                Box(modifier = Modifier.shadow(theme.elevation.elevated, RoundedCornerShape(14.dp)).clip(RoundedCornerShape(14.dp)).background(theme.colors.accent).clickable { view = "setup" }.padding(horizontal = 20.dp, vertical = 12.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(18.dp))
                                        Text("NEW MATCH", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 1.sp)
                                    }
                                }
                            }
                        }
                        if (matches.isEmpty()) {
                            item {
                                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(theme.radius.large)).background(theme.colors.backgroundSecondary).border(2.dp, theme.colors.border, RoundedCornerShape(theme.radius.large)).padding(60.dp), contentAlignment = Alignment.Center) {
                                    Text("NO MATCH RECORDS FOUND", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                }
                            }
                        } else {
                            itemsIndexed(matches) { _, m ->
                                Box(modifier = Modifier.fillMaxWidth().shadow(theme.elevation.card, RoundedCornerShape(theme.radius.large)).clip(RoundedCornerShape(theme.radius.large)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large)).padding(20.dp).clickable { currentMatch = m; view = "review" }) {
                                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
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
                                            Box(modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(if (m.status == "Live") theme.colors.accent else theme.colors.textPrimary).padding(horizontal = 12.dp, vertical = 6.dp)) {
                                                Text(m.status.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (m.status == "Live") Color.White else theme.colors.background, letterSpacing = 1.sp)
                                            }
                                        }
                                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(m.teamA.uppercase(), fontSize = 14.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                                Text("${m.scoreA}", fontSize = 32.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                            }
                                            Box(modifier = Modifier.size(32.dp).shadow(theme.elevation.card, CircleShape).clip(CircleShape).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, CircleShape), contentAlignment = Alignment.Center) {
                                                Text("VS", fontSize = 8.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textDisabled)
                                            }
                                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(m.teamB.uppercase(), fontSize = 14.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                                Text("${m.scoreB}", fontSize = 32.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                            }
                                        }
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(48.dp)
                                                    .clip(RoundedCornerShape(theme.radius.medium))
                                                    .background(theme.colors.backgroundSecondary)
                                                    .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.medium))
                                                    .clickable { currentMatch = m; view = "setup" },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(Icons.Default.Edit, contentDescription = "Edit Setup", tint = theme.colors.textSecondary, modifier = Modifier.size(18.dp))
                                            }

                                            Box(
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .height(48.dp)
                                                    .shadow(theme.elevation.elevated, RoundedCornerShape(theme.radius.medium))
                                                    .clip(RoundedCornerShape(theme.radius.medium))
                                                    .background(if (m.status == "Finished") theme.colors.accent else theme.colors.textPrimary)
                                                    .clickable { currentMatch = m; isTimerRunning = (m.status != "Finished"); view = "live" },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    Icon(if (m.status == "Finished") Icons.Default.BarChart else Icons.Default.PlayArrow, contentDescription = null, tint = if (m.status == "Finished") Color.White else theme.colors.background, modifier = Modifier.size(16.dp))
                                                    Text(
                                                        if (m.status == "Finished") "VIEW PERFORMANCE" else "RESUME MATCH",
                                                        fontSize = 11.sp,
                                                        fontWeight = FontWeight.Black,
                                                        color = if (m.status == "Finished") Color.White else theme.colors.background,
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
                    "setup" -> Column(modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        Text(text = buildAnnotatedString { append("MATCH "); withStyle(SpanStyle(color = theme.colors.accent)) { append("SETUP") } }, fontSize = 32.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary)
                        
                        // Team Names
                        Card(colors = CardDefaults.cardColors(containerColor = theme.colors.card), border = BorderStroke(1.dp, theme.colors.border), shape = RoundedCornerShape(20.dp)) {
                            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                Text("TEAM NAMES", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                OutlinedTextField(value = teamA, onValueChange = { teamA = it }, label = { Text("Home Team") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                                OutlinedTextField(value = teamB, onValueChange = { teamB = it }, label = { Text("Away Team") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                            }
                        }

                        // Toss System
                        Card(colors = CardDefaults.cardColors(containerColor = theme.colors.card), border = BorderStroke(1.dp, theme.colors.border), shape = RoundedCornerShape(20.dp)) {
                            Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                Text("TOSS TO DECIDE KICK-OFF", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                
                                val coinRotation by animateFloatAsState(targetValue = coinTargetAngle, animationSpec = tween(2000, easing = FastOutSlowInEasing), label = "coin")
                                
                                Box(modifier = Modifier.size(80.dp).graphicsLayer { rotationY = coinRotation }.shadow(8.dp, CircleShape).clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFFFFD700), Color(0xFFFFA500)))).clickable(enabled = !isCoinSpinning) {
                                    isCoinSpinning = true
                                    val winner = if (java.util.Random().nextBoolean()) teamA else teamB
                                    coinTargetAngle += 1800f + (if (winner == teamA) 0f else 180f)
                                    scope.launch {
                                        delay(2000)
                                        tossWinner = winner
                                        kickOffTeam = winner
                                        isCoinSpinning = false
                                        onAlert?.invoke("$winner won the toss!", "success", null)
                                    }
                                }, contentAlignment = Alignment.Center) {
                                    Text(if (coinRotation % 360f < 90f || coinRotation % 360f > 270f) "H" else "A", fontSize = 28.sp, fontWeight = FontWeight.Black, color = Color.White)
                                }
                                
                                tossWinner?.let {
                                    Text("Winner: $it", fontWeight = FontWeight.Bold, color = theme.colors.success)
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(onClick = { kickOffTeam = teamA }, colors = ButtonDefaults.buttonColors(containerColor = if(kickOffTeam == teamA) theme.colors.accent else theme.colors.backgroundSecondary)) {
                                            Text(teamA, color = if(kickOffTeam == teamA) Color.White else theme.colors.textPrimary)
                                        }
                                        Button(onClick = { kickOffTeam = teamB }, colors = ButtonDefaults.buttonColors(containerColor = if(kickOffTeam == teamB) theme.colors.accent else theme.colors.backgroundSecondary)) {
                                            Text(teamB, color = if(kickOffTeam == teamB) Color.White else theme.colors.textPrimary)
                                        }
                                    }
                                }
                            }
                        }

                        // Squad Naming
                        Card(colors = CardDefaults.cardColors(containerColor = theme.colors.card), border = BorderStroke(1.dp, theme.colors.border), shape = RoundedCornerShape(20.dp)) {
                            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text("SQUAD REGISTRATION (11 PLAYERS + SUBS)", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                listOf("Home" to teamASquad, "Away" to teamBSquad).forEach { (side, squad) ->
                                    Text(if(side == "Home") teamA else teamB, fontWeight = FontWeight.Bold)
                                    squad.take(11).forEachIndexed { i, name ->
                                        OutlinedTextField(value = name, onValueChange = { n -> if(side == "Home") teamASquad = teamASquad.toMutableList().also{it[i]=n} else teamBSquad = teamBSquad.toMutableList().also{it[i]=n} }, placeholder = { Text("Player ${i+1}") }, modifier = Modifier.fillMaxWidth(), textStyle = TextStyle(fontSize = 12.sp))
                                    }
                                }
                            }
                        }

                        Button(
                            onClick = {
                                if (teamA.isBlank() || teamB.isBlank()) { onAlert?.invoke("Enter team names", "error", null); return@Button }
                                if (kickOffTeam == null) { onAlert?.invoke("Perform toss to decide kick-off", "error", null); return@Button }
                                
                                val playersA = teamASquad.filter { it.isNotBlank() }.mapIndexed { i, name -> FootballPlayer(name, isSub = i >= 11) }
                                val playersB = teamBSquad.filter { it.isNotBlank() }.mapIndexed { i, name -> FootballPlayer(name, isSub = i >= 11) }
                                
                                val m = FootballMatch(
                                    id = "FB-${System.currentTimeMillis()}", locationId = location.id, teamA = teamA, teamB = teamB,
                                    teamAPlayers = playersA, teamBPlayers = playersB, tossWinner = tossWinner, kickOffTeam = kickOffTeam
                                )
                                persist(m)
                                isTimerRunning = true
                                view = "live"
                            },
                            modifier = Modifier.fillMaxWidth().height(60.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                            shape = RoundedCornerShape(20.dp)
                        ) { Icon(Icons.Default.PlayArrow, null); Spacer(Modifier.width(8.dp)); Text("START MATCH", fontSize = 14.sp, fontWeight = FontWeight.Black) }
                    }
                    "live" -> Column(modifier = Modifier.fillMaxSize()) {
                        // BROADCAST HUD
                        Box(modifier = Modifier.fillMaxWidth().background(Color(0xFF020617)).padding(16.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                Column {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Text(teamA.take(3).uppercase(), fontWeight = FontWeight.Black, color = Color.White, fontSize = 24.sp)
                                        Text("${currentMatch?.scoreA ?: 0}", fontWeight = FontWeight.Black, color = theme.colors.accent, fontSize = 32.sp)
                                        Text("-", color = Color.Gray, fontSize = 24.sp)
                                        Text("${currentMatch?.scoreB ?: 0}", fontWeight = FontWeight.Black, color = theme.colors.accent, fontSize = 32.sp)
                                        Text(teamB.take(3).uppercase(), fontWeight = FontWeight.Black, color = Color.White, fontSize = 24.sp)
                                    }
                                    Text(if(currentMatch?.period == 1) "1ST HALF" else "2ND HALF", color = Color.Gray, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(formatMatchTime(currentMatch?.matchTimeSeconds ?: 0), fontWeight = FontWeight.Black, color = Color.White, fontSize = 28.sp)
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(if(isTimerRunning) Color.Red else Color.Gray))
                                        Spacer(Modifier.width(4.dp))
                                        Text(if(isTimerRunning) "LIVE" else "PAUSED", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
                                    }
                                }
                            }
                        }

                        // CONTROLS
                        LazyColumn(modifier = Modifier.weight(1f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            item {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(onClick = { isTimerRunning = !isTimerRunning }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = if(isTimerRunning) theme.colors.error else theme.colors.success)) {
                                        Icon(if(isTimerRunning) Icons.Default.Pause else Icons.Default.PlayArrow, null)
                                        Text(if(isTimerRunning) "PAUSE" else "START")
                                    }
                                    Button(onClick = { currentMatch?.let { m -> val np = if(m.period == 1) 2 else 1; persist(m.copy(period = np)) } }, modifier = Modifier.weight(1f)) {
                                        Text("SWITCH HALF")
                                    }
                                }
                            }
                            
                            // Metrics Row
                            item {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf("A" to teamA, "B" to teamB).forEach { (side, name) ->
                                        Card(modifier = Modifier.weight(1f), colors = CardDefaults.cardColors(containerColor = theme.colors.card)) {
                                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Text(name, fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 1)
                                                Button(onClick = { pendingAction = side to "GOAL" }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) { Text("GOAL", fontSize = 10.sp) }
                                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    Button(onClick = { pendingAction = side to "YELLOW" }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Color.Yellow, contentColor = Color.Black), contentPadding = PaddingValues(0.dp)) { Text("YC", fontSize = 10.sp) }
                                                    Button(onClick = { pendingAction = side to "RED" }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Color.Red), contentPadding = PaddingValues(0.dp)) { Text("RC", fontSize = 10.sp) }
                                                }
                                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    OutlinedButton(onClick = { updateStat(side, "corner") }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(0.dp)) { Text("COR", fontSize = 9.sp) }
                                                    OutlinedButton(onClick = { updateStat(side, "shot") }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(0.dp)) { Text("SOT", fontSize = 9.sp) }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Match Timeline
                            item {
                                Text("MATCH TIMELINE", fontWeight = FontWeight.Black, fontSize = 10.sp, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            }
                            items(currentMatch?.events?.reversed() ?: emptyList()) { event ->
                                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Text(event.time, fontWeight = FontWeight.Bold, color = theme.colors.accent, fontSize = 12.sp)
                                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(if(event.team == "A") theme.colors.accent else theme.colors.success))
                                    Column {
                                        Text(event.type, fontWeight = FontWeight.Black, fontSize = 10.sp)
                                        Text(event.player, fontSize = 12.sp)
                                    }
                                }
                            }
                            
                            item {
                                Button(onClick = {
                                    currentMatch?.let { m ->
                                        persist(m.copy(status = "Finished", finishedAt = java.time.Instant.now().toString()))
                                        isTimerRunning = false
                                        view = "review"
                                        scope.launch { delay(1000); showRating = true }
                                    }
                                }, modifier = Modifier.fillMaxWidth().height(50.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.error)) {
                                    Text("END MATCH", fontWeight = FontWeight.Black)
                                }
                            }
                        }
                    }
                    "review" -> Column(modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        Text("MATCH REVIEW", fontSize = 32.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic)
                        
                        // Final Score
                        Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))) {
                            Row(modifier = Modifier.padding(24.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround, verticalAlignment = Alignment.CenterVertically) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(teamA, color = Color.White, fontWeight = FontWeight.Bold)
                                    Text("${currentMatch?.scoreA ?: 0}", color = theme.colors.accent, fontSize = 48.sp, fontWeight = FontWeight.Black)
                                }
                                Text("FT", color = Color.Gray, fontWeight = FontWeight.Black)
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(teamB, color = Color.White, fontWeight = FontWeight.Bold)
                                    Text("${currentMatch?.scoreB ?: 0}", color = theme.colors.accent, fontSize = 48.sp, fontWeight = FontWeight.Black)
                                }
                            }
                        }

                        // Stats Comparison
                        Card(colors = CardDefaults.cardColors(containerColor = theme.colors.card)) {
                            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                Text("MATCH STATISTICS", fontWeight = FontWeight.Black, fontSize = 12.sp)
                                listOf("Shots on Target" to { m: FootballMatch -> "${m.statsA.shotsOnTarget} - ${m.statsB.shotsOnTarget}" }, "Corners" to { m: FootballMatch -> "${m.statsA.corners} - ${m.statsB.corners}" }, "Offsides" to { m: FootballMatch -> "${m.statsA.offsides} - ${m.statsB.offsides}" }).forEach { (label, statFn) ->
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text(label, color = Color.Gray, fontSize = 12.sp)
                                        Text(statFn(currentMatch!!), fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                        
                        // Timeline
                        Text("FULL TIMELINE", fontWeight = FontWeight.Black, fontSize = 12.sp)
                        currentMatch?.events?.forEach { event ->
                            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(event.time, fontWeight = FontWeight.Bold, color = theme.colors.accent)
                                Text("${event.type}: ${event.player}", fontSize = 14.sp)
                            }
                        }
                        
                        Button(onClick = { view = "history" }, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                            Text("BACK TO HISTORY")
                        }
                    }
                }
            }
        }
        if (showRating) RatingModal(matchId = currentMatch?.id ?: "FB-${System.currentTimeMillis()}", locationId = location.id, user = user, onClose = { showRating = false })
    }

    // Dialogs for player selection
    if (pendingAction != null) {
        val side = pendingAction!!.first
        val type = pendingAction!!.second
        val players = if(side == "A") currentMatch?.teamAPlayers else currentMatch?.teamBPlayers
        
        AlertDialog(
            onDismissRequest = { pendingAction = null },
            title = { Text("Select Player for $type") },
            text = {
                LazyColumn {
                    items(players ?: emptyList()) { p ->
                        Text(p.name, modifier = Modifier.fillMaxWidth().clickable { addEvent(type, side, p.name); pendingAction = null }.padding(16.dp))
                    }
                }
            },
            confirmButton = {}
        )
    }
}
