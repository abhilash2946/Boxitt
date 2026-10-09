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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
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
import com.boxitt.app.components.RatingModal
import com.boxitt.app.contexts.LocalAppTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

// ─── Data Models ───────────────────────────────────────────────────────────────

data class Swimmer(
    val id: String,
    val lane: Int,
    val name: String,
    val laps: Int = 0,
    val finished: Boolean = false,
    val finishTime: Long? = null,
    val isRunning: Boolean = false,
    val time: Long = 0L,
    val splits: List<Long> = emptyList(),
    val rank: Int = 0
)

fun Swimmer.toJson() = JSONObject().apply {
    put("id", id); put("lane", lane); put("name", name); put("laps", laps); put("finished", finished)
    if (finishTime != null) put("finishTime", finishTime)
    put("isRunning", isRunning); put("time", time)
    val sp = JSONArray(); splits.forEach { sp.put(it) }; put("splits", sp)
    put("rank", rank)
}

fun JSONObject.toSwimmer() = Swimmer(
    id = getString("id"),
    lane = optInt("lane", 1),
    name = getString("name"),
    laps = optInt("laps"),
    finished = optBoolean("finished"),
    finishTime = if (has("finishTime")) getLong("finishTime") else null,
    isRunning = optBoolean("isRunning"),
    time = optLong("time"),
    splits = optJSONArray("splits")?.let { arr -> (0 until arr.length()).map { arr.getLong(it) } } ?: emptyList(),
    rank = optInt("rank", 0)
)

// ─── Formatting Helpers ───────────────────────────────────────────────────────

fun formatSwimTime(ms: Long): String {
    val minutes = (ms / 60000).toInt()
    val seconds = ((ms % 60000) / 1000).toInt()
    val millis = (ms % 1000).toInt()
    return "${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}"
}

// ─── Main Component ───────────────────────────────────────────────────────────

