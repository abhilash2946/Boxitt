package com.boxitt.app.pages

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.boxitt.app.Location
import com.boxitt.app.R
import com.boxitt.app.SportType
import com.boxitt.app.User
import com.boxitt.app.components.ThemeSelector
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.Storage
import com.boxitt.app.services.Supabase
import com.boxitt.app.services.handleError
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.time.Instant
import java.util.UUID
import kotlinx.serialization.Serializable
import org.json.JSONArray
import org.json.JSONObject

// ─── Data Models ───────────────────────────────────────────────────────────────

@Serializable
data class BadmintonPoint(
    val winner: String, // "A" | "B"
    val type: String,   // "Normal" | "Smash" | "Net" | "Drive" | "Fault"
    val scoreA: Int,
    val scoreB: Int,
    val server: String,
    val timestamp: String = Instant.now().toString()
)

@Serializable
data class BadmintonGame(
    val scoreA: Int,
    val scoreB: Int,
    val winner: String // "A" | "B"
)

@Serializable
data class BadmintonMatch(
    val id: String,
    val locationId: String,
    val playerA: String,
    val playerB: String,
    val scoreA: Int = 0,
    val scoreB: Int = 0,
    val gamesA: Int = 0,
    val gamesB: Int = 0,
    val status: String = "Live",   // "Live" | "Finished"
    val tossWinner: String? = null, // "A" | "B"
    val optedTo: String? = null,    // "Serve" | "Receive" | "Side"
    val server: String? = null,     // "A" | "B"
    val history: List<BadmintonPoint> = emptyList(),
    val gameHistory: List<BadmintonGame> = emptyList(),
    val createdAt: String = Instant.now().toString(),
    val finishedAt: String? = null,
    val sport: SportType = SportType.BADMINTON,
    val startTime: String? = null,
    val endTime: String? = null
)

@Serializable
data class BadmintonPageState(
    val currentMatch: BadmintonMatch? = null,
    val view: BadmintonView = BadmintonView.HISTORY,
    val playerA: String = "Player A",
    val playerB: String = "Player B",
    val namingMode: String = "default"
)

enum class BadmintonView { HISTORY, SETUP, LIVE, REVIEW }

