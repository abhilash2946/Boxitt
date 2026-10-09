package com.boxitt.app.pages

import androidx.compose.animation.*
import androidx.compose.animation.core.*
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.boxitt.app.Location
import com.boxitt.app.User
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.BookingService
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.postgrest.postgrest
import com.boxitt.app.theme.vw
import com.boxitt.app.theme.clamp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.TimeZone
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// ─── Data Models ───────────────────────────────────────────────────────────────

private const val CRICKET_KEY = "cricket_matches"

data class CricketBatsman(
    val name: String, val runs: Int = 0, val balls: Int = 0,
    val fours: Int = 0, val sixes: Int = 0, val isOut: Boolean = false
)

data class CricketBowler(
    val name: String, val overs: Int = 0, val maidens: Int = 0,
    val runs: Int = 0, val wickets: Int = 0
)

data class CricketExtras(
    val wides: Int = 0, val noBalls: Int = 0, val byes: Int = 0, val legByes: Int = 0
)

data class CricketInnings(
    val battingTeam: String,
    val runs: Int = 0, val wickets: Int = 0,
    val balls: Int = 0, val overs: Int = 0,
    val isFreeHit: Boolean = false,
    val isNoBallRunPending: Boolean = false,
    val extras: CricketExtras = CricketExtras(),
    val batsmen: List<CricketBatsman> = emptyList(),
    val bowlers: List<CricketBowler> = emptyList(),
    val strikerIdx: Int = 0, val nonStrikerIdx: Int = 1,
    val currentBowlerIdx: Int = 0,
    val ballByBall: List<String> = emptyList(),
    val nextBatsmanIdx: Int = 2
)

data class CricketMatch(
    val id: String, val locationId: String,
    val teamA: String, val teamB: String,
    val tossWinner: String, val optedTo: String,
    val overs: Int,
    val innings: List<CricketInnings> = emptyList(),
    val currentInningsIdx: Int = 0,
    val status: String = "Live",
    val createdAt: String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).format(Date()),
    val finishedAt: String? = null,
    val teamASize: Int = 11, val teamBSize: Int = 11,
    val teamAPlayers: List<String> = emptyList(),
    val teamBPlayers: List<String> = emptyList(),
    val isExpired: Boolean = false,
    val sport: String = "CRICKET",
    val startTime: String? = null,
    val endTime: String? = null
)

// ─── JSON helpers ────────────────────────────────────────────────────────────

private fun CricketBatsman.toJson() = JSONObject().apply { put("name",name);put("runs",runs);put("balls",balls);put("fours",fours);put("sixes",sixes);put("isOut",isOut) }
private fun JSONObject.toBatsman() = CricketBatsman(name=optString("name"),runs=optInt("runs"),balls=optInt("balls"),fours=optInt("fours"),sixes=optInt("sixes"),isOut=optBoolean("isOut"))
private fun CricketBowler.toJson() = JSONObject().apply { put("name",name);put("overs",overs);put("maidens",maidens);put("runs",runs);put("wickets",wickets) }
private fun JSONObject.toBowler() = CricketBowler(name=optString("name"),overs=optInt("overs"),maidens=optInt("maidens"),runs=optInt("runs"),wickets=optInt("wickets"))
private fun CricketExtras.toJson() = JSONObject().apply { put("wides",wides);put("noBalls",noBalls);put("byes",byes);put("legByes",legByes) }
private fun JSONObject.toExtras() = CricketExtras(wides=optInt("wides"),noBalls=optInt("noBalls"),byes=optInt("byes"),legByes=optInt("legByes"))

private fun CricketInnings.toJson() = JSONObject().apply {
    put("battingTeam",battingTeam);put("runs",runs);put("wickets",wickets);put("balls",balls);put("overs",overs)
    put("isFreeHit",isFreeHit);put("isNoBallRunPending",isNoBallRunPending);put("extras",extras.toJson())
    val bat=JSONArray();batsmen.forEach{bat.put(it.toJson())};put("batsmen",bat)
    val bow=JSONArray();bowlers.forEach{bow.put(it.toJson())};put("bowlers",bow)
    put("strikerIdx",strikerIdx);put("nonStrikerIdx",nonStrikerIdx);put("currentBowlerIdx",currentBowlerIdx)
    val bb=JSONArray();ballByBall.forEach{bb.put(it)};put("ballByBall",bb)
    put("nextBatsmanIdx",nextBatsmanIdx)
}
private fun JSONObject.toInnings(): CricketInnings {
    val bat=optJSONArray("batsmen")?.let{(0 until it.length()).map{i->it.getJSONObject(i).toBatsman()}}?: emptyList()
    val bow=optJSONArray("bowlers")?.let{(0 until it.length()).map{i->it.getJSONObject(i).toBowler()}}?: emptyList()
    val bb=optJSONArray("ballByBall")?.let{(0 until it.length()).map{i->it.getString(i)}}?: emptyList()
    return CricketInnings(battingTeam=optString("battingTeam"),runs=optInt("runs"),wickets=optInt("wickets"),balls=optInt("balls"),overs=optInt("overs"),isFreeHit=optBoolean("isFreeHit"),isNoBallRunPending=optBoolean("isNoBallRunPending"),extras=optJSONObject("extras")?.toExtras()?:CricketExtras(),batsmen=bat,bowlers=bow,strikerIdx=optInt("strikerIdx"),nonStrikerIdx=optInt("nonStrikerIdx",1),currentBowlerIdx=optInt("currentBowlerIdx"),ballByBall=bb,nextBatsmanIdx=optInt("nextBatsmanIdx",2))
}

private fun CricketMatch.toJson() = JSONObject().apply {
    put("id",id);put("locationId",locationId);put("teamA",teamA);put("teamB",teamB);put("tossWinner",tossWinner);put("optedTo",optedTo);put("overs",overs)
    val inn=JSONArray();innings.forEach{inn.put(it.toJson())};put("innings",inn)
    put("currentInningsIdx",currentInningsIdx);put("status",status);put("createdAt",createdAt);finishedAt?.let{put("finishedAt",it)}
    put("teamASize",teamASize);put("teamBSize",teamBSize);put("isExpired",isExpired);put("sport",sport)
    startTime?.let { put("startTime", it) }; endTime?.let { put("endTime", it) }
    val ap=JSONArray();teamAPlayers.forEach{ap.put(it)};put("teamAPlayers",ap)
    val bp=JSONArray();teamBPlayers.forEach{bp.put(it)};put("teamBPlayers",bp)
}
private fun JSONObject.toCricketMatch(): CricketMatch {
    val inn=optJSONArray("innings")?.let{(0 until it.length()).map{i->it.getJSONObject(i).toInnings()}}?: emptyList()
    val ap=optJSONArray("teamAPlayers")?.let{(0 until it.length()).map{i->it.getString(i)}}?: emptyList()
    val bp=optJSONArray("teamBPlayers")?.let{(0 until it.length()).map{i->it.getString(i)}}?: emptyList()
    val st = if (has("startTime")) optString("startTime") else if (has("start_time")) optString("start_time") else null
    val et = if (has("endTime")) optString("endTime") else if (has("end_time")) optString("end_time") else null
    return CricketMatch(id=getString("id"),locationId=getString("locationId"),teamA=getString("teamA"),teamB=getString("teamB"),tossWinner=optString("tossWinner",""),optedTo=optString("optedTo","Bat"),overs=optInt("overs",16),innings=inn,currentInningsIdx=optInt("currentInningsIdx"),status=optString("status","Live"),createdAt=optString("createdAt",""),finishedAt=if(has("finishedAt"))optString("finishedAt") else null,teamASize=optInt("teamASize",11),teamBSize=optInt("teamBSize",11),teamAPlayers=ap,teamBPlayers=bp,isExpired=optBoolean("isExpired"),sport=optString("sport","CRICKET"),startTime=st,endTime=et)
}