@Composable
fun SwimmingScorer(
    location: Location,
    user: User,
    onBack: () -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onConfirm: ((String, () -> Unit, (() -> Unit)?, String?, String?, Boolean?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    val PAGE_ID = "swimming_scorer_${location.id}"

    val savedState = remember {
        val raw = context.getSharedPreferences("page_state", android.content.Context.MODE_PRIVATE).getString(PAGE_ID, null)
        if (raw != null) {
            try { JSONObject(raw) } catch (e: Exception) { null }
        } else null
    }

    var view by remember { mutableStateOf(savedState?.optString("view", "setup") ?: "setup") }
    
    // Race Configuration
    var eventName by remember { mutableStateOf(savedState?.optString("eventName", "Club Championship") ?: "Club Championship") }
    var heatNumber by remember { mutableStateOf(savedState?.optString("heatNumber", "1") ?: "1") }
    var raceDistance by remember { mutableStateOf(savedState?.optString("raceDistance", "100m") ?: "100m") }
    var squadSize by remember { mutableIntStateOf(savedState?.optInt("squadSize", 4) ?: 4) }
    var nameMode by remember { mutableStateOf(savedState?.optString("nameMode", "Auto") ?: "Auto") }
    
    var tossWinner by remember { mutableStateOf(savedState?.optString("tossWinner", null)) }
    var optedTo by remember { mutableStateOf(savedState?.optString("optedTo", null)) }

    var swimmers by remember {
        val saved = savedState?.optJSONArray("swimmers")
        if (saved != null) {
            mutableStateOf((0 until saved.length()).map { saved.getJSONObject(it).toSwimmer() })
        } else {
            mutableStateOf((1..squadSize).map { 
                Swimmer(id = it.toString(), lane = it, name = "Lane $it")
            })
        }
    }
    
    var isFinished by remember { mutableStateOf(savedState?.optBoolean("isFinished", false) ?: false) }
    var isGlobalRunning by remember { mutableStateOf(savedState?.optBoolean("isGlobalRunning", false) ?: false) }
    var globalStartTime by remember { mutableLongStateOf(savedState?.optLong("globalStartTime", 0L) ?: 0L) }
    
    var showRating by remember { mutableStateOf(false) }
    var showResetDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

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

    // Persistence Layer
    LaunchedEffect(view, swimmers, isFinished, isGlobalRunning, eventName, heatNumber, raceDistance, squadSize, nameMode, globalStartTime, tossWinner, optedTo) {
        val state = JSONObject().apply {
            put("view", view)
            put("eventName", eventName); put("heatNumber", heatNumber); put("raceDistance", raceDistance)
            put("squadSize", squadSize); put("nameMode", nameMode)
            put("isFinished", isFinished); put("isGlobalRunning", isGlobalRunning); put("globalStartTime", globalStartTime)
            put("tossWinner", tossWinner); put("optedTo", optedTo)
            val arr = JSONArray(); swimmers.forEach { arr.put(it.toJson()) }; put("swimmers", arr)
        }
        context.getSharedPreferences("page_state", android.content.Context.MODE_PRIVATE)
            .edit().putString(PAGE_ID, state.toString()).apply()
    }

    // Precise Timing Engine (Ticker)
    LaunchedEffect(isGlobalRunning) {
        if (isGlobalRunning) {
            while (true) {
                val now = System.currentTimeMillis()
                swimmers = swimmers.map { s ->
                    if (s.isRunning && !s.finished) {
                        s.copy(time = now - globalStartTime)
                    } else s
                }
                delay(16)
            }
        }
    }

    // Ranking Logic (Real-time)
    val rankedSwimmers = remember(swimmers) {
        swimmers.sortedWith(compareByDescending<Swimmer> { it.laps }.thenBy { if (it.time == 0L) Long.MAX_VALUE else it.time })
    }

    // Handlers
    fun handleTouchPad(idx: Int) {
        haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
        val s = swimmers[idx]
        if (s.finished) return

        val newLaps = s.laps + 1
        val newSplits = if (newLaps % 2 == 0) s.splits + s.time else s.splits
        
        swimmers = swimmers.toMutableList().apply {
            this[idx] = s.copy(laps = newLaps, splits = newSplits)
        }
    }

    fun handleFinish(idx: Int) {
        haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
        swimmers = swimmers.toMutableList().apply {
            val s = this[idx]
            this[idx] = s.copy(finished = true, isRunning = false, finishTime = s.time)
        }
        
        if (swimmers.all { it.finished }) {
            isFinished = true
            isGlobalRunning = false
            view = "review"
            scope.launch {
                delay(1500)
                showRating = true
            }
        }
    }

    fun handleToss() {
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
            tossResult = if (winner == "A") (swimmers.getOrNull(0)?.name ?: "Lane 1") else (swimmers.getOrNull(1)?.name ?: "Lane 2")
            isCoinSpinning = false
        }
    }

    fun startRace() {
        haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
        globalStartTime = System.currentTimeMillis()
        swimmers = swimmers.map { it.copy(isRunning = true, time = 0, laps = 0, finished = false, finishTime = null, splits = emptyList()) }
        isGlobalRunning = true
        isFinished = false
    }

    fun resetAll() {
        val runReset = {
            swimmers = (1..squadSize).map { i ->
                Swimmer(id = i.toString(), lane = i, name = if(nameMode == "Auto") "Lane $i" else "")
            }
            isFinished = false
            isGlobalRunning = false
            globalStartTime = 0L
            view = "setup"
            context.getSharedPreferences("page_state", android.content.Context.MODE_PRIVATE).edit().remove(PAGE_ID).apply()
        }
        if (onConfirm != null) {
            onConfirm("Reset race and setup parameters?", runReset, null, "RESET", "CANCEL", true)
        } else {
            showResetDialog = true
        }
    }

    fun syncSquadSize(size: Int) {
        squadSize = size
        swimmers = (1..size).map { i ->
            val existing = swimmers.find { it.lane == i }
            existing ?: Swimmer(id = i.toString(), lane = i, name = if(nameMode == "Auto") "Lane $i" else "")
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        // Professional Header
        Row(
            modifier = Modifier.fillMaxWidth().background(Color(0xFF0F172A)).border(1.dp, theme.colors.border).padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(modifier = Modifier.size(40.dp).clip(RoundedCornerShape(8.dp)).background(Color.White).padding(8.dp), contentAlignment = Alignment.Center) {
                    AsyncImage(model = "file:///android_asset/public/logo.png", contentDescription = "Boxitt", modifier = Modifier.fillMaxSize())
                }
                Column {
                    Text("SWIM PRO", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White, fontStyle = FontStyle.Italic)
                    Text("PRECISION TIMING ENGINE", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
                }
            }
            Box(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(theme.colors.card).clickable { if (view == "live") view = "setup" else onBack() }.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.ChevronLeft, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                    Text(if (view == "live") "SETUP" else "BACK", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 1.sp)
                }
            }
        }

        AnimatedContent(targetState = view, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "RaceTransition") { currentView ->
            when (currentView) {
                "setup" -> SetupView(theme, eventName, { eventName = it }, heatNumber, { heatNumber = it }, raceDistance, { raceDistance = it }, squadSize, { syncSquadSize(it) }, nameMode, { nameMode = it }, swimmers, { id, name -> swimmers = swimmers.map { if(it.id == id) it.copy(name = name) else it } }, { view = "live" }, tossWinner, { tossWinner = it }, optedTo, { optedTo = it }, { showToss = true; tossResult = null; isCoinSpinning = false })
                "live" -> LiveView(theme, eventName, heatNumber, raceDistance, swimmers, rankedSwimmers, isGlobalRunning, { startRace() }, { idx -> handleTouchPad(idx) }, { idx -> handleFinish(idx) }, { resetAll() })
                "review" -> ReviewView(theme, eventName, heatNumber, raceDistance, rankedSwimmers, { view = "setup" })
            }
        }
    }

    if (showResetDialog) {
        AlertDialog(
            onDismissRequest = { showResetDialog = false },
            title = { Text("Reset Race?", fontWeight = FontWeight.Black, color = theme.colors.textPrimary) },
            text = { Text("This will clear all current timers and setup configuration.", color = theme.colors.textSecondary) },
            confirmButton = { TextButton(onClick = { 
                swimmers = (1..squadSize).map { i -> Swimmer(id = i.toString(), lane = i, name = if(nameMode == "Auto") "Lane $i" else "") }
                isFinished = false; isGlobalRunning = false; globalStartTime = 0L; view = "setup"
                showResetDialog = false 
            }) { Text("RESET", color = theme.colors.error, fontWeight = FontWeight.Black) } },
            dismissButton = { TextButton(onClick = { showResetDialog = false }) { Text("CANCEL", color = theme.colors.textDisabled, fontWeight = FontWeight.Black) } },
            containerColor = theme.colors.card
        )
    }

    if (showRating) {
        RatingModal(matchId = location.id + "_swimming_" + System.currentTimeMillis(), locationId = location.id, user = user, onClose = { showRating = false })
    }

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
                    Text("⚡ SWIMMING TOSS ⚡", fontSize = 24.sp, fontWeight = FontWeight.Black, color = Color(0xFFF59E0B))

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
                                Text(swimmers.getOrNull(0)?.name?.ifBlank { "Lane 1" }?.uppercase() ?: "LANE 1", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF78350F), textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 8.dp))
                            }
                        }
                        Box(
                            modifier = Modifier.fillMaxSize().graphicsLayer { rotationY = 180f; alpha = if (!isFront) 1f else 0f }.clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFF3B82F6), Color(0xFF1D4ED8)))).border(8.dp, Color(0xFF60A5FA), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.Person, null, tint = Color.White, modifier = Modifier.size(40.dp))
                                Text(swimmers.getOrNull(1)?.name?.ifBlank { "Lane 2" }?.uppercase() ?: "LANE 2", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 8.dp))
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
                            listOf("Lane choice", "Start Side").forEach { choice ->
                                Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (optedTo == choice) theme.colors.accent else Color.Transparent).clickable { optedTo = choice }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                                    Text(choice.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (optedTo == choice) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                }
                            }
                        }
                    }
                    Button(onClick = { if (tossWinner != null && optedTo != null) showToss = false else handleToss() }, enabled = !isCoinSpinning, modifier = Modifier.fillMaxWidth().height(54.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary), shape = RoundedCornerShape(16.dp)) {
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

// ─── Sub-Composables ─────────────────────────────────────────────────────────

@Composable
fun SetupView(
    theme: com.boxitt.app.theme.AppTheme,
    eventName: String, onEventChange: (String) -> Unit,
    heat: String, onHeatChange: (String) -> Unit,
    distance: String, onDistanceChange: (String) -> Unit,
    squadSize: Int, onSquadSizeChange: (Int) -> Unit,
    nameMode: String, onNameModeChange: (String) -> Unit,
    swimmers: List<Swimmer>, onNameUpdate: (String, String) -> Unit,
    onStart: () -> Unit,
    tossWinner: String?, onTossWinnerChange: (String?) -> Unit,
    optedTo: String?, onOptedToChange: (String?) -> Unit,
    onShowToss: () -> Unit
) {
    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item {
            Text("PRE-RACE SETUP", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
        }
        
        item {
            Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = theme.colors.card), border = BorderStroke(1.dp, theme.colors.border)) {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    SetupField("EVENT NAME", eventName, onEventChange, theme)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(modifier = Modifier.weight(1f)) { SetupField("HEAT NUMBER", heat, onHeatChange, theme) }
                        Box(modifier = Modifier.weight(1f)) { SetupField("DISTANCE", distance, onDistanceChange, theme) }
                    }
                }
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("SQUAD SIZE (1-8 LANES)", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    (1..8).forEach { size ->
                        val isSelected = squadSize == size
                        Box(
                            modifier = Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) theme.colors.accent else theme.colors.card)
                                .border(1.dp, if (isSelected) theme.colors.accent else theme.colors.border, RoundedCornerShape(12.dp))
                                .clickable { onSquadSizeChange(size) },
                            contentAlignment = Alignment.Center
                        ) {
                            Text("$size", fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (isSelected) Color.White else theme.colors.textPrimary)
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
                            Box(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFFD97706)).clickable { onShowToss() }.padding(horizontal = 24.dp, vertical = 12.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Icon(Icons.Default.RotateLeft, null, tint = Color.White, modifier = Modifier.size(16.dp))
                                    Text("SPIN COIN", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 1.sp)
                                }
                            }
                        } else {
                            IconButton(onClick = { onTossWinnerChange(null); onOptedToChange(null) }, modifier = Modifier.size(32.dp)) {
                                Icon(Icons.Default.Refresh, null, tint = theme.colors.textDisabled)
                            }
                        }
                    }

                    if (tossWinner != null) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.success.copy(0.1f)).padding(16.dp), contentAlignment = Alignment.Center) {
                                Text(buildAnnotatedString {
                                    withStyle(SpanStyle(color = theme.colors.textDisabled, fontWeight = FontWeight.Black, fontSize = 9.sp)) { append("WINNER: ") }
                                    withStyle(SpanStyle(color = theme.colors.success, fontWeight = FontWeight.Black, fontSize = 14.sp)) { 
                                        append(if(tossWinner=="A") (swimmers.getOrNull(0)?.name?.uppercase() ?: "LANE 1") else (swimmers.getOrNull(1)?.name?.uppercase() ?: "LANE 2")) 
                                    }
                                })
                            }
                            
                            Text("DECISION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                listOf("Lane choice", "Start Side").forEach { choice ->
                                    Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (optedTo == choice) theme.colors.accent else Color.Transparent).clickable { onOptedToChange(choice) }.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
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
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("ATHLETE REGISTRY", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                    Row(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(8.dp)).padding(2.dp)) {
                        listOf("Auto", "Custom").forEach { mode ->
                            val isSelected = nameMode == mode
                            Box(modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(if(isSelected) theme.colors.accent.copy(0.1f) else Color.Transparent).clickable { onNameModeChange(mode) }.padding(horizontal = 10.dp, vertical = 4.dp)) {
                                Text(mode.uppercase(), fontSize = 8.sp, fontWeight = FontWeight.Black, color = if(isSelected) theme.colors.accent else theme.colors.textDisabled)
                            }
                        }
                    }
                }
                
                swimmers.forEach { swimmer ->
                    Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(14.dp)).padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(modifier = Modifier.size(32.dp).clip(CircleShape).background(theme.colors.background), contentAlignment = Alignment.Center) {
                            Text("${swimmer.lane}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                        }
                        BasicTextField(
                            value = swimmer.name,
                            onValueChange = { onNameUpdate(swimmer.id, it) },
                            textStyle = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary),
                            modifier = Modifier.weight(1f),
                            enabled = nameMode == "Custom"
                        )
                    }
                }
            }
        }

        item {
            Button(
                onClick = onStart,
                modifier = Modifier.fillMaxWidth().height(60.dp),
                shape = RoundedCornerShape(20.dp),
                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent)
            ) {
                Text("INITIALIZE RACE", fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
            }
        }
    }
}