// ─── Main Composable ──────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BadmintonScorer(
    location: Location,
    user: User,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onBack: (() -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    val PAGE_ID = "badminton_scorer_${location.id}"
    val savedState = remember { Storage.getPageState<BadmintonPageState>(PAGE_ID) ?: BadmintonPageState() }

    var matches by remember { mutableStateOf<List<BadmintonMatch>>(emptyList()) }
    var currentMatch by remember { mutableStateOf<BadmintonMatch?>(savedState.currentMatch) }
    var view by remember { mutableStateOf(savedState.view) }
    var playerA by remember { mutableStateOf(savedState.playerA) }
    var playerB by remember { mutableStateOf(savedState.playerB) }
    var namingMode by remember { mutableStateOf(savedState.namingMode) }
    
    // Toss State
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
    
    var tossWinnerSide by remember { mutableStateOf<String?>(null) }
    var optedTo by remember { mutableStateOf("Serve") }

    fun syncToSupabase(m: BadmintonMatch) {
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
                    android.util.Log.e("BadmintonScorer", "Failed to sync score to Supabase", e)
                }
            }
        }
    }

    fun persist(match: BadmintonMatch? = currentMatch, newView: BadmintonView = view) {
        currentMatch = match
        view = newView
        Storage.setPageState(PAGE_ID, BadmintonPageState(match, newView, playerA, playerB, namingMode))
        if (match != null) {
            syncToSupabase(match)
        }
    }

    LaunchedEffect(Unit) {
        try {
            val response = Supabase.client.postgrest["matches"]
                .select {
                    filter {
                        eq("location_id", location.id)
                        eq("sport", "badminton")
                    }
                }
            val json = JSONArray(response.data)
            val list = mutableListOf<BadmintonMatch>()
            for (i in 0 until json.length()) {
                val obj = json.getJSONObject(i)
                list.add(BadmintonMatch(
                    id = obj.getString("id"),
                    locationId = obj.getString("location_id"),
                    playerA = obj.getString("player_a"),
                    playerB = obj.getString("player_b"),
                    scoreA = obj.getInt("score_a"),
                    scoreB = obj.getInt("score_b"),
                    gamesA = obj.getInt("games_a"),
                    gamesB = obj.getInt("games_b"),
                    status = obj.getString("status"),
                    createdAt = obj.getString("created_at"),
                    finishedAt = if (obj.isNull("finished_at")) null else obj.getString("finished_at"),
                    startTime = if (obj.has("startTime")) obj.optString("startTime") else if (obj.has("start_time")) obj.optString("start_time") else null,
                    endTime = if (obj.has("endTime")) obj.optString("endTime") else if (obj.has("end_time")) obj.optString("end_time") else null
                ))
            }
            matches = list.sortedByDescending { it.createdAt }
        } catch (e: Exception) {
            handleError(e)
        }
    }

    fun handlePoint(winner: String, type: String = "Normal") {
        val m = currentMatch ?: return
        if (m.status == "Finished") return

        var nsA = m.scoreA
        var nsB = m.scoreB
        var ngA = m.gamesA
        var ngB = m.gamesB
        var newGameHistory = m.gameHistory
        
        if (winner == "A") nsA++ else nsB++
        
        // Badminton scoring logic: first to 21, win by 2, cap at 30
        if (((nsA >= 21 || nsB >= 21) && Math.abs(nsA - nsB) >= 2) || nsA == 30 || nsB == 30) {
            val gameWinner = if (nsA > nsB) "A" else "B"
            if (gameWinner == "A") ngA++ else ngB++
            newGameHistory = m.gameHistory + BadmintonGame(nsA, nsB, gameWinner)
            nsA = 0
            nsB = 0
        }

        // Check for match finish (best of 3)
        var status = "Live"
        var finishedAt: String? = null
        if (ngA == 2 || ngB == 2) {
            status = "Finished"
            finishedAt = Instant.now().toString()
        }

        val point = BadmintonPoint(winner, type, nsA, nsB, winner)
        val updated = m.copy(
            scoreA = nsA, 
            scoreB = nsB, 
            gamesA = ngA, 
            gamesB = ngB, 
            server = winner,
            status = status,
            finishedAt = finishedAt,
            history = m.history + point,
            gameHistory = newGameHistory
        )
        persist(updated, if (status == "Finished") BadmintonView.REVIEW else BadmintonView.LIVE)
    }

    fun handleUndo() {
        val m = currentMatch ?: return
        if (m.history.isEmpty()) return
        
        val prevHistory = m.history.dropLast(1)
        val lastPoint = prevHistory.lastOrNull()
        
        // This is a simplified undo. In a real app, you'd need to handle game transitions more carefully.
        val updated = m.copy(
            scoreA = lastPoint?.scoreA ?: 0,
            scoreB = lastPoint?.scoreB ?: 0,
            server = lastPoint?.server ?: m.tossWinner,
            history = prevHistory
        )
        persist(updated)
    }

    fun startMatch() {
        if (tossWinnerSide == null) {
            onAlert?.invoke("Toss Required", "Please complete the toss first.", null)
            return
        }

        val initialServer = when (optedTo) {
            "Serve" -> tossWinnerSide
            "Receive" -> if (tossWinnerSide == "A") "B" else "A"
            else -> tossWinnerSide
        }

        val newMatch = BadmintonMatch(
            id = UUID.randomUUID().toString(),
            locationId = location.id,
            playerA = if (namingMode == "custom") playerA else "Player A",
            playerB = if (namingMode == "custom") playerB else "Player B",
            tossWinner = tossWinnerSide,
            optedTo = optedTo,
            server = initialServer
        )
        persist(newMatch, BadmintonView.LIVE)
    }

    fun handleToss() {
        if (isCoinSpinning) return
        isCoinSpinning = true
        tossResult = "flipping"
        
        val secureRandom = java.security.SecureRandom()
        val isAWinner = secureRandom.nextBoolean()
        val winner = if (isAWinner) "A" else "B"
        
        val extraRotations = 10 + secureRandom.nextInt(6)
        val landingAngle = if (isAWinner) 0f else 180f
        coinSpinDuration = 2800L + (secureRandom.nextDouble() * 400L).toLong()
        coinTargetAngle += extraRotations * 360f + landingAngle - (coinTargetAngle % 360f)

        scope.launch {
            delay(coinSpinDuration)
            tossWinnerSide = winner
            tossResult = if (winner == "A") (if(namingMode == "custom") playerA else "Player A") else (if(namingMode == "custom") playerB else "Player B")
            isCoinSpinning = false
        }
    }

    fun getServiceSide(score: Int): String {
        return if (score % 2 == 0) "RIGHT" else "LEFT"
    }

    // ── UI Components ──────────────────────────────────────────────────────────

    @Composable
    fun MetricChip(label: String, value: Int, color: Color) {
        Column(
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(color.copy(0.1f))
                .border(1.dp, color.copy(0.2f), RoundedCornerShape(12.dp))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(label, fontSize = 8.sp, fontWeight = FontWeight.Black, color = color, letterSpacing = 1.sp)
            Text("$value", fontSize = 16.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
        }
    }

    @Composable
    fun DensityButton(label: String, color: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
        Box(
            modifier = modifier
                .height(54.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(color.copy(0.1f))
                .border(1.dp, color.copy(0.3f), RoundedCornerShape(14.dp))
                .clickable { onClick() },
            contentAlignment = Alignment.Center
        ) {
            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = color, letterSpacing = 1.sp)
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { 
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("BADMINTON PRO", fontSize = 16.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, letterSpacing = 2.sp)
                        Text("ELITE SCORING SYSTEM", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 4.sp)
                    }
                },
                navigationIcon = { 
                    IconButton(onClick = { 
                        if (view == BadmintonView.LIVE || view == BadmintonView.REVIEW) view = BadmintonView.HISTORY 
                        else onBack?.invoke() 
                    }) { 
                        Icon(Icons.Default.ArrowBack, null, tint = theme.colors.textPrimary) 
                    } 
                },
                actions = { ThemeSelector() },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = theme.colors.background)
            )
        },
        containerColor = theme.colors.background
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            // Background Decor
            Box(modifier = Modifier.fillMaxSize()) {
                Box(modifier = Modifier.offset(x = (-120).dp, y = (-120).dp).size(450.dp).blur(120.dp).background(theme.colors.accent.copy(0.15f), CircleShape))
                Box(modifier = Modifier.align(Alignment.BottomEnd).offset(x = 120.dp, y = 120.dp).size(450.dp).blur(120.dp).background(theme.colors.success.copy(0.15f), CircleShape))
            }

            Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
                // Navigation Tabs
                if (view == BadmintonView.HISTORY || view == BadmintonView.SETUP) {
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(BadmintonView.HISTORY to "MATCH ARCHIVES", BadmintonView.SETUP to "INITIATE MATCH").forEach { (v, label) ->
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(44.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (view == v) theme.colors.textPrimary else theme.colors.card)
                                    .clickable { view = v }
                                    .padding(horizontal = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (view == v) theme.colors.background else theme.colors.textSecondary, letterSpacing = 1.sp)
                            }
                        }
                    }
                }

                AnimatedContent(targetState = view, label = "ViewTransition") { currentView ->
                    when (currentView) {
                        BadmintonView.HISTORY -> {
                            LazyColumn(contentPadding = PaddingValues(bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                item {
                                    Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text("RECENT ACTIVITY", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        Icon(Icons.Default.FilterList, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                                    }
                                }

                                if (matches.isEmpty()) {
                                    item {
                                        Box(modifier = Modifier.fillMaxWidth().height(240.dp).clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(28.dp)), contentAlignment = Alignment.Center) {
                                            Text("NO HISTORICAL DATA", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                                        }
                                    }
                                }

                                itemsIndexed(matches) { _, match ->
                                    Card(
                                        modifier = Modifier.fillMaxWidth().clickable { currentMatch = match; view = BadmintonView.REVIEW },
                                        shape = RoundedCornerShape(24.dp),
                                        colors = CardDefaults.cardColors(containerColor = theme.colors.card),
                                        border = BorderStroke(1.dp, theme.colors.border)
                                    ) {
                                        Column(modifier = Modifier.padding(20.dp)) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                                val dateText = remember(match.startTime, match.endTime, match.createdAt) {
                                                    if (!match.startTime.isNullOrEmpty()) {
                                                        try {
                                                            val inFmt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault())
                                                            val timeFmt = java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault())
                                                            val dateFmt = java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale.getDefault())
                                                            val startD = inFmt.parse(match.startTime)
                                                            if (startD != null) {
                                                                if (!match.endTime.isNullOrEmpty()) {
                                                                    val endD = inFmt.parse(match.endTime)
                                                                    if (endD != null) {
                                                                        "${dateFmt.format(startD)} • ${timeFmt.format(startD)} - ${timeFmt.format(endD)}"
                                                                    } else {
                                                                        "${dateFmt.format(startD)} • ${timeFmt.format(startD)}"
                                                                    }
                                                                } else {
                                                                    "${dateFmt.format(startD)} • ${timeFmt.format(startD)}"
                                                                }
                                                            } else match.createdAt
                                                        } catch (e: Exception) { match.createdAt }
                                                    } else {
                                                        try {
                                                            val parsed = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault()).parse(match.createdAt)
                                                            if (parsed != null) java.text.SimpleDateFormat("dd/MM/yyyy, hh:mm a", java.util.Locale.getDefault()).format(parsed) else match.createdAt
                                                        } catch (e: Exception) { match.createdAt }
                                                    }
                                                }
                                                Text(dateText, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                                                Box(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(if(match.status == "Live") theme.colors.accent.copy(0.1f) else theme.colors.textDisabled.copy(0.1f)).padding(horizontal = 8.dp, vertical = 2.dp)) {
                                                    Text(match.status.uppercase(), fontSize = 8.sp, fontWeight = FontWeight.Black, color = if(match.status == "Live") theme.colors.accent else theme.colors.textSecondary)
                                                }
                                            }
                                            Spacer(Modifier.height(20.dp))
                                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text(match.playerA, fontSize = 14.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
                                                    Text("${match.gamesA} G", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                                }
                                                Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(theme.colors.backgroundSecondary), contentAlignment = Alignment.Center) { 
                                                    Text("VS", fontSize = 9.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic) 
                                                }
                                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text(match.playerB, fontSize = 14.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
                                                    Text("${match.gamesB} G", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        BadmintonView.SETUP -> {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                item {
                                    Column(modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
                                        Text("MATCH SETUP", fontSize = 36.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, letterSpacing = (-1).sp)
                                        Text("PROFESSIONAL CONFIGURATION INTERFACE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    }
                                }

                                item {
                                    Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(16.dp)).padding(4.dp)) {
                                        listOf("default" to "AUTOMATED", "custom" to "CUSTOM NAMES").forEach { (mode, label) ->
                                            Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (namingMode == mode) theme.colors.textPrimary else Color.Transparent).clickable { namingMode = mode }.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                                                Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (namingMode == mode) theme.colors.background else theme.colors.textDisabled, letterSpacing = 1.sp)
                                            }
                                        }
                                    }
                                }

                                if (namingMode == "custom") {
                                    item {
                                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                            OutlinedTextField(value = playerA, onValueChange = { playerA = it }, label = { Text("PLAYER / TEAM A") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent))
                                            OutlinedTextField(value = playerB, onValueChange = { playerB = it }, label = { Text("PLAYER / TEAM B") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent))
                                        }
                                    }
                                }

                                item {
                                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = theme.colors.card), border = BorderStroke(1.dp, theme.colors.border)) {
                                        Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                                Column {
                                                    Text("ELITE TOSS SYSTEM", fontSize = 12.sp, fontWeight = FontWeight.Black)
                                                    Text("PHYSICS BASED COIN SPIN", fontSize = 8.sp, color = theme.colors.textDisabled)
                                                }
                                                Box(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(theme.colors.accent).clickable { showToss = true; tossResult = null }.padding(horizontal = 20.dp, vertical = 10.dp)) {
                                                    Text("LAUNCH SPIN", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White)
                                                }
                                            }
                                            
                                            if (tossWinnerSide != null) {
                                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                                    HorizontalDivider(color = theme.colors.border)
                                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                        Icon(Icons.Default.CheckCircle, null, tint = theme.colors.success, modifier = Modifier.size(16.dp))
                                                        Text("WINNER: ${if(tossWinnerSide == "A") playerA else playerB}", fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                    }
                                                    Text("POST-TOSS DECISION", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                        listOf("Serve", "Receive", "Side").forEach { choice ->
                                                            Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (optedTo == choice) theme.colors.textPrimary else theme.colors.backgroundSecondary).clickable { optedTo = choice }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                                                                Text(choice.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (optedTo == choice) theme.colors.background else theme.colors.textPrimary)
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                item {
                                    Button(onClick = { startMatch() }, modifier = Modifier.fillMaxWidth().height(64.dp), shape = RoundedCornerShape(20.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.success)) {
                                        Icon(Icons.Default.PlayArrow, null)
                                        Spacer(Modifier.width(8.dp))
                                        Text("START PROFESSIONAL SESSION", fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                    }
                                }
                            }
                        }

                        BadmintonView.LIVE -> {
                            val m = currentMatch ?: return@AnimatedContent
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp), contentPadding = PaddingValues(bottom = 20.dp)) {
                                // Scoreboard Monitor
                                item {
                                    Card(
                                        modifier = Modifier.fillMaxWidth().shadow(24.dp, RoundedCornerShape(32.dp)),
                                        shape = RoundedCornerShape(32.dp),
                                        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
                                    ) {
                                        Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(Color.Red))
                                                    Text("LIVE PERFORMANCE TRACKING", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White.copy(0.7f), letterSpacing = 1.5.sp)
                                                }
                                                // Game History Log
                                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                    m.gameHistory.forEachIndexed { idx, game ->
                                                        Box(modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(Color.White.copy(0.1f)).padding(horizontal = 6.dp, vertical = 2.dp)) {
                                                            Text("G${idx+1}: ${game.scoreA}-${game.scoreB}", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                                        }
                                                    }
                                                    Box(modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(theme.colors.accent).padding(horizontal = 6.dp, vertical = 2.dp)) {
                                                        Text("GAMES: ${m.gamesA} - ${m.gamesB}", fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.White)
                                                    }
                                                }
                                            }
                                            
                                            Spacer(Modifier.height(32.dp))
                                            
                                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text(m.playerA.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.Gray, letterSpacing = 1.sp, textAlign = TextAlign.Center)
                                                    Text("${m.scoreA}", fontSize = 84.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White, letterSpacing = (-4).sp)
                                                    if (m.server == "A") {
                                                        Box(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(theme.colors.success).padding(horizontal = 10.dp, vertical = 4.dp)) {
                                                            Text("SERVICE: ${getServiceSide(m.scoreA)}", fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.White)
                                                        }
                                                    } else {
                                                        Spacer(Modifier.height(20.dp))
                                                    }
                                                }
                                                Text("VS", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color.White.copy(0.1f))
                                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text(m.playerB.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.Gray, letterSpacing = 1.sp, textAlign = TextAlign.Center)
                                                    Text("${m.scoreB}", fontSize = 84.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White, letterSpacing = (-4).sp)
                                                    if (m.server == "B") {
                                                        Box(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(theme.colors.success).padding(horizontal = 10.dp, vertical = 4.dp)) {
                                                            Text("SERVICE: ${getServiceSide(m.scoreB)}", fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.White)
                                                        }
                                                    } else {
                                                        Spacer(Modifier.height(20.dp))
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                // High-Level Interaction Controls
                                item {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Button(onClick = { handlePoint("A") }, modifier = Modifier.weight(1f).height(72.dp), shape = RoundedCornerShape(20.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.success)) {
                                            Text("WINNER A", fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                        }
                                        Button(onClick = { handlePoint("B") }, modifier = Modifier.weight(1f).height(72.dp), shape = RoundedCornerShape(20.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.success)) {
                                            Text("WINNER B", fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                        }
                                    }
                                }

                                // Density Tracking Analytics
                                item {
                                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp), colors = CardDefaults.cardColors(containerColor = theme.colors.card), border = BorderStroke(1.dp, theme.colors.border)) {
                                        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                                Text("LIVE DENSITY METRICS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                                Icon(Icons.Default.Analytics, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                                            }
                                            
                                            // Player A metrics
                                            Text(m.playerA.uppercase(), fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textSecondary)
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                DensityButton("SMASH", Color(0xFFEF4444), { handlePoint("A", "Smash") }, Modifier.weight(1f))
                                                DensityButton("NET", Color(0xFF3B82F6), { handlePoint("A", "Net") }, Modifier.weight(1f))
                                                DensityButton("DRIVE", Color(0xFF8B5CF6), { handlePoint("A", "Drive") }, Modifier.weight(1f))
                                                DensityButton("FAULT", Color(0xFFF59E0B), { handlePoint("B", "Fault") }, Modifier.weight(1f))
                                            }

                                            HorizontalDivider(color = theme.colors.border.copy(0.5f))
                                            
                                            // Player B metrics
                                            Text(m.playerB.uppercase(), fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textSecondary)
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                DensityButton("SMASH", Color(0xFFEF4444), { handlePoint("B", "Smash") }, Modifier.weight(1f))
                                                DensityButton("NET", Color(0xFF3B82F6), { handlePoint("B", "Net") }, Modifier.weight(1f))
                                                DensityButton("DRIVE", Color(0xFF8B5CF6), { handlePoint("B", "Drive") }, Modifier.weight(1f))
                                                DensityButton("FAULT", Color(0xFFF59E0B), { handlePoint("A", "Fault") }, Modifier.weight(1f))
                                            }
                                        }
                                    }
                                }

                                // Terminal Operation Center
                                item {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        OutlinedButton(onClick = { handleUndo() }, modifier = Modifier.weight(1f).height(56.dp), shape = RoundedCornerShape(16.dp)) {
                                            Icon(Icons.Default.Undo, null, modifier = Modifier.size(18.dp))
                                            Spacer(Modifier.width(8.dp))
                                            Text("UNDO LAST", fontSize = 10.sp, fontWeight = FontWeight.Black)
                                        }
                                        Button(onClick = { persist(m.copy(status = "Finished", finishedAt = Instant.now().toString()), BadmintonView.REVIEW) }, modifier = Modifier.weight(1f).height(56.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.error.copy(0.1f))) {
                                            Text("TERMINATE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.error)
                                        }
                                    }
                                }
                            }
                        }

                        BadmintonView.REVIEW -> {
                            val m = currentMatch ?: return@AnimatedContent
                            val history = m.history
                            
                            fun countType(player: String, type: String) = history.count { it.winner == player && it.type == type }
                            
                            val smashesA = countType("A", "Smash")
                            val smashesB = countType("B", "Smash")
                            val netsA = countType("A", "Net")
                            val netsB = countType("B", "Net")
                            val drivesA = countType("A", "Drive")
                            val drivesB = countType("B", "Drive")
                            val faultsA = history.count { it.winner == "B" && it.type == "Fault" }
                            val faultsB = history.count { it.winner == "A" && it.type == "Fault" }

                            LazyColumn(verticalArrangement = Arrangement.spacedBy(20.dp), contentPadding = PaddingValues(bottom = 40.dp)) {
                                item {
                                    Column(modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
                                        Text("PERFORMANCE ANALYSIS", fontSize = 32.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic)
                                        Text("OFFICIAL MATCH ANALYTICS REPORT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    }
                                }

                                // Champion Banner
                                item {
                                    val winnerName = if(m.gamesA > m.gamesB) m.playerA else m.playerB
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(theme.colors.success.copy(0.1f)).border(1.dp, theme.colors.success.copy(0.2f), RoundedCornerShape(28.dp)).padding(32.dp), contentAlignment = Alignment.Center) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Icon(Icons.Default.EmojiEvents, null, tint = theme.colors.success, modifier = Modifier.size(56.dp))
                                            Spacer(Modifier.height(16.dp))
                                            Text(winnerName.uppercase(), fontSize = 28.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
                                            Text("MATCH CHAMPION", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.success, letterSpacing = 4.sp)
                                        }
                                    }
                                }

                                // Detailed Metrics Table
                                item {
                                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp), colors = CardDefaults.cardColors(containerColor = theme.colors.card), border = BorderStroke(1.dp, theme.colors.border)) {
                                        Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                            Text("SHOT DISTRIBUTION", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text(m.playerA.take(12), fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                                    Spacer(Modifier.height(12.dp))
                                                    MetricChip("SMASH", smashesA, Color(0xFFEF4444))
                                                    Spacer(Modifier.height(8.dp))
                                                    MetricChip("NET", netsA, Color(0xFF3B82F6))
                                                    Spacer(Modifier.height(8.dp))
                                                    MetricChip("DRIVE", drivesA, Color(0xFF8B5CF6))
                                                    Spacer(Modifier.height(8.dp))
                                                    MetricChip("FAULT", faultsA, Color(0xFFF59E0B))
                                                }
                                                
                                                Box(modifier = Modifier.width(1.dp).fillMaxHeight().background(theme.colors.border))
                                                
                                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text(m.playerB.take(12), fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                                    Spacer(Modifier.height(12.dp))
                                                    MetricChip("SMASH", smashesB, Color(0xFFEF4444))
                                                    Spacer(Modifier.height(8.dp))
                                                    MetricChip("NET", netsB, Color(0xFF3B82F6))
                                                    Spacer(Modifier.height(8.dp))
                                                    MetricChip("DRIVE", drivesB, Color(0xFF8B5CF6))
                                                    Spacer(Modifier.height(8.dp))
                                                    MetricChip("FAULT", faultsB, Color(0xFFF59E0B))
                                                }
                                            }
                                        }
                                    }
                                }

                                // Game Breakdown
                                item {
                                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp), colors = CardDefaults.cardColors(containerColor = theme.colors.card), border = BorderStroke(1.dp, theme.colors.border)) {
                                        Column(modifier = Modifier.padding(20.dp)) {
                                            Text("GAME SEQUENCE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Spacer(Modifier.height(16.dp))
                                            m.gameHistory.forEachIndexed { idx, game ->
                                                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                                    Text("GAME ${idx+1}", fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(60.dp))
                                                    Box(modifier = Modifier.weight(1f).height(8.dp).clip(CircleShape).background(theme.colors.backgroundSecondary)) {
                                                        val ratio = if(game.scoreA + game.scoreB > 0) game.scoreA.toFloat() / (game.scoreA + game.scoreB) else 0.5f
                                                        Box(modifier = Modifier.fillMaxHeight().fillMaxWidth(ratio).background(theme.colors.accent))
                                                    }
                                                    Text("${game.scoreA} - ${game.scoreB}", fontSize = 11.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(60.dp), textAlign = TextAlign.End)
                                                }
                                            }
                                        }
                                    }
                                }

                                item {
                                    Button(onClick = { persist(null, BadmintonView.HISTORY) }, modifier = Modifier.fillMaxWidth().height(60.dp), shape = RoundedCornerShape(16.dp)) {
                                        Text("RETURN TO ARCHIVES", fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Toss System Modal ──────────────────────────────────────────────────
        if (showToss) {
            Dialog(onDismissRequest = { if (!isCoinSpinning) showToss = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
                Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.9f)), contentAlignment = Alignment.Center) {
                    Column(
                        modifier = Modifier.padding(32.dp).clip(RoundedCornerShape(32.dp)).background(theme.colors.card).border(2.dp, theme.colors.border, RoundedCornerShape(32.dp)).padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(24.dp)
                    ) {
                        Text("PRO COIN SYSTEM", fontSize = 24.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)

                        Box(
                            modifier = Modifier.size(180.dp).graphicsLayer { rotationY = coinRotation; cameraDistance = 12f * density.density },
                            contentAlignment = Alignment.Center
                        ) {
                            val absRot = Math.abs(coinRotation % 360f)
                            val isFront = absRot < 90f || absRot > 270f
                            
                            Box(modifier = Modifier.fillMaxSize().graphicsLayer { alpha = if(isFront) 1f else 0f }.clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFFFBBF24), Color(0xFFD97706)))).border(8.dp, Color(0xFFFCD34D), CircleShape), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Default.SportsBasketball, null, tint = Color(0xFF78350F), modifier = Modifier.size(48.dp))
                                    Text(playerA.take(10).uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF78350F))
                                }
                            }
                            Box(modifier = Modifier.fillMaxSize().graphicsLayer { rotationY = 180f; alpha = if(!isFront) 1f else 0f }.clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFF3B82F6), Color(0xFF1D4ED8)))).border(8.dp, Color(0xFF60A5FA), CircleShape), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Default.SportsVolleyball, null, tint = Color.White, modifier = Modifier.size(48.dp))
                                    Text(playerB.take(10).uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White)
                                }
                            }
                        }

                        if (tossResult != null && !isCoinSpinning) {
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.success.copy(0.1f)).padding(16.dp), contentAlignment = Alignment.Center) {
                                Text("WINNER: $tossResult", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.success)
                            }
                        }

                        Button(onClick = { handleToss() }, enabled = !isCoinSpinning, modifier = Modifier.fillMaxWidth().height(60.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary)) {
                            Text(if (isCoinSpinning) "SPINNING PHYSICS..." else "EXECUTE SPIN", fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 2.sp)
                        }
                        
                        TextButton(onClick = { if(!isCoinSpinning) showToss = false }) { Text("CLOSE TERMINAL", color = theme.colors.textDisabled, fontWeight = FontWeight.Black) }
                    }
                }
            }
        }
    }
}