private fun loadCricket(ctx: android.content.Context, locId: String): List<CricketMatch> {
    return try {
        val raw = ctx.getSharedPreferences("scorer", android.content.Context.MODE_PRIVATE).getString(CRICKET_KEY, null) ?: return emptyList()
        val arr = JSONArray(raw)
        (0 until arr.length()).map { arr.getJSONObject(it).toCricketMatch() }.filter { it.locationId == locId }
    } catch (e: Exception) { emptyList() }
}

private fun saveCricketMatch(ctx: android.content.Context, match: CricketMatch) {
    try {
        val prefs = ctx.getSharedPreferences("scorer", android.content.Context.MODE_PRIVATE)
        val raw = prefs.getString(CRICKET_KEY, null)
        val all = if (raw != null) { val a = JSONArray(raw); (0 until a.length()).map { a.getJSONObject(it).toCricketMatch() }.toMutableList() } else mutableListOf()
        val idx = all.indexOfFirst { it.id == match.id }; if (idx != -1) all[idx] = match else all.add(0, match)
        val arr = JSONArray(); all.forEach { arr.put(it.toJson()) }
        prefs.edit().putString(CRICKET_KEY, arr.toString()).apply()
    } catch (e: Exception) { }
}

// ─── Helper functions ─────────────────────────────────────────────────────────

private fun getWickets(innings: CricketInnings) = innings.batsmen.count { it.isOut }

private fun now() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).format(Date())

private fun makeDefaultInnings(battingTeam: String, players: List<String>): CricketInnings = CricketInnings(
    battingTeam = battingTeam,
    batsmen = players.map { CricketBatsman(name = it) },
    bowlers = listOf(CricketBowler(name = "Bowler 1")),
    nextBatsmanIdx = 2
)

// ─── Ball label helpers ───────────────────────────────────────────────────────

@Composable
private fun BallBadge(ball: String, theme: com.boxitt.app.theme.AppTheme) {
    val isWicket = ball == "W" || ball == "FH-W"
    val isExtra = ball.startsWith("WD") || ball.startsWith("NB")
    
    val bgColor = when {
        isWicket -> Color(0xFFDC2626)
        isExtra -> Color(0xFFF59E0B)
        else -> theme.colors.backgroundSecondary
    }
    val textColor = when {
        isWicket -> Color.White
        isExtra -> Color(0xFF0F172A)
        else -> theme.colors.textPrimary
    }
    val borderColor = if (isWicket) Color(0xFFEF4444) else theme.colors.border

    Box(
        modifier = Modifier
            .size(52.dp)
            .clip(CircleShape)
            .background(bgColor)
            .border(2.dp, borderColor, CircleShape)
            .shadow(4.dp, CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = ball,
            fontSize = 14.sp,
            fontWeight = FontWeight.Black,
            color = textColor,
            textAlign = TextAlign.Center
        )
    }
}

// ─── Main Composable ──────────────────────────────────────────────────────────