@Composable
fun SetupField(label: String, value: String, onValueChange: (String) -> Unit, theme: com.boxitt.app.theme.AppTheme) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
        Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(theme.colors.background).border(1.dp, theme.colors.border, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp, vertical = 12.dp)) {
            BasicTextField(
                value = value, onValueChange = onValueChange,
                textStyle = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary),
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
fun LiveView(
    theme: com.boxitt.app.theme.AppTheme,
    eventName: String, heat: String, distance: String,
    swimmers: List<Swimmer>, ranked: List<Swimmer>,
    isRunning: Boolean, onStart: () -> Unit,
    onTouch: (Int) -> Unit, onFinish: (Int) -> Unit, onReset: () -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulse by infiniteTransition.animateFloat(
        initialValue = 1f, targetValue = 0.6f,
        animationSpec = infiniteRepeatable(animation = tween(1000), repeatMode = RepeatMode.Reverse),
        label = "pulse"
    )

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(eventName.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(if(isRunning) theme.colors.success else theme.colors.error).alpha(if(isRunning) pulse else 1f))
                        Text(if(isRunning) "STREAMING" else "STANDBY", fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                }
                Text("HEAT $heat • $distance", fontSize = 9.sp, color = theme.colors.textDisabled, fontWeight = FontWeight.Bold)
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
                onClick = onStart,
                enabled = !isRunning,
                modifier = Modifier.weight(1.5f).height(64.dp),
                shape = RoundedCornerShape(20.dp),
                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent)
            ) {
                Icon(Icons.Default.FlashOn, null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("START BUZZER", fontSize = 12.sp, fontWeight = FontWeight.Black)
            }
            Button(
                onClick = onReset,
                modifier = Modifier.weight(1f).height(64.dp),
                shape = RoundedCornerShape(20.dp),
                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.card),
                border = BorderStroke(1.dp, theme.colors.border)
            ) {
                Text("RESET", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
            }
        }

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            itemsIndexed(swimmers) { idx, s ->
                val rank = ranked.indexOfFirst { it.id == s.id } + 1
                LaneCard(theme, s, rank, pulse, { onTouch(idx) }, { onFinish(idx) })
            }
        }
    }
}

