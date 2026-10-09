package com.boxitt.app.pages

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.Location
import com.boxitt.app.Match
import com.boxitt.app.SportType
import com.boxitt.app.User
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.Supabase
import com.boxitt.app.services.handleError
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private fun parseIsoTime(isoStr: String): Long {
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        sdf.parse(isoStr)?.time ?: 0L
    } catch (e: Exception) {
        0L
    }
}

private fun isRecentlyFinished(match: Match): Boolean {
    if (match.status.lowercase() != "finished") return true

    val now = System.currentTimeMillis()
    val ONE_HOUR = 60 * 60 * 1000L

    val endTimeStr = match.endTime ?: match.updatedAt ?: match.createdAt
    if (endTimeStr != null) {
        val parsedTime = parseIsoTime(endTimeStr)
        if (parsedTime > 0) {
            return (now - parsedTime) < ONE_HOUR
        }
    }
    return false
}

private fun formatSlotTiming(match: Match): String {
    val startStr = match.startTime
    if (startStr != null) {
        val startMs = parseIsoTime(startStr)
        if (startMs > 0) {
            val dateFmt = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
            val timeFmt = SimpleDateFormat("hh:mm a", Locale.getDefault())
            val datePart = dateFmt.format(Date(startMs))
            val startPart = timeFmt.format(Date(startMs))

            val endStr = match.endTime
            if (endStr != null) {
                val endMs = parseIsoTime(endStr)
                if (endMs > 0) {
                    val endPart = timeFmt.format(Date(endMs))
                    return "$datePart • $startPart - $endPart"
                }
            }
            return "$datePart • $startPart"
        }
    }
    return match.createdAt?.take(10) ?: "N/A"
}

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun Scorer(
    location: Location,
    user: User,
    initialSport: SportType? = null,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onConfirm: ((String, () -> Unit, (() -> Unit)?, String?, String?, Boolean?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val PAGE_ID = "scorer_${location.id}"

    val savedState = remember {
        val raw = context.getSharedPreferences("page_state", android.content.Context.MODE_PRIVATE).getString(PAGE_ID, null)
        if (raw != null) {
            try { JSONObject(raw) } catch (e: Exception) { null }
        } else null
    }

    fun getValidSport(sport: SportType?): SportType? {
        if (sport == null) return null
        if (location.supportedSports.isEmpty()) return sport
        return location.supportedSports.find { it == sport }
    }

    val effectiveInitialSport = remember(initialSport, location.supportedSports) {
        getValidSport(initialSport)
    }

    var selectedSport by remember(location.id) {
        mutableStateOf<SportType?>(null)
    }

    // Active Live Matches
    var liveMatches by remember { mutableStateOf<List<Match>>(emptyList()) }
    var loadingMatches by remember { mutableStateOf(true) }

    // Scorer History State
    var showHistory by remember { mutableStateOf(false) }
    var historyMatches by remember { mutableStateOf<List<Match>>(emptyList()) }
    var loadingHistory by remember { mutableStateOf(false) }
    var loadingMoreHistory by remember { mutableStateOf(false) }
    var hasMoreHistory by remember { mutableStateOf(true) }
    var historyPage by remember { mutableStateOf(0) }
    val HISTORY_PAGE_SIZE = 20

    fun openScorerHistory() {
        showHistory = true
        loadingHistory = true
        historyPage = 0
        hasMoreHistory = true
        scope.launch {
            try {
                val data = Supabase.client.postgrest["matches"].select {
                    filter {
                        eq("location_id", location.id)
                        eq("status", "finished")
                    }
                    order("created_at", Order.DESCENDING)
                    range(0L, (HISTORY_PAGE_SIZE - 1).toLong())
                }.decodeList<Match>()

                historyMatches = data
                if (data.size < HISTORY_PAGE_SIZE) {
                    hasMoreHistory = false
                }
            } catch (e: Exception) {
                android.util.Log.e("Scorer", "Error fetching history", e)
            } finally {
                loadingHistory = false
            }
        }
    }

    fun loadMoreHistory() {
        if (loadingMoreHistory || !hasMoreHistory) return
        loadingMoreHistory = true
        val nextPage = historyPage + 1
        val from = (nextPage * HISTORY_PAGE_SIZE).toLong()
        val to = (from + HISTORY_PAGE_SIZE - 1).toLong()

        scope.launch {
            try {
                val newMatches = Supabase.client.postgrest["matches"].select {
                    filter {
                        eq("location_id", location.id)
                        eq("status", "finished")
                    }
                    order("created_at", Order.DESCENDING)
                    range(from, to)
                }.decodeList<Match>()

                if (newMatches.isNotEmpty()) {
                    historyMatches = historyMatches + newMatches
                    historyPage = nextPage
                }
                if (newMatches.size < HISTORY_PAGE_SIZE) {
                    hasMoreHistory = false
                }
            } catch (e: Exception) {
                android.util.Log.e("Scorer", "Error loading more history", e)
            } finally {
                loadingMoreHistory = false
            }
        }
    }

    LaunchedEffect(location.id) {
        loadingMatches = true
        try {
            val data = Supabase.client.postgrest["matches"].select {
                filter {
                    eq("location_id", location.id)
                    isIn("status", listOf("live", "not started", "finished"))
                }
            }.decodeList<Match>()
            liveMatches = data.filter { isRecentlyFinished(it) }
        } catch (e: Exception) {
            android.util.Log.e("Scorer", "Error fetching matches", e)
        } finally {
            loadingMatches = false
        }
    }

    LaunchedEffect(selectedSport) {
        val json = JSONObject().apply {
            put("selectedSport", selectedSport?.name)
        }
        context.getSharedPreferences("page_state", android.content.Context.MODE_PRIVATE)
            .edit().putString(PAGE_ID, json.toString()).apply()
    }

    val sportsList = remember(location.supportedSports, effectiveInitialSport) {
        val list = if (location.supportedSports.isNotEmpty()) {
            location.supportedSports.toMutableList()
        } else {
            SportType.values().toList().toMutableList()
        }
        if (effectiveInitialSport != null) {
            list.sortWith(Comparator { a, b ->
                val aMatches = a == effectiveInitialSport
                val bMatches = b == effectiveInitialSport
                if (aMatches && !bMatches) -1
                else if (!aMatches && bMatches) 1
                else 0
            })
        }
        list
    }

    fun handleBackClick() {
        if (showHistory) {
            showHistory = false
        } else if (selectedSport != null) {
            selectedSport = null
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        // Background Decorative Elements
        Box(
            modifier = Modifier
                .offset(x = (-100).dp, y = (-100).dp)
                .size(400.dp)
                .blur(120.dp)
                .clip(CircleShape)
                .background(theme.colors.accent.copy(alpha = 0.2f))
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = 100.dp, y = 100.dp)
                .size(300.dp)
                .blur(100.dp)
                .clip(CircleShape)
                .background(theme.colors.success.copy(alpha = 0.2f))
        )

        AnimatedContent(
            targetState = Pair(showHistory, selectedSport),
            transitionSpec = { fadeIn() with fadeOut() },
            label = "ScorerContent"
        ) { (inHistory, sport) ->
            if (inHistory) {
                // Full Screen Scorer History View
                val gridState = rememberLazyGridState()

                LaunchedEffect(gridState) {
                    snapshotFlow { gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
                        .collect { lastIndex ->
                            if (lastIndex != null && lastIndex >= historyMatches.size - 4 && hasMoreHistory && !loadingMoreHistory) {
                                loadMoreHistory()
                            }
                        }
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp)
                ) {
                    // Header with Back Button
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 24.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(theme.colors.card)
                                .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                                .clickable { handleBackClick() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.ArrowBack,
                                contentDescription = "Back",
                                tint = theme.colors.textPrimary
                            )
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(
                                text = buildAnnotatedString {
                                    append("SCORER ")
                                    withStyle(SpanStyle(color = theme.colors.accent)) {
                                        append("HISTORY")
                                    }
                                },
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Black,
                                fontStyle = FontStyle.Italic,
                                color = theme.colors.textPrimary
                            )
                            Text(
                                text = "${location.name.uppercase()} • ARCHIVES",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.colors.textDisabled,
                                letterSpacing = 2.sp
                            )
                        }
                    }

                    if (loadingHistory) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = theme.colors.accent)
                        }
                    } else if (historyMatches.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 40.dp)
                                .clip(RoundedCornerShape(24.dp))
                                .background(theme.colors.card.copy(alpha = 0.3f))
                                .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
                                .padding(32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "NO COMPLETED MATCHES FOUND",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 2.sp
                            )
                        }
                    } else {
                        // 2-Column Grid Layout for Scorer History
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(2),
                            state = gridState,
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(historyMatches, key = { it.id }) { match ->
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(theme.radius.large))
                                        .background(theme.colors.card)
                                        .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
                                        .padding(20.dp),
                                    verticalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = match.sport.uppercase(),
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Black,
                                            color = theme.colors.textDisabled
                                        )
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(50.dp))
                                                .background(theme.colors.backgroundSecondary)
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Text(
                                                text = "FINISHED",
                                                fontSize = 8.sp,
                                                fontWeight = FontWeight.Black,
                                                color = theme.colors.textDisabled
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))

                                    Text(
                                        text = "${match.teamAName} VS ${match.teamBName}".uppercase(),
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Black,
                                        fontStyle = FontStyle.Italic,
                                        color = theme.colors.textPrimary,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )

                                    Spacer(modifier = Modifier.height(16.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(10.dp))
                                                .background(theme.colors.backgroundSecondary)
                                                .padding(horizontal = 10.dp, vertical = 6.dp)
                                        ) {
                                            Text(
                                                text = "${match.scoreA} - ${match.scoreB}",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Black,
                                                color = theme.colors.accent
                                            )
                                        }
                                        Text(
                                            text = formatSlotTiming(match),
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = theme.colors.textPrimary
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(16.dp))

                                    Button(
                                        onClick = {
                                            showHistory = false
                                            selectedSport = SportType.values().find { it.value.lowercase() == match.sport.lowercase() } ?: SportType.CRICKET
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.Center
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.BarChart,
                                                contentDescription = null,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                text = "PERFORMANCE",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Black,
                                                letterSpacing = 1.sp
                                            )
                                        }
                                    }
                                }
                            }

                            if (loadingMoreHistory) {
                                item(span = { GridItemSpan(2) }) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 16.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            CircularProgressIndicator(
                                                color = theme.colors.accent,
                                                modifier = Modifier.size(20.dp),
                                                strokeWidth = 2.dp
                                            )
                                            Spacer(modifier = Modifier.width(12.dp))
                                            Text(
                                                text = "LOADING 20 MORE MATCHES...",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Black,
                                                color = theme.colors.textDisabled
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (sport == null) {
                // Match Board Main View
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    contentPadding = PaddingValues(vertical = 16.dp)
                ) {
                    item {
                        Column(modifier = Modifier.padding(bottom = 16.dp)) {
                            Text(
                                text = buildAnnotatedString {
                                    append("MATCH ")
                                    withStyle(SpanStyle(color = theme.colors.accent)) {
                                        append("BOARD")
                                    }
                                },
                                fontSize = 40.sp,
                                fontWeight = FontWeight.Black,
                                fontStyle = FontStyle.Italic,
                                color = theme.colors.textPrimary
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50.dp))
                                    .background(theme.colors.backgroundSecondary)
                                    .border(1.dp, theme.colors.border, RoundedCornerShape(50.dp))
                                    .padding(horizontal = 16.dp, vertical = 8.dp)
                            ) {
                                Text(
                                    text = location.name.uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.colors.textDisabled,
                                    letterSpacing = 2.sp
                                )
                            }
                        }
                    }

                    // Live / Active Matches section if present
                    if (liveMatches.isNotEmpty()) {
                        item {
                            Text(
                                text = "UPCOMING & LIVE MATCHES",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 2.sp,
                                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                            )
                        }

                        itemsIndexed(liveMatches) { _, match ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(theme.radius.large))
                                    .background(theme.colors.card)
                                    .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
                                    .padding(20.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = match.sport.uppercase(),
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.colors.textDisabled
                                    )
                                    Text(
                                        text = "${match.teamAName} VS ${match.teamBName}".uppercase(),
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Black,
                                        fontStyle = FontStyle.Italic,
                                        color = theme.colors.textPrimary
                                    )
                                    Text(
                                        text = "SCORE: ${match.scoreA} - ${match.scoreB}",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = theme.colors.accent,
                                        modifier = Modifier.padding(top = 4.dp)
                                    )
                                }
                                Button(
                                    onClick = {
                                        selectedSport = SportType.values().find { it.value.lowercase() == match.sport.lowercase() } ?: SportType.CRICKET
                                    },
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary)
                                ) {
                                    Text(
                                        text = "RESUME",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.colors.background
                                    )
                                }
                            }
                        }
                    }

                    item {
                        Text(
                            text = "INITIALIZE MANUAL MATCH",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textDisabled,
                            letterSpacing = 2.sp,
                            modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
                        )
                    }

                    // Sports cards + Scorer History in 2-column layout (rendered as pairs)
                    val allCards = sportsList.map { s ->
                        Pair(s.value.uppercase(), "START MATCH SCORING") to { selectedSport = s }
                    } + Pair("SCORER HISTORY", "VIEW PAST COMPLETED MATCHES") to { openScorerHistory() }

                    itemsIndexed(allCards.chunked(2)) { _, chunk ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            for ((cardInfo, onClick) in chunk) {
                                val (title, subtitle) = cardInfo
                                val isHistory = title == "SCORER HISTORY"

                                Row(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(theme.radius.large))
                                        .background(theme.colors.card)
                                        .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
                                        .clickable { onClick() }
                                        .padding(20.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = title,
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Black,
                                            color = theme.colors.textPrimary,
                                            letterSpacing = 1.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = subtitle,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = theme.colors.textDisabled,
                                            modifier = Modifier.padding(top = 4.dp),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }

                                    Spacer(modifier = Modifier.width(8.dp))

                                    Box(
                                        modifier = Modifier
                                            .size(44.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(theme.colors.backgroundSecondary)
                                            .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = if (isHistory) Icons.Default.History else Icons.Default.KeyboardArrowRight,
                                            contentDescription = null,
                                            tint = if (isHistory) theme.colors.accent else theme.colors.textDisabled
                                        )
                                    }
                                }
                            }
                            // Fill remaining space if odd number of items in row
                            if (chunk.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            } else {
                // Render appropriate sport scorer
                Box(modifier = Modifier.fillMaxSize()) {
                    var renderError by remember(sport) { mutableStateOf<String?>(null) }

                    if (renderError != null) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(40.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = renderError!!.uppercase(),
                                color = theme.colors.error,
                                fontWeight = FontWeight.Black,
                                fontStyle = FontStyle.Italic,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                            Text(
                                text = "BACK TO SELECTION",
                                color = theme.colors.accent,
                                fontWeight = FontWeight.Black,
                                fontSize = 12.sp,
                                letterSpacing = 2.sp,
                                modifier = Modifier.clickable { selectedSport = null }
                            )
                        }
                    } else {
                        CompositionLocalProvider {
                            when (sport) {
                                SportType.CRICKET -> CricketScorer(
                                    location = location, user = user,
                                    onAlert = onAlert, onBack = { selectedSport = null }
                                )
                                SportType.FOOTBALL -> FootballScorer(
                                    location = location, user = user,
                                    onAlert = onAlert, onBack = { selectedSport = null }
                                )
                                SportType.BASKETBALL -> BasketballScorer(
                                    location = location, user = user,
                                    onAlert = onAlert, onBack = { selectedSport = null }
                                )
                                SportType.TENNIS -> TennisScorer(
                                    location = location, user = user,
                                    onAlert = onAlert, onBack = { selectedSport = null }
                                )
                                SportType.BADMINTON, SportType.PICKLEBALL -> BadmintonScorer(
                                    location = location, user = user,
                                    onAlert = onAlert, onBack = { selectedSport = null }
                                )
                                SportType.SWIMMING -> SwimmingScorer(
                                    location = location, user = user,
                                    onBack = { selectedSport = null },
                                    onAlert = onAlert,
                                    onConfirm = onConfirm
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