@Composable
fun CricketScorer(
    location: Location, user: User,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onBack: (() -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current

    // Match state
    var matches by remember { mutableStateOf<List<CricketMatch>>(emptyList()) }
    var currentMatch by remember { mutableStateOf<CricketMatch?>(null) }
    var view by remember { mutableStateOf("history") } // history | setup | live | review

    // Setup fields
    var hostTeam by remember { mutableStateOf("") }
    var visitorTeam by remember { mutableStateOf("") }
    var tossWinner by remember { mutableStateOf<String?>(null) }  // "host" | "visitor"
    var optedTo by remember { mutableStateOf("Bat") }
    var overs by remember { mutableStateOf("16") }
    var hostTeamSize by remember { mutableStateOf("11") }
    var visitorTeamSize by remember { mutableStateOf("11") }
    var namingMode by remember { mutableStateOf("default") }
    var hostPlayerNames by remember { mutableStateOf<List<String>>(emptyList()) }
    var visitorPlayerNames by remember { mutableStateOf<List<String>>(emptyList()) }

    // State & Persistence (Matching Web)
    val PAGE_ID = "cricket_scorer_${location.id}"
    LaunchedEffect(Unit) {
        val prefs = context.getSharedPreferences("page_state", android.content.Context.MODE_PRIVATE)
        val saved = prefs.getString(PAGE_ID, null)
        if (saved != null) {
            try {
                val json = JSONObject(saved)
                hostTeam = json.optString("hostTeam", "")
                visitorTeam = json.optString("visitorTeam", "")
                tossWinner = if (json.has("tossWinner")) json.getString("tossWinner") else null
                optedTo = json.optString("optedTo", "Bat")
                overs = json.optString("overs", "16")
                hostTeamSize = json.optString("hostTeamSize", "11")
                visitorTeamSize = json.optString("visitorTeamSize", "11")
                namingMode = json.optString("namingMode", "default")
                
                val hp = json.optJSONArray("hostPlayerNames")
                if (hp != null) hostPlayerNames = (0 until hp.length()).map { hp.getString(it) }
                val vp = json.optJSONArray("visitorPlayerNames")
                if (vp != null) visitorPlayerNames = (0 until vp.length()).map { vp.getString(it) }
                
                if (json.has("currentMatch")) {
                    currentMatch = json.getJSONObject("currentMatch").toCricketMatch()
                }
                
                view = json.optString("view", "history")
            } catch (e: Exception) {}
        }
    }

    LaunchedEffect(hostTeam, visitorTeam, tossWinner, optedTo, overs, hostTeamSize, visitorTeamSize, namingMode, hostPlayerNames, visitorPlayerNames, view, currentMatch) {
        val json = JSONObject().apply {
            put("hostTeam", hostTeam); put("visitorTeam", visitorTeam)
            tossWinner?.let { put("tossWinner", it) }
            put("optedTo", optedTo); put("overs", overs)
            put("hostTeamSize", hostTeamSize); put("visitorTeamSize", visitorTeamSize)
            put("namingMode", namingMode); put("view", view)
            put("hostPlayerNames", JSONArray(hostPlayerNames))
            put("visitorPlayerNames", JSONArray(visitorPlayerNames))
            currentMatch?.let { put("currentMatch", it.toJson()) }
        }
        context.getSharedPreferences("page_state", android.content.Context.MODE_PRIVATE).edit().putString(PAGE_ID, json.toString()).apply()
    }

    // Toss modal
    var showToss by remember { mutableStateOf(false) }
    var showHistoryModal by remember { mutableStateOf(false) }
    var showScorecardModal by remember { mutableStateOf(false) }
    var tossResult by remember { mutableStateOf<String?>(null) }  // null | "flipping" | winner name
    var isCoinSpinning by remember { mutableStateOf(false) }
    var coinSpinDuration by remember { mutableLongStateOf(2600L) }
    var coinTargetAngle by remember { mutableFloatStateOf(0f) }

    val coinRotation by animateFloatAsState(
        targetValue = coinTargetAngle,
        animationSpec = tween(durationMillis = coinSpinDuration.toInt(), easing = FastOutSlowInEasing),
        label = "coin"
    )

    // Popups
    var showInningsEndPopup by remember { mutableStateOf(false) }
    var showEndConfirm by remember { mutableStateOf<String?>(null) }  // "innings" | "match"

    // Load matches and cleanup logic (Matching Web)
    LaunchedEffect(location.id) {
        scope.launch {
            try {
                BookingService.getBookings(location.id)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        
        val allMatches = loadCricket(context, location.id)
        
        // Match cleanup logic (Matching Web)
        val RETENTION_PERIOD_MS = 24 * 60 * 60 * 1000L
        val now = System.currentTimeMillis()
        var hasChanges = false
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        
        val cleaned = allMatches.map { match ->
            if (match.status == "Finished" && match.finishedAt != null && match.isExpired != true) {
                try {
                    val finishTime = sdf.parse(match.finishedAt)?.time ?: 0L
                    if (now - finishTime >= RETENTION_PERIOD_MS) {
                        hasChanges = true
                        return@map match.copy(isExpired = true, innings = emptyList())
                    }
                } catch (e: Exception) { e.printStackTrace() }
            }
            match
        }
        
        if (hasChanges) {
            cleaned.forEach { if (it.locationId == location.id) saveCricketMatch(context, it) }
        }
        
        matches = cleaned
    }

    // Sync hostPlayerNames size
    LaunchedEffect(hostTeamSize) {
        val size = hostTeamSize.toIntOrNull() ?: 0
        hostPlayerNames = List(size) { i -> hostPlayerNames.getOrElse(i) { "" } }
    }
    LaunchedEffect(visitorTeamSize) {
        val size = visitorTeamSize.toIntOrNull() ?: 0
        visitorPlayerNames = List(size) { i -> visitorPlayerNames.getOrElse(i) { "" } }
    }

    fun syncToSupabase(m: CricketMatch) {
        val isUuid = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE).matches(m.id)
        if (isUuid) {
            scope.launch {
                try {
                    val scoreA = if (m.gamesWonA != null && m.bestOf != null && m.bestOf > 1) {
                        m.gamesWonA.toString()
                    } else {
                        m.innings.getOrNull(0)?.runs?.toString() ?: "0"
                    }
                    val scoreB = if (m.gamesWonB != null && m.bestOf != null && m.bestOf > 1) {
                        m.gamesWonB.toString()
                    } else {
                        m.innings.getOrNull(1)?.runs?.toString() ?: "0"
                    }
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
                    android.util.Log.e("CricketScorer", "Failed to sync score to Supabase", e)
                }
            }
        }
    }

    fun persist(m: CricketMatch) {
        currentMatch = m
        saveCricketMatch(context, m)
        matches = loadCricket(context, location.id)
        syncToSupabase(m)
    }

    fun triggerAlert(msg: String, type: String = "info") { onAlert?.invoke(msg, type, null) }

    fun resetSetup() {
        hostTeam = ""; visitorTeam = ""; tossWinner = null; optedTo = "Bat"
        overs = "16"; hostTeamSize = "11"; visitorTeamSize = "11"; namingMode = "default"
        hostPlayerNames = emptyList(); visitorPlayerNames = emptyList(); tossResult = null
    }

    fun handleToss() {
        if (isCoinSpinning) return
        isCoinSpinning = true
        tossResult = "flipping"
        
        // Physically modeled toss (Mirror Web) using secure random
        val secureRandom = java.security.SecureRandom()
        val isHostWinner = secureRandom.nextBoolean()
        val winner = if (isHostWinner) "host" else "visitor"
        
        val extraRotations = 7 + secureRandom.nextInt(8) // 7 to 15 full rotations
        val landingFaceAngle = if (isHostWinner) 0f else 180f
        coinSpinDuration = 2800L + (secureRandom.nextDouble() * 800L).toLong()
        coinTargetAngle += extraRotations * 360f + landingFaceAngle - (coinTargetAngle % 360f)

        scope.launch {
            delay(coinSpinDuration)
            tossWinner = winner
            tossResult = if (winner == "host") (hostTeam.ifBlank { "Host" }) else (visitorTeam.ifBlank { "Visitor" })
            isCoinSpinning = false
        }
    }

    val currentInnings = currentMatch?.innings?.getOrNull(currentMatch!!.currentInningsIdx)

    fun groupBallsIntoOvers(balls: List<String>): List<List<String>> {
        val overs = mutableListOf<List<String>>()
        var currentOver = mutableListOf<String>()
        var legalBallsInOver = 0

        balls.forEach { ball ->
            currentOver.add(ball)
            if (!ball.contains("WD") && !ball.contains("NB")) {
                legalBallsInOver++
            }
            if (legalBallsInOver == 6) {
                overs.add(currentOver)
                currentOver = mutableListOf()
                legalBallsInOver = 0
            }
        }
        if (currentOver.isNotEmpty()) {
            overs.add(currentOver)
        }
        return overs
    }

    fun checkCompletion(updated: CricketMatch) {
        val inn = updated.innings[updated.currentInningsIdx]
        val battingSize = if (inn.battingTeam == updated.teamA) updated.teamASize else updated.teamBSize
        val isTargetReached = updated.currentInningsIdx == 1 && updated.innings.size > 1 && inn.runs > updated.innings[0].runs
        val isAllOut = getWickets(inn) >= battingSize - 1
        val isOversFinished = inn.overs >= updated.overs
        persist(updated)
        if (isTargetReached || isAllOut || isOversFinished) {
            scope.launch {
                delay(500)
                showInningsEndPopup = true
                delay(2500)
                // finalizeInnings
                val m = currentMatch ?: return@launch
                var newMatch = m
                if (newMatch.currentInningsIdx == 0) {
                    val bowlingTeam = if (newMatch.teamA == newMatch.innings[0].battingTeam) newMatch.teamB else newMatch.teamA
                    val players = if (bowlingTeam == newMatch.teamA) newMatch.teamAPlayers else newMatch.teamBPlayers
                    newMatch = newMatch.copy(currentInningsIdx = 1, innings = newMatch.innings + listOf(makeDefaultInnings(bowlingTeam, players)))
                } else {
                    newMatch = newMatch.copy(status = "Finished", finishedAt = now())
                }
                persist(newMatch)
                showInningsEndPopup = false
                showEndConfirm = null
            }
        }
    }

    fun handleRun(runValue: Int) {
        val m = currentMatch ?: return
        if (m.status == "Finished") return
        var inn = m.innings[m.currentInningsIdx]
        inn = if (inn.isNoBallRunPending) {
            val batsmen = inn.batsmen.toMutableList()
            batsmen[inn.strikerIdx] = batsmen[inn.strikerIdx].let { it.copy(runs = it.runs + runValue, fours = it.fours + if (runValue == 4) 1 else 0, sixes = it.sixes + if (runValue == 6) 1 else 0) }
            val newStriker = if (runValue % 2 == 1) inn.nonStrikerIdx else inn.strikerIdx
            val newNon = if (runValue % 2 == 1) inn.strikerIdx else inn.nonStrikerIdx
            inn.copy(runs = inn.runs + runValue, batsmen = batsmen, isNoBallRunPending = false, strikerIdx = newStriker, nonStrikerIdx = newNon, ballByBall = inn.ballByBall + "NB+$runValue")
        } else {
            val batsmen = inn.batsmen.toMutableList()
            batsmen[inn.strikerIdx] = batsmen[inn.strikerIdx].let { it.copy(runs = it.runs + runValue, balls = it.balls + 1, fours = it.fours + if (runValue == 4) 1 else 0, sixes = it.sixes + if (runValue == 6) 1 else 0) }
            var newStriker = if (runValue % 2 == 1) inn.nonStrikerIdx else inn.strikerIdx
            var newNon = if (runValue % 2 == 1) inn.strikerIdx else inn.nonStrikerIdx
            var newBalls = inn.balls + 1
            var newOvers = inn.overs
            val ball = if (runValue == 0) "-" else runValue.toString()
            if (newBalls == 6) { newOvers += 1; newBalls = 0; val tmp = newStriker; newStriker = newNon; newNon = tmp }
            inn.copy(runs = inn.runs + runValue, batsmen = batsmen, balls = newBalls, overs = newOvers, strikerIdx = newStriker, nonStrikerIdx = newNon, isFreeHit = false, ballByBall = inn.ballByBall + ball)
        }
        val updated = m.copy(innings = m.innings.toMutableList().also { it[m.currentInningsIdx] = inn })
        checkCompletion(updated)
    }

    fun handleWicket() {
        val m = currentMatch ?: return
        if (m.status == "Finished") return
        var inn = m.innings[m.currentInningsIdx]
        inn = if (inn.isFreeHit) {
            var newBalls = inn.balls + 1; var newOvers = inn.overs
            if (newBalls == 6) { newOvers += 1; newBalls = 0 }
            inn.copy(balls = newBalls, overs = newOvers, isFreeHit = false, ballByBall = inn.ballByBall + "FH-W")
        } else {
            val batsmen = inn.batsmen.toMutableList()
            batsmen[inn.strikerIdx] = batsmen[inn.strikerIdx].copy(isOut = true, balls = batsmen[inn.strikerIdx].balls + 1)
            var newStriker = if (inn.nextBatsmanIdx < batsmen.size) inn.nextBatsmanIdx else inn.strikerIdx
            var newBalls = inn.balls + 1; var newOvers = inn.overs
            var newNon = inn.nonStrikerIdx
            if (newBalls == 6) { 
                newOvers += 1; newBalls = 0; 
                // Swap at end of over
                val tmp = newStriker; newStriker = newNon; newNon = tmp 
            }
            inn.copy(wickets = inn.wickets + 1, batsmen = batsmen, balls = newBalls, overs = newOvers, strikerIdx = newStriker, nonStrikerIdx = newNon, nextBatsmanIdx = inn.nextBatsmanIdx + 1, ballByBall = inn.ballByBall + "W")
        }
        val updated = m.copy(innings = m.innings.toMutableList().also { it[m.currentInningsIdx] = inn })
        checkCompletion(updated)
    }

    fun handleWide() {
        val m = currentMatch ?: return
        var inn = m.innings[m.currentInningsIdx]
        inn = inn.copy(runs = inn.runs + 1, extras = inn.extras.copy(wides = inn.extras.wides + 1), ballByBall = inn.ballByBall + "WD")
        val updated = m.copy(innings = m.innings.toMutableList().also { it[m.currentInningsIdx] = inn })
        checkCompletion(updated)
    }

    fun handleNoBall() {
        val m = currentMatch ?: return
        var inn = m.innings[m.currentInningsIdx]
        inn = inn.copy(runs = inn.runs + 1, extras = inn.extras.copy(noBalls = inn.extras.noBalls + 1), isFreeHit = true, isNoBallRunPending = true)
        persist(m.copy(innings = m.innings.toMutableList().also { it[m.currentInningsIdx] = inn }))
    }

    fun handleSwapEnd() {
        val m = currentMatch ?: return
        var inn = m.innings[m.currentInningsIdx]
        inn = inn.copy(strikerIdx = inn.nonStrikerIdx, nonStrikerIdx = inn.strikerIdx)
        persist(m.copy(innings = m.innings.toMutableList().also { it[m.currentInningsIdx] = inn }))
    }

    fun manualFinalizeInnings() {
        val m = currentMatch ?: return
        var newMatch = m
        if (newMatch.currentInningsIdx == 0) {
            val bowlingTeam = if (newMatch.teamA == newMatch.innings[0].battingTeam) newMatch.teamB else newMatch.teamA
            val players = if (bowlingTeam == newMatch.teamA) newMatch.teamAPlayers else newMatch.teamBPlayers
            newMatch = newMatch.copy(currentInningsIdx = 1, innings = newMatch.innings + listOf(makeDefaultInnings(bowlingTeam, players)))
        } else {
            newMatch = newMatch.copy(status = "Finished", finishedAt = now())
        }
        persist(newMatch); showEndConfirm = null
    }

    fun startMatch() {
        if (hostTeam.isBlank() || visitorTeam.isBlank()) { triggerAlert("Team names required", "error"); return }
        if (tossWinner == null) { triggerAlert("Please perform coin toss", "error"); return }
        val finalOvers = overs.toIntOrNull() ?: 0
        if (finalOvers < 1) { triggerAlert("Invalid overs", "error"); return }
        val finalHostSize = hostTeamSize.toIntOrNull() ?: 11
        val finalVisitorSize = visitorTeamSize.toIntOrNull() ?: 11
        val battingFirst = if ((tossWinner == "host" && optedTo == "Bat") || (tossWinner == "visitor" && optedTo == "Bowl")) hostTeam else visitorTeam
        fun getPlayers(size: Int, custom: List<String>) = if (namingMode == "custom") List(size) { i -> custom.getOrElse(i) { "" }.trim().ifBlank { "Player ${i + 1}" } } else List(size) { "Player ${it + 1}" }
        val hostPlayers = getPlayers(finalHostSize, hostPlayerNames)
        val visitorPlayers = getPlayers(finalVisitorSize, visitorPlayerNames)
        val battingPlayers = if (battingFirst == hostTeam) hostPlayers else visitorPlayers
        val newInnings = makeDefaultInnings(battingFirst, battingPlayers)
        val newMatch = CricketMatch(id = "MATCH-${System.currentTimeMillis()}", locationId = location.id, teamA = hostTeam, teamB = visitorTeam, tossWinner = if (tossWinner == "host") hostTeam else visitorTeam, optedTo = optedTo, overs = finalOvers, innings = listOf(newInnings), teamASize = finalHostSize, teamBSize = finalVisitorSize, teamAPlayers = hostPlayers, teamBPlayers = visitorPlayers)
        persist(newMatch); view = "live"
    }

    // ─── UI ──────────────────────────────────────────────────────────────────

    Box(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        // Background Decor (Matching Web)
        Box(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.offset(x = (-100).dp, y = (-100).dp).size(400.dp).blur(120.dp).background(theme.colors.success.copy(0.15f), CircleShape))
            Box(modifier = Modifier.align(Alignment.BottomEnd).offset(x = 100.dp, y = 100.dp).size(400.dp).blur(120.dp).background(theme.colors.accent.copy(0.15f), CircleShape))
        }

        Column(modifier = Modifier.fillMaxSize()) {
            // ── Header ───────────────────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(theme.elevation.elevated)
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border)
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(modifier = Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)).background(theme.colors.success).padding(8.dp), contentAlignment = Alignment.Center) {
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
                                append("Boxitt ")
                                withStyle(SpanStyle(color = theme.colors.success)) {
                                    append("Cricket")
                                }
                            },
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Black,
                            fontStyle = FontStyle.Italic,
                            color = theme.colors.textPrimary,
                            letterSpacing = (-1).sp
                        )
                        Text("LIVE SCOREBOARD", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (view == "live" || view == "review") {
                        IconButton(
                            onClick = { view = "history" },
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(theme.colors.backgroundSecondary)
                                .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                        ) {
                            Icon(Icons.Default.History, null, tint = theme.colors.textSecondary, modifier = Modifier.size(24.dp))
                        }
                    }
                    Box(
                        modifier = Modifier
                            .shadow(theme.elevation.elevated, RoundedCornerShape(12.dp))
                            .clip(RoundedCornerShape(12.dp))
                            .background(theme.colors.textPrimary)
                            .clickable { 
                                if (view == "live" || view == "review") view = "history" 
                                else onBack?.invoke() 
                            }
                            .padding(horizontal = 22.dp, vertical = 12.dp)
                    ) {
                        Text("EXIT", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 1.sp)
                    }
                }
            }

            // ── Page content ─────────────────────────────────────────────────
            AnimatedContent(targetState = view, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "ViewTransition") { v ->
                when (v) {

                    // ── History ─────────────────────────────────────────────
                    "history" -> LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        item {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                                Column {
                                    Text(location.name.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                                    Spacer(Modifier.height(8.dp))
                                    Row(modifier = Modifier.clip(RoundedCornerShape(50.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(50.dp)).padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Text("★ ${location.rating ?: 0.0}", color = Color(0xFFF59E0B), fontWeight = FontWeight.Black, fontSize = 14.sp)
                                        Box(modifier = Modifier.size(1.dp, 10.dp).background(theme.colors.border))
                                        Text("${location.ratingCount} REVIEWS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                    }
                                }
                                Box(
                                    modifier = Modifier
                                        .shadow(theme.elevation.elevated, RoundedCornerShape(16.dp))
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(theme.colors.success)
                                        .clickable { resetSetup(); view = "setup" }
                                        .padding(horizontal = 24.dp, vertical = 14.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Icon(Icons.Default.Add, null, tint = Color.White, modifier = Modifier.size(18.dp))
                                        Text("NEW MATCH", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 1.sp)
                                    }
                                }
                            }
                        }
                        if (matches.isEmpty()) {
                            item {
                                Box(modifier = Modifier.fillMaxWidth().height(240.dp).clip(RoundedCornerShape(28.dp)).background(theme.colors.backgroundSecondary).border(2.dp, theme.colors.border, RoundedCornerShape(28.dp)), contentAlignment = Alignment.Center) {
                                    Text("NO MATCH HISTORY FOUND", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                                }
                            }
                        } else {
                            itemsIndexed(matches) { _, m ->
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(28.dp))
                                        .background(theme.colors.card)
                                        .border(1.dp, theme.colors.border, RoundedCornerShape(28.dp))
                                        .padding(24.dp)
                                ) {
                                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                Icon(Icons.Default.Schedule, null, tint = theme.colors.textDisabled, modifier = Modifier.size(14.dp))
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
                                                Text(dateText, fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(20.dp))
                                                    .background(if (m.status == "Live") theme.colors.success else theme.colors.backgroundSecondary)
                                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                                            ) {
                                                Text(
                                                    text = if (m.status == "Live") "● LIVE" else m.status.uppercase(),
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = if (m.status == "Live") Color.White else theme.colors.textDisabled,
                                                    letterSpacing = 1.sp
                                                )
                                            }
                                        }
                                        
                                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(m.teamA.uppercase(), fontSize = 16.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, textAlign = TextAlign.Center, fontStyle = FontStyle.Italic)
                                                if (!m.isExpired && m.innings.isNotEmpty()) {
                                                    val inn = m.innings[0]
                                                    Text("${inn.runs}/${getWickets(inn)}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.success)
                                                }
                                            }
                                            
                                            Box(
                                                modifier = Modifier
                                                    .size(44.dp)
                                                    .clip(CircleShape)
                                                    .background(theme.colors.backgroundSecondary)
                                                    .border(1.dp, theme.colors.border, CircleShape),
                                                contentAlignment = Alignment.Center
                                            ) { 
                                                Text("VS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, fontStyle = FontStyle.Italic) 
                                            }
                                            
                                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(m.teamB.uppercase(), fontSize = 16.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, textAlign = TextAlign.Center, fontStyle = FontStyle.Italic)
                                                if (!m.isExpired && m.innings.size > 1) {
                                                    val inn = m.innings[1]
                                                    Text("${inn.runs}/${getWickets(inn)}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.success)
                                                }
                                            }
                                        }
                                        
                                        if (m.status == "Finished") {
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
                                                        .clickable { currentMatch = m; view = "live" },
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                    ) {
                                                        Icon(Icons.Default.BarChart, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                                                        Text(
                                                            text = "VIEW PERFORMANCE",
                                                            fontSize = 11.sp,
                                                            fontWeight = FontWeight.Black,
                                                            color = Color.White,
                                                            letterSpacing = 2.sp
                                                        )
                                                    }
                                                }
                                            }
                                        } else {
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
                                                        .clickable(enabled = !m.isExpired) { currentMatch = m; view = "setup" },
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(Icons.Default.Edit, contentDescription = "Edit Setup", tint = theme.colors.textSecondary, modifier = Modifier.size(20.dp))
                                                }

                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .height(56.dp)
                                                        .clip(RoundedCornerShape(16.dp))
                                                        .background(if (m.isExpired) theme.colors.backgroundSecondary.copy(0.5f) else theme.colors.textPrimary)
                                                        .clickable(enabled = !m.isExpired) { currentMatch = m; view = "live" },
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                    ) {
                                                        Icon(Icons.Default.PlayArrow, contentDescription = null, tint = if (m.isExpired) theme.colors.textDisabled else theme.colors.background, modifier = Modifier.size(18.dp))
                                                        Text(
                                                            text = if (m.isExpired) "DATA CLEARED" else "RESUME SCORING",
                                                            fontSize = 11.sp,
                                                            fontWeight = FontWeight.Black,
                                                            color = if (m.isExpired) theme.colors.textDisabled else theme.colors.background,
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
                    }

                    // ── Setup ───────────────────────────────────────────────
                    "setup" -> LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        item {
                            Text(buildAnnotatedString {
                                append("NEW ")
                                withStyle(SpanStyle(color = theme.colors.success)) { append("MATCH") }
                            }, fontSize = 32.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = FontStyle.Italic)
                            Text("SET UP YOUR MATCH DETAILS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        }
                        // Team names + sizes
                        item {
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(20.dp)) {
                                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("TEAM A (HOST)", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Spacer(Modifier.height(4.dp))
                                            OutlinedTextField(value = hostTeam, onValueChange = { hostTeam = it }, placeholder = { Text("Enter Team Name", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.success, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                                        }
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("TEAM B (VISITOR)", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Spacer(Modifier.height(4.dp))
                                            OutlinedTextField(value = visitorTeam, onValueChange = { visitorTeam = it }, placeholder = { Text("Enter Team Name", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.success, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                                        }
                                    }
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("PLAYERS TEAM A", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Spacer(Modifier.height(4.dp))
                                            OutlinedTextField(value = hostTeamSize, onValueChange = { hostTeamSize = it }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.success, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                                        }
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("PLAYERS TEAM B", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Spacer(Modifier.height(4.dp))
                                            OutlinedTextField(value = visitorTeamSize, onValueChange = { visitorTeamSize = it }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.success, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                                        }
                                    }
                                }
                            }
                        }
                        // Auto / Custom names toggle
                        item {
                            Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(16.dp)).padding(6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                listOf("default" to "AUTO NAMES", "custom" to "CUSTOM NAMES").forEach { (mode, label) ->
                                    Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (namingMode == mode) theme.colors.textPrimary else Color.Transparent).clickable { namingMode = mode }.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                                        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (namingMode == mode) theme.colors.background else theme.colors.textDisabled, letterSpacing = 1.sp)
                                    }
                                }
                            }
                        }
                        // Custom player names
                        if (namingMode == "custom") {
                            item {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Column(modifier = Modifier.weight(1f).clip(RoundedCornerShape(20.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Icon(Icons.Default.Groups, null, tint = theme.colors.success, modifier = Modifier.size(16.dp))
                                            Text("TEAM A PLAYER NAMES", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.success, letterSpacing = 2.sp)
                                        }
                                        (0 until (hostTeamSize.toIntOrNull() ?: 0)).forEach { i ->
                                            OutlinedTextField(value = hostPlayerNames.getOrElse(i) { "" }, onValueChange = { v -> val l = hostPlayerNames.toMutableList(); while (l.size <= i) l.add(""); l[i] = v; hostPlayerNames = l }, placeholder = { Text("Player ${i + 1}", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.success, unfocusedBorderColor = theme.colors.border, focusedContainerColor = theme.colors.card, unfocusedContainerColor = theme.colors.card, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                                        }
                                    }
                                    Column(modifier = Modifier.weight(1f).clip(RoundedCornerShape(20.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Icon(Icons.Default.Groups, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                                            Text("TEAM B PLAYER NAMES", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
                                        }
                                        (0 until (visitorTeamSize.toIntOrNull() ?: 0)).forEach { i ->
                                            OutlinedTextField(value = visitorPlayerNames.getOrElse(i) { "" }, onValueChange = { v -> val l = visitorPlayerNames.toMutableList(); while (l.size <= i) l.add(""); l[i] = v; visitorPlayerNames = l }, placeholder = { Text("Player ${i + 1}", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = theme.colors.border, focusedContainerColor = theme.colors.card, unfocusedContainerColor = theme.colors.card, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                                        }
                                    }
                                }
                            }
                        }
                        // Toss section
                        item {
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(20.dp)) {
                                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text("TOSS RESULT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        Box(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFFD97706)).clickable { showToss = true; tossResult = null; isCoinSpinning = false }.padding(horizontal = 24.dp, vertical = 12.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Icon(Icons.Default.RotateLeft, null, tint = Color.White, modifier = Modifier.size(16.dp))
                                                Text("SPIN COIN", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 1.sp)
                                            }
                                        }
                                    }
                                    // Toss winner toggle
                                    Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(14.dp)).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        listOf("host" to (hostTeam.ifBlank { "Team A" }), "visitor" to (visitorTeam.ifBlank { "Team B" })).forEach { (key, label) ->
                                            Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (tossWinner == key) theme.colors.success else Color.Transparent).clickable { tossWinner = key }.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                                                Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (tossWinner == key) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                            }
                                        }
                                    }
                                    // Opted to toggle
                                    Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(14.dp)).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        listOf("Bat", "Bowl").forEach { choice ->
                                            Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (optedTo == choice) theme.colors.success else Color.Transparent).clickable { optedTo = choice }.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                                                Text("CHOOSE: $choice", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (optedTo == choice) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        // Overs
                        item {
                            Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(horizontal = 20.dp, vertical = 16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("MATCH LENGTH", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                Row(modifier = Modifier.clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(14.dp)).padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    BasicTextField(value = overs, onValueChange = { overs = it }, textStyle = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, textAlign = TextAlign.Center), modifier = Modifier.width(48.dp))
                                    Text("Overs", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                }
                            }
                        }
                        item {
                            Button(onClick = { startMatch() }, modifier = Modifier.fillMaxWidth().height(64.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.success), shape = RoundedCornerShape(20.dp)) {
                                Icon(Icons.Default.PlayArrow, null, modifier = Modifier.size(22.dp)); Spacer(Modifier.width(8.dp)); Text("START SCORING", fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                            }
                        }
                        item { TextButton(onClick = { view = "history" }, modifier = Modifier.fillMaxWidth()) { Text("CANCEL SETUP", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp) } }
                    }

                    // ── Review ──────────────────────────────────────────────
                    "review" -> {
                        val m = currentMatch
                        if (m == null) { view = "history"; return@AnimatedContent }
                        LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                            item {
                                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(20.dp)) {
                                    Column {
                                        Text("PERFORMANCE REVIEW", fontSize = 24.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                        Text("${m.teamA} VS ${m.teamB}", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    }
                                }
                            }
                            m.innings.forEachIndexed { _, innings ->
                                val groupedOvers = innings.ballByBall.chunked(6)
                                item {
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(20.dp)) {
                                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                                Text("${innings.battingTeam} INNINGS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                                Text("${innings.runs}/${innings.wickets}", fontSize = 24.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                            }
                                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                                Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).padding(14.dp)) { Column { Text("OVERS", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp); Text("${innings.overs}.${innings.balls}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary) } }
                                                Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).padding(14.dp)) { Column { Text("RUN RATE", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp); Text(String.format("%.2f", innings.runs.toDouble() / maxOf(1.0, (innings.overs * 6 + innings.balls) / 6.0)), fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary) } }
                                            }
                                        }
                                    }
                                }
                                // Batsmen table
                                item {
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))) {
                                        Column {
                                            Row(modifier = Modifier.fillMaxWidth().background(theme.colors.backgroundSecondary).padding(horizontal = 16.dp, vertical = 12.dp)) {
                                                Text("PLAYER PERFORMANCE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            }
                                            HorizontalDivider(color = theme.colors.border)
                                            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                                                Text("PLAYER", modifier = Modifier.weight(2f), fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                                Text("R", modifier = Modifier.weight(1f), fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, textAlign = TextAlign.Center, letterSpacing = 1.sp)
                                                Text("B", modifier = Modifier.weight(1f), fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, textAlign = TextAlign.Center, letterSpacing = 1.sp)
                                                Text("S/R", modifier = Modifier.weight(1f), fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, textAlign = TextAlign.Center, letterSpacing = 1.sp)
                                            }
                                            innings.batsmen.filter { it.balls > 0 || it.runs > 0 }.forEach { p ->
                                                HorizontalDivider(color = theme.colors.border.copy(0.3f))
                                                Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                                                    Text(p.name, modifier = Modifier.weight(2f), fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                    Text("${p.runs}", modifier = Modifier.weight(1f), fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                                    Text("${p.balls}", modifier = Modifier.weight(1f), fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, textAlign = TextAlign.Center)
                                                    Text(String.format("%.1f", p.runs.toDouble() / maxOf(1, p.balls) * 100), modifier = Modifier.weight(1f), fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, textAlign = TextAlign.Center)
                                                }
                                            }
                                        }
                                    }
                                }
                                // Ball by ball
                                item {
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))) {
                                        Column {
                                            Row(modifier = Modifier.fillMaxWidth().background(theme.colors.backgroundSecondary).padding(horizontal = 16.dp, vertical = 12.dp)) {
                                                Text("OVER DETAILS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            }
                                            HorizontalDivider(color = theme.colors.border)
                                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                                groupedOvers.forEachIndexed { overIdx, balls ->
                                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                                        Text("OVER ${overIdx + 1}", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { balls.forEach { b -> BallBadge(b, theme) } }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            item { Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.textPrimary).clickable { view = "history" }.padding(20.dp), contentAlignment = Alignment.Center) { Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.History, null, tint = theme.colors.background, modifier = Modifier.size(18.dp)); Text("BACK TO HISTORY", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 2.sp) } } }
                        }
                    }

                    // ── Live ────────────────────────────────────────────────
                    else -> {
                        val m = currentMatch
                        val inn = m?.innings?.getOrNull(m.currentInningsIdx)
                        if (m == null || inn == null) { view = "history"; return@AnimatedContent }

                        LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            // 1. Score card - Compact Balanced
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(24.dp))
                                        .background(theme.colors.card)
                                        .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
                                        .padding(16.dp)
                                ) {
                                    Box(modifier = Modifier.align(Alignment.TopEnd).offset(x = 10.dp, y = (-10).dp).size(100.dp).blur(50.dp).background(theme.colors.success.copy(0.08f), CircleShape))
                                    
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                Icon(Icons.Default.SportsCricket, null, tint = theme.colors.success, modifier = Modifier.size(14.dp))
                                                Text(inn.battingTeam.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.5.sp)
                                            }
                                            if (m.status == "Live") {
                                                Row(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(16.dp))
                                                        .background(theme.colors.success.copy(0.1f))
                                                        .border(1.dp, theme.colors.success.copy(0.2f), RoundedCornerShape(16.dp))
                                                        .padding(horizontal = 10.dp, vertical = 4.dp),
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                ) {
                                                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(theme.colors.success))
                                                    Text("CRR: " + String.format("%.2f", inn.runs.toDouble() / maxOf(1.0, (inn.overs * 6 + inn.balls) / 6.0)), fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.success)
                                                }
                                            }
                                        }
                                        
                                        if (inn.isFreeHit && m.status == "Live") {
                                            Spacer(Modifier.height(8.dp))
                                            Box(
                                                modifier = Modifier
                                                    .shadow(4.dp, RoundedCornerShape(20.dp))
                                                    .clip(RoundedCornerShape(20.dp))
                                                    .background(Color(0xFFF59E0B))
                                                    .border(1.5.dp, Color(0xFFFCD34D), RoundedCornerShape(20.dp))
                                                    .padding(horizontal = 14.dp, vertical = 4.dp)
                                            ) {
                                                Text("FREE HIT ACTIVE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.Black, letterSpacing = 1.sp)
                                            }
                                        }

                                        AnimatedContent(inn.runs, label = "RunsAnimation") { runs ->
                                            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.Center) {
                                                Text(
                                                    text = "$runs",
                                                    fontSize = 68.sp,
                                                    fontWeight = FontWeight.Black,
                                                    fontStyle = FontStyle.Italic,
                                                    color = theme.colors.textPrimary,
                                                    letterSpacing = (-3).sp,
                                                    lineHeight = 68.sp
                                                )
                                                Text(
                                                    text = "/ ${getWickets(inn)}",
                                                    fontSize = 32.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = theme.colors.success,
                                                    modifier = Modifier.padding(bottom = 6.dp, start = 4.dp)
                                                )
                                            }
                                        }
                                        
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Icon(Icons.Default.Schedule, null, tint = theme.colors.textDisabled, modifier = Modifier.size(16.dp))
                                            Text("${inn.overs}.${inn.balls}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, fontStyle = FontStyle.Italic)
                                            Text("Overs", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled.copy(0.6f), modifier = Modifier.padding(top = 2.dp))
                                        }
                                    }
                                }
                            }

                            // 2. Last Balls (Over-based) - Compact
                            if (m.status == "Live") {
                                item {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(18.dp))
                                            .background(theme.colors.card)
                                            .border(1.dp, theme.colors.border, RoundedCornerShape(18.dp))
                                            .padding(14.dp)
                                    ) {
                                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                    Box(modifier = Modifier.size(2.dp, 10.dp).background(theme.colors.success))
                                                    Text("CURRENT OVER", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.5.sp)
                                                }
                                                IconButton(onClick = { showHistoryModal = true }, modifier = Modifier.size(24.dp)) {
                                                    Icon(Icons.Default.History, null, tint = theme.colors.textDisabled, modifier = Modifier.size(18.dp))
                                                }
                                            }
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .horizontalScroll(rememberScrollState()),
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                val oversList = groupBallsIntoOvers(inn.ballByBall)
                                                oversList.lastOrNull()?.forEach { b -> 
                                                    AnimatedVisibility(visible = true, enter = scaleIn() + fadeIn()) {
                                                        BallBadge(b, theme)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                // 3. Controls - Highly Compact
                                item {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(24.dp))
                                            .background(theme.colors.card)
                                            .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
                                            .padding(14.dp)
                                    ) {
                                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                            // Top row: Out | Swap | End
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .clip(RoundedCornerShape(12.dp))
                                                        .background(theme.colors.error.copy(0.15f))
                                                        .border(1.dp, theme.colors.error.copy(0.3f), RoundedCornerShape(12.dp))
                                                        .clickable { handleWicket() }
                                                        .padding(vertical = 12.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text("OUT", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.error, letterSpacing = 1.sp)
                                                }
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .clip(RoundedCornerShape(12.dp))
                                                        .background(theme.colors.backgroundSecondary)
                                                        .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                                                        .clickable { handleSwapEnd() }
                                                        .padding(vertical = 10.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(1.dp)) {
                                                        Icon(Icons.Default.RotateRight, null, tint = theme.colors.textPrimary, modifier = Modifier.size(16.dp))
                                                        Text("SWAP", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, letterSpacing = 1.sp)
                                                    }
                                                }
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .clip(RoundedCornerShape(12.dp))
                                                        .background(Color(0xFFF59E0B).copy(0.15f))
                                                        .border(1.dp, Color(0xFFF59E0B).copy(0.3f), RoundedCornerShape(12.dp))
                                                        .clickable { showEndConfirm = if (m.currentInningsIdx == 0) "innings" else "match" }
                                                        .padding(vertical = 12.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text("PAUSE", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFFF59E0B), letterSpacing = 1.sp)
                                                }
                                            }
                                            
                                            // Run buttons grid - Smaller
                                            val runValues = listOf(0, 1, 2, 3, 4, 6)
                                            val rows = runValues.chunked(3)
                                            rows.forEach { row ->
                                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                    row.forEach { r ->
                                                        val isBoundary = r == 4 || r == 6
                                                        Box(
                                                            modifier = Modifier
                                                                .weight(1f)
                                                                .height(56.dp)
                                                                .clip(RoundedCornerShape(12.dp))
                                                                .background(if (isBoundary) theme.colors.success else theme.colors.backgroundSecondary)
                                                                .border(if (isBoundary) 0.dp else 1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                                                                .clickable { handleRun(r) },
                                                            contentAlignment = Alignment.Center
                                                        ) {
                                                            Text(
                                                                text = "$r",
                                                                fontSize = if (isBoundary) 26.sp else 22.sp,
                                                                fontWeight = FontWeight.Black,
                                                                color = if (isBoundary) Color.White else theme.colors.textPrimary
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                            
                                            // WD + NB - Smaller
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .height(54.dp)
                                                        .clip(RoundedCornerShape(12.dp))
                                                        .background(Color(0xFFD97706))
                                                        .clickable { handleWide() },
                                                    contentAlignment = Alignment.Center
                                                ) { 
                                                    Text("WD", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 1.sp) 
                                                }
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .height(54.dp)
                                                        .clip(RoundedCornerShape(12.dp))
                                                        .background(Color(0xFF2563EB))
                                                        .clickable { handleNoBall() },
                                                    contentAlignment = Alignment.Center
                                                ) { 
                                                    Text("NB", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 1.sp) 
                                                }
                                            }
                                        }
                                    }
                                }
                            }
