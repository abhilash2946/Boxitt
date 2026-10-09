package com.boxitt.app.pages

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.*
import com.boxitt.app.components.DurationOption
import com.boxitt.app.components.DurationPickerModal
import com.boxitt.app.components.PaymentPage
import com.boxitt.app.contexts.LocalTheme
import com.boxitt.app.services.BookingService
import com.boxitt.app.services.GameZoneService
import kotlinx.coroutines.launch
import java.util.Calendar

enum class GameZoneStep { PLATFORM, STATION, TIME_GAME, PAYMENT }

fun formatHourToStr(hDecimal: Double): String {
    val totalMins = Math.round(hDecimal * 60).toInt()
    val h24 = (totalMins / 60) % 24
    val mins = totalMins % 60
    val ampm = if (h24 >= 12) "PM" else "AM"
    var h12 = h24 % 12
    if (h12 == 0) h12 = 12
    val minsStr = if (mins < 10) "0$mins" else "$mins"
    return "$h12:$minsStr $ampm"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameZoneBooking(
    location: Location,
    user: UserProfile?,
    onBack: () -> Unit,
    onAlert: (String, String) -> Unit,
    onSuccess: (Booking) -> Unit
) {
    val theme = LocalTheme.current
    val coroutineScope = rememberCoroutineScope()

    var step by remember { mutableStateOf(GameZoneStep.PLATFORM) }

    var platforms by remember { mutableStateOf<List<GameZonePlatform>>(emptyList()) }
    var resources by remember { mutableStateOf<List<GameZoneResource>>(emptyList()) }
    var games by remember { mutableStateOf<List<GameZoneGame>>(emptyList()) }
    var existingBookings by remember { mutableStateOf<List<Booking>>(emptyList()) }
    var pricingRules by remember { mutableStateOf<List<Pricing>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isSubmitting by remember { mutableStateOf(false) }

    var selectedPlatform by remember { mutableStateOf<GameZonePlatform?>(null) }
    var selectedResource by remember { mutableStateOf<GameZoneResource?>(null) }
    var selectedDate by remember { mutableStateOf(Constants.getLocalISODate()) }
    var selectedDuration by remember { mutableStateOf("1 hr") }
    var showDurationPicker by remember { mutableStateOf(false) }
    var selectedStartHour by remember { mutableStateOf<Double?>(null) }
    var selectedGame by remember { mutableStateOf<String?>(null) }
    var playerCount by remember { mutableStateOf(2) }

    var name by remember { mutableStateOf(user?.displayName ?: "") }
    var phone by remember { mutableStateOf(user?.phoneNumber ?: "") }

    // Load Game Zone catalog and pricing from Supabase
    LaunchedEffect(location.id, selectedDate) {
        isLoading = true
        coroutineScope.launch {
            platforms = GameZoneService.getPlatforms(location.id)
            resources = GameZoneService.getResources(location.id)
            games = GameZoneService.getGames(location.id)
            existingBookings = BookingService.getBookings(location.id, selectedDate)
            pricingRules = com.boxitt.app.services.PricingService.getPricingForLocation(location.id)
            isLoading = false
        }
    }

    val activePlatformResources = remember(resources, selectedPlatform) {
        if (selectedPlatform == null) emptyList()
        else resources.filter {
            it.platform_type.lowercase() == selectedPlatform?.name?.lowercase() ||
            it.platform_id == selectedPlatform?.id
        }
    }

    val durationHours = remember(selectedDuration) {
        val numberMatch = Regex("""\d+(\.\d+)?""").find(selectedDuration)?.value?.toDoubleOrNull()
        if (numberMatch != null && numberMatch > 0.0) {
            numberMatch
        } else when {
            selectedDuration.contains("1.5") -> 1.5
            selectedDuration.contains("2") -> 2.0
            selectedDuration.contains("3") -> 3.0
            else -> 1.0
        }
    }

    val stationPricingRules = remember(pricingRules, selectedResource) {
        if (selectedResource == null || pricingRules.isEmpty()) pricingRules
        else {
            val matched = pricingRules.filter { it.court_id == selectedResource?.id }
            if (matched.isNotEmpty()) matched else pricingRules
        }
    }

    val availableDurations = remember(stationPricingRules) {
        if (stationPricingRules.isEmpty()) {
            Constants.DURATIONS.map { dur ->
                val label = when {
                    dur.contains("1.5") -> "1.5 Hours"
                    dur.contains("2") -> "2 Hours"
                    dur.contains("3") -> "3 Hours"
                    else -> "1 Hour"
                }
                DurationOption(dur, label)
            }
        } else {
            val uniqueHours = stationPricingRules.map { it.duration_hours }.distinct().sorted()
            uniqueHours.map { h ->
                val valStr = if (h == h.toInt().toDouble()) "${h.toInt()} hr${if (h > 1) "s" else ""}" else "$h hrs"
                val labelStr = if (h == h.toInt().toDouble()) "${h.toInt()} ${if (h == 1.0) "Hour" else "Hours"}" else "$h Hours"
                DurationOption(valStr, labelStr)
            }
        }
    }

    LaunchedEffect(availableDurations) {
        if (availableDurations.isNotEmpty()) {
            val exists = availableDurations.any { it.value == selectedDuration }
            if (!exists) {
                selectedDuration = availableDurations.first().value
                selectedStartHour = null
            }
        }
    }

    val activePricingRule = remember(stationPricingRules, durationHours) {
        stationPricingRules.find { it.duration_hours == durationHours }
    }

    var paymentChoice by remember { mutableStateOf(PaymentType.ADVANCE) }
    var showConfirmDialog by remember { mutableStateOf(false) }

    val totalPrice: Int? = remember(activePricingRule) {
        activePricingRule?.price?.toInt()
    }

    val calculatedAdvancePrice: Int? = remember(totalPrice, activePricingRule, location) {
        if (totalPrice == null) null
        else if (activePricingRule?.advance_price != null) activePricingRule.advance_price.toInt()
        else if (location.minAdvance != null && location.minAdvance > 0) location.minAdvance.toInt()
        else totalPrice
    }

    val advancePaidAmount: Int? = remember(paymentChoice, totalPrice, calculatedAdvancePrice) {
        if (paymentChoice == PaymentType.FULL) totalPrice else calculatedAdvancePrice
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // Header Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                onClick = {
                    when (step) {
                        GameZoneStep.TIME_GAME -> step = GameZoneStep.STATION
                        GameZoneStep.STATION -> step = GameZoneStep.PLATFORM
                        GameZoneStep.PAYMENT -> step = GameZoneStep.TIME_GAME
                        else -> onBack()
                    }
                },
                shape = RoundedCornerShape(12.dp),
                color = theme.colors.card,
                border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = theme.colors.accent,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "BACK",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "GAME ZONE",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.accent
                )
                Text(
                    text = location.name,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.colors.textDisabled
                )
            }
        }

        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = theme.colors.accent)
            }
        } else {
            when (step) {
                GameZoneStep.PLATFORM -> {
                    Text(
                        text = "CHOOSE GAMING EXPERIENCE",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                    Text(
                        text = "Select your preferred gaming platform",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.colors.textDisabled,
                        modifier = Modifier.padding(bottom = 16.dp)
                    )

                    if (platforms.isEmpty()) {
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 32.dp),
                            shape = RoundedCornerShape(20.dp),
                            color = theme.colors.card,
                            border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
                        ) {
                            Text(
                                text = "No gaming platforms configured at this location yet.",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.colors.textDisabled,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(24.dp)
                            )
                        }
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            platforms.forEach { platform ->
                                val platformRes = resources.filter {
                                    it.platform_type.lowercase() == platform.name.lowercase() ||
                                    it.platform_id == platform.id
                                }
                                val activeCount = platformRes.count { it.status == "ACTIVE" }

                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            selectedPlatform = platform
                                            selectedResource = null
                                            step = GameZoneStep.STATION
                                        },
                                    shape = RoundedCornerShape(20.dp),
                                    color = theme.colors.card,
                                    border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(20.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = platform.icon ?: "🎮",
                                                fontSize = 32.sp
                                            )
                                            Column {
                                                Text(
                                                    text = platform.name,
                                                    fontSize = 18.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = theme.colors.textPrimary
                                                )
                                                Text(
                                                    text = platform.description ?: "Gaming setup",
                                                    fontSize = 11.sp,
                                                    color = theme.colors.textSecondary
                                                )
                                            }
                                        }

                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = if (activeCount > 0) Color(0x2210B981) else Color(0x22EF4444)
                                        ) {
                                            Text(
                                                text = "$activeCount available",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Black,
                                                color = if (activeCount > 0) Color(0xFF10B981) else Color(0xFFEF4444),
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                GameZoneStep.STATION -> {
                    Text(
                        text = "SELECT GAMING STATION",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                    Text(
                        text = "Platform: ${selectedPlatform?.name}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.colors.accent,
                        modifier = Modifier.padding(bottom = 16.dp)
                    )

                    if (activePlatformResources.isEmpty()) {
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 32.dp),
                            shape = RoundedCornerShape(20.dp),
                            color = theme.colors.card,
                            border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
                        ) {
                            Text(
                                text = "No gaming stations available for ${selectedPlatform?.name}.",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.colors.textDisabled,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(24.dp)
                            )
                        }
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            activePlatformResources.forEach { res ->
                                val isActive = res.status == "ACTIVE"
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable(enabled = isActive) {
                                            selectedResource = res
                                            playerCount = minOf(2, res.max_players)
                                            step = GameZoneStep.TIME_GAME
                                        },
                                    shape = RoundedCornerShape(20.dp),
                                    color = if (isActive) theme.colors.card else theme.colors.card.copy(alpha = 0.5f),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
                                ) {
                                    Column(modifier = Modifier.padding(20.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = res.name,
                                                fontSize = 20.sp,
                                                fontWeight = FontWeight.Black,
                                                color = theme.colors.textPrimary
                                            )
                                            Surface(
                                                shape = RoundedCornerShape(12.dp),
                                                color = if (isActive) Color(0x2210B981) else Color(0x22EF4444)
                                            ) {
                                                Text(
                                                    text = res.status,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = if (isActive) Color(0xFF10B981) else Color(0xFFEF4444),
                                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                                )
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(12.dp))

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = "Up to ${res.max_players} Players",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = theme.colors.textSecondary
                                            )
                                            Text(
                                                text = "₹${res.price.toInt()} / hr",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Black,
                                                color = Color(0xFF10B981)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                GameZoneStep.TIME_GAME -> {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = theme.colors.card,
                        border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "${selectedResource?.name} (${selectedPlatform?.name})",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.colors.textPrimary
                                )
                                Text(
                                    text = "₹${selectedResource?.price?.toInt()} / hour",
                                    fontSize = 11.sp,
                                    color = theme.colors.textDisabled
                                )
                            }
                            TextButton(onClick = { step = GameZoneStep.STATION }) {
                                Text(
                                    text = "CHANGE",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.colors.accent
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "DURATION & START TIME",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textSecondary,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(theme.colors.card)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(14.dp))
                            .clickable { showDurationPicker = true }
                            .padding(14.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val selectedLabel = availableDurations.find { it.value == selectedDuration }?.label
                                ?: run {
                                    val numberMatch = Regex("""\d+(\.\d+)?""").find(selectedDuration)?.value
                                    if (numberMatch != null) "$numberMatch Hours" else "1 Hour"
                                }
                            Text(
                                text = selectedLabel,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.colors.textPrimary
                            )
                            Icon(
                                imageVector = Icons.Default.ExpandMore,
                                contentDescription = null,
                                tint = theme.colors.accent,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    if (showDurationPicker) {
                        val durationOptions = if (availableDurations.isNotEmpty()) availableDurations else Constants.DURATIONS.map { dur ->
                            val numberMatch = Regex("""\d+(\.\d+)?""").find(dur)?.value
                            val label = if (numberMatch != null) "$numberMatch Hours" else "1 Hour"
                            DurationOption(dur, label)
                        }
                        DurationPickerModal(
                            isOpen = showDurationPicker,
                            onClose = { showDurationPicker = false },
                            options = durationOptions,
                            selectedValue = selectedDuration,
                            onSelect = {
                                selectedDuration = it
                                selectedStartHour = null
                            }
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Time Slot Grid
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (selectedDate.isBlank()) {
                            Text(
                                text = "NO SLOTS AVAILABLE",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled
                            )
                        } else {
                            val currentHour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
                            var h = Constants.DAY_START_HOUR.toDouble()
                            val maxH = Constants.DAY_END_HOUR.toDouble() - durationHours
                            val step = if (durationHours <= 0.5) durationHours else 0.5
                            while (h <= maxH + 0.0001) {
                                val currentSlotH = h
                                val endH = currentSlotH + durationHours
                                val startStr = formatHourToStr(currentSlotH)
                                val endStr = formatHourToStr(endH)
                                val label = "$startStr - $endStr"

                                val isPast = selectedDate == Constants.getLocalISODate() && currentSlotH <= currentHour
                                val isBookedSlot = existingBookings.any { b ->
                                    (b.resourceId == selectedResource?.id || b.courtId == selectedResource?.id) &&
                                    (currentSlotH < b.endHour && endH > b.startHour)
                                }
                                val isBooked = isBookedSlot || isPast

                                val isSelected = selectedStartHour == currentSlotH

                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable(enabled = !isBooked) {
                                            selectedStartHour = currentSlotH
                                        },
                                    shape = RoundedCornerShape(12.dp),
                                    color = when {
                                        isBooked -> theme.colors.card.copy(alpha = 0.3f)
                                        isSelected -> Color(0xFF10B981)
                                        else -> theme.colors.card
                                    },
                                    border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
                                ) {
                                    Text(
                                        text = if (isBooked) "$label (BOOKED)" else label,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Black,
                                        color = when {
                                            isBooked -> theme.colors.textDisabled
                                            isSelected -> Color.White
                                            else -> theme.colors.textPrimary
                                        },
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.padding(14.dp)
                                    )
                                }
                                h += step
                            }
                        }
                    }
                            }
                            h += step
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Game Choice Section
                    Text(
                        text = "CHOOSE GAME (OPTIONAL)",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textSecondary,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )

                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            Surface(
                                modifier = Modifier.clickable { selectedGame = null },
                                shape = RoundedCornerShape(14.dp),
                                color = if (selectedGame == null) theme.colors.accent else theme.colors.card,
                                border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
                            ) {
                                Text(
                                    text = "Skip Choice",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (selectedGame == null) Color.White else theme.colors.textSecondary,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                                )
                            }
                        }

                        val availableGames = games.ifEmpty {
                            listOf(
                                GameZoneGame(id = "1", location_id = location.id, title = "EA FC 24"),
                                GameZoneGame(id = "2", location_id = location.id, title = "Tekken 8"),
                                GameZoneGame(id = "3", location_id = location.id, title = "GTA V")
                            )
                        }

                        items(availableGames) { g ->
                            Surface(
                                modifier = Modifier.clickable { selectedGame = g.title },
                                shape = RoundedCornerShape(14.dp),
                                color = if (selectedGame == g.title) theme.colors.accent else theme.colors.card,
                                border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
                            ) {
                                Text(
                                    text = "🎮 ${g.title}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (selectedGame == g.title) Color.White else theme.colors.textSecondary,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Player Count
                    Text(
                        text = "NUMBER OF PLAYERS (MAX ${selectedResource?.max_players ?: 4})",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textSecondary,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier
                            .background(theme.colors.card, RoundedCornerShape(16.dp))
                            .padding(8.dp)
                    ) {
                        IconButton(onClick = { playerCount = maxOf(1, playerCount - 1) }) {
                            Icon(imageVector = Icons.Default.Remove, contentDescription = "Decrease", tint = theme.colors.textPrimary)
                        }
                        Text(
                            text = "$playerCount",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.accent
                        )
                        IconButton(onClick = { playerCount = minOf(selectedResource?.max_players ?: 4, playerCount + 1) }) {
                            Icon(imageVector = Icons.Default.Add, contentDescription = "Increase", tint = theme.colors.textPrimary)
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Gamer Contact & Price Total
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        color = theme.colors.card,
                        border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border)
                    ) {
                        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(
                                text = "GAMER DETAILS",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textSecondary
                            )

                            OutlinedTextField(
                                value = name,
                                onValueChange = { name = it },
                                label = { Text("Full Name") },
                                modifier = Modifier.fillMaxWidth()
                            )

                            OutlinedTextField(
                                value = phone,
                                onValueChange = { phone = it },
                                label = { Text("Phone Number") },
                                modifier = Modifier.fillMaxWidth()
                            )

                            Spacer(modifier = Modifier.height(12.dp))

                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    text = "PAYMENT OPTION",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.colors.textDisabled,
                                    letterSpacing = 1.sp
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.backgroundSecondary.copy(0.4f)).border(1.dp, theme.colors.border.copy(0.2f), RoundedCornerShape(16.dp)).padding(6.dp),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    val options = listOf(
                                        PaymentType.ADVANCE to ("ADVANCE PAYMENT" to "₹${calculatedAdvancePrice ?: 0}"),
                                        PaymentType.FULL to ("FULL PAYMENT" to "₹${totalPrice ?: 0}")
                                    )
                                    options.forEach { (type, textPair) ->
                                        Box(
                                            modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (paymentChoice == type) theme.colors.accent else Color.Transparent).clickable { paymentChoice = type }.padding(vertical = 8.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(textPair.first, fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (paymentChoice == type) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                                Text(textPair.second, fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (paymentChoice == type) Color.White else theme.colors.accent)
                                            }
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Button(
                                onClick = {
                                    if (selectedStartHour == null) {
                                        onAlert("Error", "Please select a start time")
                                        return@Button
                                    }
                                    if (name.isBlank() || phone.isBlank()) {
                                        onAlert("Error", "Please enter your name and phone number")
                                        return@Button
                                    }
                                    showConfirmDialog = true
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent)
                            ) {
                                Text(
                                    text = "CONFIRM GAMING SESSION →",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                        }
                    }
                }

                GameZoneStep.PAYMENT -> {
                    selectedStartHour?.let { startH ->
                        val endH = startH + durationHours
                        val startStr = formatHourToStr(startH.toDouble())
                        val endStr = formatHourToStr(endH)
                        val slotTimeStr = "$startStr - $endStr"
                        val payableNow = (advancePaidAmount ?: totalPrice ?: 0).toDouble()

                        PaymentPage(
                            amount = payableNow,
                            bookingId = "GZ-${(1000..9999).random()}",
                            locationName = location.name,
                            courtName = "${selectedResource?.name} (${selectedPlatform?.name})",
                            date = selectedDate,
                            slotTime = slotTimeStr,
                            totalFee = (totalPrice ?: 0).toDouble(),
                            onBack = { step = GameZoneStep.TIME_GAME },
                            onPay = {
                                isSubmitting = true
                                coroutineScope.launch {
                                    val newBooking = Booking(
                                        id = "",
                                        name = name,
                                        phone = phone,
                                        date = selectedDate,
                                        locationId = location.id,
                                        resourceId = selectedResource?.id,
                                        platformId = selectedPlatform?.id,
                                        selectedGame = selectedGame,
                                        slotId = "slot-$startH",
                                        slotTime = slotTimeStr,
                                        startHour = startH.toDouble(),
                                        endHour = endH,
                                        duration = durationHours.toString(),
                                        amount = (totalPrice ?: 0).toDouble(),
                                        advancePaid = payableNow,
                                        status = BookingStatus.BOOKED,
                                        paymentMethod = "Online",
                                        paymentType = "advance",
                                        checkedIn = false,
                                        createdAt = "",
                                        bookedBy = "user",
                                        sport = "Game Zone",
                                        userId = user?.id,
                                        isJoinable = false,
                                        maxPlayers = selectedResource?.max_players ?: 4,
                                        currentPlayers = playerCount
                                    )

                                    val res = BookingService.saveBooking(newBooking)
                                    isSubmitting = false
                                    if (res.isSuccess) {
                                        val created = res.getOrThrow()
                                        existingBookings = listOf(created) + existingBookings
                                        onAlert("Success", "Gaming session booked successfully!")
                                        onSuccess(created)
                                    } else {
                                        onAlert("Error", res.exceptionOrNull()?.message ?: "Booking failed")
                                    }
                                }
                            },
                            isLoading = isSubmitting
                        )
                    }
                }
                                        onAlert("Success", "Gaming session booked successfully!")
                                        onSuccess(res.getOrThrow())
                                    } else {
                                        onAlert("Error", res.exceptionOrNull()?.message ?: "Booking failed")
                                    }
                                }
                            },
                            isLoading = isSubmitting
                        )
                    }
                }
            }
        }
    }

    if (showConfirmDialog && selectedStartHour != null) {
        val endH = selectedStartHour!! + durationHours
        val startStr = formatHourToStr(selectedStartHour!!.toDouble())
        val endStr = formatHourToStr(endH)
        val slotTimeStr = "$startStr - $endStr"
        val payableNow = (advancePaidAmount ?: totalPrice ?: 0)

        androidx.compose.ui.window.Dialog(
            onDismissRequest = { showConfirmDialog = false },
            properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(28.dp)).padding(28.dp)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)).background(theme.colors.accent), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.CheckCircle, null, tint = Color.White, modifier = Modifier.size(32.dp))
                    }
                    Spacer(Modifier.height(16.dp))
                    Text("PAYMENT SUMMARY", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)
                    Spacer(Modifier.height(16.dp))
                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.backgroundSecondary.copy(0.4f)).border(1.dp, theme.colors.border.copy(0.2f), RoundedCornerShape(16.dp)).padding(16.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("STATION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text("${selectedPlatform?.name ?: "Platform"} • ${selectedResource?.name ?: "Station"}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("DATE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text(selectedDate, fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("TIME SLOT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text(slotTimeStr, fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("DURATION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text(selectedDuration, fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("GAME", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text(selectedGame ?: "Choose at venue", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textSecondary)
                            }
                            HorizontalDivider(color = theme.colors.border.copy(0.2f))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("TOTAL FEE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text("₹${totalPrice ?: 0}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("PAYABLE NOW", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 1.sp)
                                Text("₹$payableNow", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = {
                            showConfirmDialog = false
                            step = GameZoneStep.PAYMENT
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent)
                    ) {
                        Text("PAY NOW", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                    }
                    TextButton(onClick = { showConfirmDialog = false }) { Text("Discard", color = theme.colors.textDisabled, fontWeight = FontWeight.Black, fontSize = 9.sp, letterSpacing = 2.sp) }
                }
            }
        }
    }
        }
    }
}