@Composable
fun LaneCard(theme: com.boxitt.app.theme.AppTheme, s: Swimmer, rank: Int, pulse: Float, onTouch: () -> Unit, onFinish: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = if(s.finished) theme.colors.card else theme.colors.backgroundSecondary),
        border = BorderStroke(1.dp, if(s.isRunning && !s.finished) theme.colors.accent.copy(pulse) else theme.colors.border)
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(modifier = Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(if(rank == 1 && s.laps > 0) Color(0xFFFFD700) else theme.colors.card), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("LANE", fontSize = 6.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                    Text("${s.lane}", fontSize = 16.sp, fontWeight = FontWeight.Black, color = if(rank == 1 && s.laps > 0) Color.Black else theme.colors.accent)
                }
            }
            
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(s.name.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, maxLines = 1)
                    if (s.laps > 0) {
                        Box(modifier = Modifier.clip(CircleShape).background(theme.colors.accent.copy(0.1f)).padding(horizontal = 6.dp, vertical = 2.dp)) {
                            Text("P$rank", fontSize = 7.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                        }
                    }
                }
                Text(formatSwimTime(if(s.finished) s.finishTime ?: 0L else s.time), fontSize = 20.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = if(s.finished) theme.colors.success else theme.colors.textPrimary)
                if (s.splits.isNotEmpty()) {
                    Text("SPLIT: ${formatSwimTime(s.splits.last())}", fontSize = 8.sp, color = theme.colors.textDisabled, fontWeight = FontWeight.Bold)
                }
            }

            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(theme.colors.card).padding(horizontal = 8.dp, vertical = 4.dp)) {
                    Text("${s.laps} LAPS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(modifier = Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(theme.colors.accent).clickable { onTouch() }, contentAlignment = Alignment.Center) {
                        Text("LAP", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                    Box(modifier = Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(theme.colors.success.copy(if(s.finished) 0.5f else 1f)).clickable(enabled = !s.finished) { onFinish() }, contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Check, null, tint = Color.White, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun ReviewView(
    theme: com.boxitt.app.theme.AppTheme,
    eventName: String, heat: String, distance: String,
    results: List<Swimmer>, onDone: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.EmojiEvents, null, tint = Color(0xFFFFD700), modifier = Modifier.size(48.dp))
            Text("OFFICIAL RESULTS", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = FontStyle.Italic)
            Text("$eventName • HEAT $heat • $distance", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
        }

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            itemsIndexed(results) { idx, s ->
                val isWinner = idx == 0
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = theme.colors.card),
                    border = BorderStroke(1.dp, if(isWinner) Color(0xFFFFD700) else theme.colors.border)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("${idx + 1}", fontSize = 24.sp, fontWeight = FontWeight.Black, color = if(isWinner) Color(0xFFFFD700) else theme.colors.textDisabled)
                            Column(modifier = Modifier.weight(1f)) {
                                Text(s.name.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                Text("LANE ${s.lane} • ${s.laps} LAPS", fontSize = 8.sp, color = theme.colors.textDisabled)
                            }
                            Text(formatSwimTime(s.finishTime ?: 0L), fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                        }
                        if (s.splits.isNotEmpty()) {
                            HorizontalDivider(color = theme.colors.border, thickness = 0.5.dp)
                            Text("SPLIT HISTORY", fontSize = 7.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                            Row(modifier = Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                s.splits.forEachIndexed { sIdx, split ->
                                    Box(modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(theme.colors.background).padding(horizontal = 6.dp, vertical = 2.dp)) {
                                        Text("${(sIdx + 1) * 2}L: ${formatSwimTime(split)}", fontSize = 7.sp, color = theme.colors.textPrimary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Button(
            onClick = onDone,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary)
        ) {
            Text("START NEW RACE", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.background)
        }
    }
}