else {
                                // Finished - view performance button
                                item {
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.textPrimary).clickable { view = "review" }.padding(20.dp), contentAlignment = Alignment.Center) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Icon(Icons.Default.EmojiEvents, null, tint = theme.colors.background, modifier = Modifier.size(20.dp))
                                            Text("VIEW PERFORMANCE", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 2.sp)
                                        }
                                    }
                                }
                            }

                            // 4. Batting stats - Moved below
                            item {
                                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))) {
                                    Column {
                                        Row(modifier = Modifier.fillMaxWidth().background(theme.colors.backgroundSecondary).padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Icon(Icons.Default.FilterCenterFocus, null, tint = theme.colors.accent, modifier = Modifier.size(14.dp))
                                                Text("Batting Stats", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            }
                                            IconButton(onClick = { showScorecardModal = true }, modifier = Modifier.size(24.dp)) {
                                                Icon(Icons.Default.Groups, null, tint = theme.colors.textDisabled, modifier = Modifier.size(18.dp))
                                            }
                                        }
                                        HorizontalDivider(color = theme.colors.border)
                                        listOf(inn.strikerIdx, inn.nonStrikerIdx).forEach { idx ->
                                            val p = inn.batsmen.getOrNull(idx) ?: return@forEach
                                            Row(modifier = Modifier.fillMaxWidth().background(if (idx == inn.strikerIdx) theme.colors.success.copy(0.07f) else Color.Transparent).padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                                                Row(modifier = Modifier.weight(2f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                    Text(p.name, fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                    if (idx == inn.strikerIdx) Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(theme.colors.success))
                                                }
                                                Text("${p.runs}", modifier = Modifier.weight(1f), fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                                Text("${p.balls}", modifier = Modifier.weight(1f), fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, textAlign = TextAlign.Center)
                                                Text(String.format("%.1f", p.runs.toDouble() / maxOf(1, p.balls) * 100), modifier = Modifier.weight(1f), fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, textAlign = TextAlign.Center)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Innings end popup ─────────────────────────────────────────────────
        if (showInningsEndPopup) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.7f)), contentAlignment = Alignment.Center) {
                Box(modifier = Modifier.padding(32.dp).clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(28.dp)).padding(40.dp)) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(modifier = Modifier.size(80.dp).clip(RoundedCornerShape(20.dp)).background(theme.colors.accent), contentAlignment = Alignment.Center) { Icon(Icons.Default.Schedule, null, tint = Color.White, modifier = Modifier.size(40.dp)) }
                        Text("INNINGS OVER", fontSize = 28.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                        Text("SWITCHING SIDES...", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                    }
                }
            }
        }

        // ── End innings/match confirm dialog ──────────────────────────────────
        if (showEndConfirm != null) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.6f)), contentAlignment = Alignment.Center) {
                Box(modifier = Modifier.padding(32.dp).clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(28.dp)).padding(32.dp)) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        Box(modifier = Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)).background(Color.Red.copy(0.15f)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.Cancel, null, tint = Color.Red, modifier = Modifier.size(32.dp))
                        }
                        Text(if (showEndConfirm == "innings") "End Innings?" else "End Match?", fontSize = 24.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = FontStyle.Italic)
                        
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                            Button(
                                onClick = { manualFinalizeInnings() },
                                modifier = Modifier.fillMaxWidth().height(54.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color.Red),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("CONFIRM", fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                            }
                            TextButton(onClick = { showEndConfirm = null }, modifier = Modifier.fillMaxWidth()) {
                                Text("CANCEL", color = theme.colors.textDisabled, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                            }
                        }
                    }
                }
            }
        }

        // ── Coin toss modal ───────────────────────────────────────────────────
        if (showToss) {
            Dialog(onDismissRequest = { if (!isCoinSpinning) showToss = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
                Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.9f)), contentAlignment = Alignment.Center) {
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
                        Text("⚡ COIN TOSS ⚡", fontSize = 24.sp, fontWeight = FontWeight.Black, color = Color(0xFFF59E0B))

                        // 3D Coin Container
                        Box(
                            modifier = Modifier
                                .size(160.dp)
                                .graphicsLayer {
                                    rotationY = coinRotation
                                    cameraDistance = 12f * density.density
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            // A simpler check for front/back visibility
                            val absRot = Math.abs(coinRotation % 360f)
                            val isFront = absRot < 90f || absRot > 270f

                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .graphicsLayer { 
                                        alpha = if (isFront) 1f else 0f
                                    }
                                    .clip(CircleShape)
                                    .background(Brush.linearGradient(listOf(Color(0xFFFBBF24), Color(0xFFD97706))))
                                    .border(8.dp, Color(0xFFFCD34D), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Default.EmojiEvents, null, tint = Color(0xFF78350F), modifier = Modifier.size(40.dp))
                                    Text("TEAM", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF78350F).copy(0.7f))
                                    Text(hostTeam.ifBlank { "Host" }, fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color(0xFF78350F), textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 8.dp))
                                }
                            }

                            // Back Face - Visitor (Visible when rotationY % 360 is near 180)
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .graphicsLayer { 
                                        rotationY = 180f
                                        alpha = if (!isFront) 1f else 0f
                                    }
                                    .clip(CircleShape)
                                    .background(Brush.linearGradient(listOf(Color(0xFF3B82F6), Color(0xFF1D4ED8))))
                                    .border(8.dp, Color(0xFF60A5FA), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Default.FilterCenterFocus, null, tint = Color(0xFF082F49), modifier = Modifier.size(40.dp))
                                    Text("TEAM", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(0.8f))
                                    Text(visitorTeam.ifBlank { "Visitor" }, fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 8.dp))
                                }
                            }
                            
                            // Flipping Indicator Overlay
                            if (tossResult == "flipping") {
                                val infiniteTransition = rememberInfiniteTransition(label = "flipping")
                                val flipRotation by infiniteTransition.animateFloat(
                                    initialValue = 0f,
                                    targetValue = 360f,
                                    animationSpec = infiniteRepeatable(tween(800, easing = LinearEasing)),
                                    label = "flip"
                                )
                                Icon(
                                    Icons.Default.RotateRight, 
                                    null, 
                                    tint = Color.White, 
                                    modifier = Modifier.size(80.dp).rotate(flipRotation).shadow(20.dp, CircleShape)
                                )
                            }
                        }

                        // Result display
                        if (tossResult != null && tossResult != "flipping") {
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.success.copy(0.1f)).border(2.dp, theme.colors.success.copy(0.3f), RoundedCornerShape(20.dp)).padding(20.dp), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Icon(Icons.Default.EmojiEvents, null, tint = theme.colors.success, modifier = Modifier.size(16.dp)); Text("WINNER", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.success, letterSpacing = 2.sp); Icon(Icons.Default.EmojiEvents, null, tint = theme.colors.success, modifier = Modifier.size(16.dp)) }
                                    Spacer(Modifier.height(4.dp))
                                    Text(tossResult ?: "", fontSize = 28.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                }
                            }
                        }
                        Button(onClick = { handleToss() }, enabled = !isCoinSpinning, modifier = Modifier.fillMaxWidth().height(54.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary), shape = RoundedCornerShape(16.dp)) {
                            Icon(Icons.Default.RotateRight, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text(if (isCoinSpinning) "FLIPPING..." else "SPIN COIN", fontSize = 13.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 2.sp)
                        }
                        TextButton(onClick = { if (!isCoinSpinning) showToss = false }, modifier = Modifier.fillMaxWidth()) {
                            Text("CLOSE", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        }
                    }
                }
            }
        }

        // ── Modals (History & Scorecard) ─────────────────────────────────────
        if (showHistoryModal && currentInnings != null) {
            Dialog(onDismissRequest = { showHistoryModal = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
                Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.7f)), contentAlignment = Alignment.Center) {
                    Box(modifier = Modifier.fillMaxWidth(0.9f).fillMaxHeight(0.8f).clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(28.dp))) {
                        Column {
                            Row(modifier = Modifier.fillMaxWidth().background(theme.colors.backgroundSecondary).padding(20.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("MATCH HISTORY", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = FontStyle.Italic)
                                IconButton(onClick = { showHistoryModal = false }) { Icon(Icons.Default.Close, null, tint = theme.colors.textDisabled) }
                            }
                            LazyColumn(modifier = Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                val allOvers = groupBallsIntoOvers(currentInnings.ballByBall)
                                itemsIndexed(allOvers) { idx, balls ->
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.backgroundSecondary).padding(16.dp)) {
                                        Text("OVER ${idx + 1}", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { balls.forEach { b -> BallBadge(b, theme) } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (showScorecardModal && currentInnings != null) {
            Dialog(onDismissRequest = { showScorecardModal = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
                Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.7f)), contentAlignment = Alignment.Center) {
                    Box(modifier = Modifier.fillMaxWidth(0.9f).fillMaxHeight(0.8f).clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(28.dp))) {
                        Column {
                            Row(modifier = Modifier.fillMaxWidth().background(theme.colors.backgroundSecondary).padding(20.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("${currentInnings.battingTeam} SCORECARD", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = FontStyle.Italic)
                                IconButton(onClick = { showScorecardModal = false }) { Icon(Icons.Default.Close, null, tint = theme.colors.textDisabled) }
                            }
                            LazyColumn(modifier = Modifier.fillMaxSize()) {
                                item {
                                    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Text("BATSMAN", modifier = Modifier.weight(2f), fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                        Text("R", modifier = Modifier.weight(1f), fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, textAlign = TextAlign.Center)
                                        Text("B", modifier = Modifier.weight(1f), fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, textAlign = TextAlign.Center)
                                        Text("S/R", modifier = Modifier.weight(1f), fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, textAlign = TextAlign.Center)
                                    }
                                }
                                itemsIndexed(currentInnings.batsmen) { _, p ->
                                    HorizontalDivider(color = theme.colors.border.copy(0.3f))
                                    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp).alpha(if (p.balls > 0 || p.isOut) 1f else 0.5f), verticalAlignment = Alignment.CenterVertically) {
                                        Column(modifier = Modifier.weight(2f)) {
                                            Text(p.name, fontSize = 13.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                            if (p.isOut) Text("OUT", fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.Red)
                                            else if (p.balls > 0) Text("NOT OUT", fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.Green)
                                        }
                                        Text("${p.runs}", modifier = Modifier.weight(1f), fontSize = 16.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, textAlign = TextAlign.Center)
                                        Text("${p.balls}", modifier = Modifier.weight(1f), fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, textAlign = TextAlign.Center)
                                        Text(if (p.balls > 0) String.format("%.1f", p.runs.toDouble() / p.balls * 100) else "0.0", modifier = Modifier.weight(1f), fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, textAlign = TextAlign.Center)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
