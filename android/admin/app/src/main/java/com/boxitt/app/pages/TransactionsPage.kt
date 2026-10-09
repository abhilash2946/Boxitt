package com.boxitt.app.pages

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.animation.*
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
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.boxitt.app.Booking
import com.boxitt.app.BookingStatus
import com.boxitt.app.Location
import com.boxitt.app.User
import com.boxitt.app.components.DatePickerModal
import com.boxitt.app.components.QRCodeModal
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.BookingService
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

data class TransactionBooking(
    val booking: Booking,
    val arenaName: String,
    val courtName: String
)

@Serializable
private data class DbPaymentRow(
    val id: String = "",
    val booking_id: String = "",
    val user_id: String? = null,
    val amount: Double = 0.0,
    val payment_type: String = "advance",
    val payment_method: String = "Online",
    val created_at: String = ""
)

@Serializable
private data class DbUserProfileRow(
    val id: String = "",
    val display_name: String? = null,
    val username: String? = null,
    val phone_number: String? = null
)

@Serializable
private data class DbChallengeRow(
    val id: String = "",
    val booking_id: String? = null,
    val challenger_id: String? = null,
    val accepted_by: String? = null,
    val lose_to_pay: Boolean = true,
    val advance_price: Double? = null,
    val status: String = "active"
)

@Serializable
private data class DbMatchResultRow(
    val id: String = "",
    val challenge_id: String = "",
    val winner_id: String? = null,
    val loser_id: String? = null
)

enum class PeriodType { DAY, MONTH, YEAR, ALL }

fun Int.toLocaleString(): String {
    return java.text.NumberFormat.getNumberInstance(Locale.getDefault()).format(this)
}

fun Double.toLocaleString(): String {
    return java.text.NumberFormat.getNumberInstance(Locale.getDefault()).format(this)
}

@Composable
fun TransactionsPage(
    user: User?,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onBackClick: (() -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()

    val sdf = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()) }
    val today = remember { sdf.format(Calendar.getInstance().time) }

    val viewModel = remember { com.boxitt.app.hooks.TransactionsViewModel(scope) }
    val bookingsFromVm = viewModel.transactionsList

    var period by remember { mutableStateOf(PeriodType.DAY) }
    var selectedDate by remember { mutableStateOf(today) }
    var isDatePickerOpen by remember { mutableStateOf(false) }
    var showQR by remember { mutableStateOf(false) }
    var selectedBooking by remember { mutableStateOf<Booking?>(null) }
    var selectedLocation by remember { mutableStateOf<Location?>(null) }
    var loadingQR by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }

    // Option B Expandable Ledger State & Lazy Caches
    var expandedBookingId by remember { mutableStateOf<String?>(null) }
    var bookingPaymentsMap by remember { mutableStateOf<Map<String, List<DbPaymentRow>>>(emptyMap()) }
    var userProfilesMap by remember { mutableStateOf<Map<String, DbUserProfileRow>>(emptyMap()) }
    var challengesMap by remember { mutableStateOf<Map<String, DbChallengeRow>>(emptyMap()) }
    var matchResultsMap by remember { mutableStateOf<Map<String, DbMatchResultRow>>(emptyMap()) }

    LaunchedEffect(expandedBookingId) {
        val bId = expandedBookingId ?: return@LaunchedEffect
        if (bookingPaymentsMap.containsKey(bId)) return@LaunchedEffect

        try {
            val pays = try {
                Supabase.client.postgrest["payments"].select {
                    filter { eq("booking_id", bId) }
                }.decodeList<DbPaymentRow>()
            } catch (e: Exception) { emptyList<DbPaymentRow>() }

            val chs = try {
                Supabase.client.postgrest["challenges"].select {
                    filter { or { eq("booking_id", bId); eq("id", bId) } }
                }.decodeList<DbChallengeRow>()
            } catch (e: Exception) { emptyList<DbChallengeRow>() }

            val ch = chs.firstOrNull()
            val results = if (ch != null) {
                try {
                    Supabase.client.postgrest["match_results"].select {
                        filter { eq("challenge_id", ch.id) }
                    }.decodeList<DbMatchResultRow>()
                } catch (e: Exception) { emptyList<DbMatchResultRow>() }
            } else emptyList()

            val uIds = mutableSetOf<String>()
            pays.forEach { p -> p.user_id?.let { if (it.isNotBlank()) uIds.add(it) } }
            chs.forEach { c ->
                c.challenger_id?.let { if (it.isNotBlank()) uIds.add(it) }
                c.accepted_by?.let { if (it.isNotBlank()) uIds.add(it) }
            }
            results.forEach { r ->
                r.winner_id?.let { if (it.isNotBlank()) uIds.add(it) }
                r.loser_id?.let { if (it.isNotBlank()) uIds.add(it) }
            }

            val uMap = if (uIds.isNotEmpty()) {
                try {
                    Supabase.client.postgrest["user_profiles"].select {
                        filter { isIn("id", uIds.toList()) }
                    }.decodeList<DbUserProfileRow>().associateBy { it.id }
                } catch (e: Exception) { emptyMap() }
            } else emptyMap()

            bookingPaymentsMap = bookingPaymentsMap + (bId to pays)
            if (ch != null) challengesMap = challengesMap + (bId to ch)
            val res = results.firstOrNull()
            if (res != null) matchResultsMap = matchResultsMap + (bId to res)
            userProfilesMap = userProfilesMap + uMap
        } catch (e: Exception) {
            android.util.Log.e("TransactionsPage", "Failed loading ledger for $bId", e)
        }
    }

    LaunchedEffect(user?.id) {
        android.util.Log.d("TransactionsPage", "LaunchedEffect triggered with user.id: ${user?.id}")
        if (user?.id == null) { loading = false; return@LaunchedEffect }
        viewModel.fetchUserTransactions(user.id)
    }

    LaunchedEffect(viewModel.isLoading) {
        loading = viewModel.isLoading
    }

    val bookings = remember(bookingsFromVm) {
        bookingsFromVm.map { b ->
            TransactionBooking(
                booking = Booking(
                    id = b.id,
                    name = b.name,
                    phone = b.phone,
                    date = b.date,
                    locationId = b.locationId,
                    slotId = b.slotId,
                    slotTime = b.slotTime,
                    startHour = b.startHour,
                    endHour = b.endHour,
                    duration = b.duration.toString(),
                    amount = b.amount,
                    advancePaid = b.advancePaid,
                    status = b.status,
                    paymentMethod = b.paymentMethod,
                    paymentType = b.paymentType,
                    checkedIn = b.checkedIn,
                    createdAt = b.createdAt,
                    bookedBy = b.bookedBy,
                    sport = b.sport,
                    userId = b.userId,
                    isJoinable = b.isJoinable,
                    maxPlayers = b.maxPlayers,
                    currentPlayers = b.currentPlayers,
                    joinRequests = b.joinRequests,
                    courtId = b.courtId
                ),
                arenaName = b.arenaName,
                courtName = b.courtName
            )
        }
    }

    fun handleViewTicket(b: Booking) {
        loadingQR = true
        scope.launch {
            try {
                val loc = Supabase.client.postgrest["locations"]
                    .select {
                        filter {
                            eq("id", b.locationId)
                        }
                    }
                    .decodeSingleOrNull<Location>()
                selectedBooking = b
                selectedLocation = loc
                showQR = true
            } catch (e: Exception) {
                onAlert?.invoke(e.message ?: "Error", "error", null)
            } finally {
                loadingQR = false
            }
        }
    }

    val filteredBookings = remember(bookings, period, selectedDate) {
        if (period == PeriodType.ALL) bookings
        else {
            bookings.filter { txn ->
                val date = txn.booking.date
                when (period) {
                    PeriodType.DAY -> date == selectedDate
                    PeriodType.MONTH -> date.startsWith(selectedDate.take(7))
                    PeriodType.YEAR -> date.startsWith(selectedDate.take(4))
                    else -> true
                }
            }
        }
    }

    val totalCost = filteredBookings.sumOf { txn ->
        val b = txn.booking
        // Logic from Web: If match is joinable, always use contribution regardless of host status
        if (b.isJoinable) {
            Math.ceil(b.amount / (b.currentPlayers.coerceAtLeast(1)))
        } else {
            // Web: For non-joinable: full amount if COMPLETED, else advance
            if (b.status == BookingStatus.COMPLETED) b.amount else b.advancePaid
        }
    }.toInt()

    val avgCost = if (filteredBookings.isNotEmpty()) Math.round(totalCost.toDouble() / filteredBookings.size).toInt() else 0

    val periodDisplayDate = remember(selectedDate) {
        val parts = selectedDate.split("-")
        if (parts.size == 3) "${parts[1]}/${parts[2]}/${parts[0]}" else selectedDate
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        val isExpanded = maxWidth > 840.dp
        val columns = 1
        
        // Decorative background blur elements
        Box(modifier = Modifier
            .offset(x = (-100).dp, y = (-100).dp)
            .size(400.dp)
            .blur(120.dp)
            .clip(CircleShape)
            .background(theme.colors.accent.copy(alpha = 0.2f))
        )
        Box(modifier = Modifier
            .align(Alignment.BottomEnd)
            .offset(x = 100.dp, y = 100.dp)
            .size(400.dp)
            .blur(120.dp)
            .clip(CircleShape)
            .background(theme.colors.success.copy(alpha = 0.2f))
        )

        LazyVerticalGrid(
            columns = GridCells.Fixed(columns),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = 40.dp, bottom = 16.dp, start = if (isExpanded) 40.dp else 24.dp, end = if (isExpanded) 40.dp else 24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Header
            item(span = { GridItemSpan(columns) }) {
                Column {
                    Text(
                        "TRANSACTION",
                        fontSize = if (isExpanded) 48.sp else 32.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        color = theme.colors.textPrimary,
                        lineHeight = if (isExpanded) 44.sp else 28.sp,
                        letterSpacing = (-1).sp
                    )
                    Text(
                        "HISTORY",
                        fontSize = if (isExpanded) 48.sp else 32.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        color = theme.colors.accent,
                        lineHeight = if (isExpanded) 44.sp else 28.sp,
                        letterSpacing = (-1).sp
                    )
                    Spacer(Modifier.height(16.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.History, contentDescription = null, tint = theme.colors.textDisabled, modifier = Modifier.size(16.dp))
                        Text("TRACK YOUR BOOKINGS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                    }
                }
            }

            // Period filter bar
            item(span = { GridItemSpan(columns) }) {
                Box(
                    modifier = Modifier
                        .then(if (isExpanded) Modifier.width(600.dp) else Modifier.fillMaxWidth())
                        .shadow(theme.elevation.card, RoundedCornerShape(24.dp))
                        .clip(RoundedCornerShape(24.dp))
                        .background(theme.colors.card)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
                        .padding(16.dp)
                ) {
                    Column {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(theme.colors.backgroundSecondary)
                                .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                                .padding(4.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            PeriodType.values().forEach { p ->
                                val isSelected = period == p
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (isSelected) theme.colors.accent else Color.Transparent)
                                        .clickable { period = p }
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        p.name.uppercase(),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = if (isSelected) Color.White else theme.colors.textSecondary,
                                        letterSpacing = 1.sp
                                    )
                                }
                            }
                        }

                        if (period != PeriodType.ALL) {
                            Spacer(Modifier.height(12.dp))
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(theme.colors.backgroundSecondary)
                                    .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                                    .clickable { isDatePickerOpen = true }
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(periodDisplayDate, fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = theme.colors.accent, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }

            // Summary card (gradient)
            item(span = { GridItemSpan(columns) }) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(theme.elevation.elevated, RoundedCornerShape(40.dp))
                        .clip(RoundedCornerShape(40.dp))
                        .background(Brush.linearGradient(theme.colors.buttonGradient))
                        .padding(20.dp)
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Default.CurrencyRupee, contentDescription = null, tint = Color.White.copy(0.7f), modifier = Modifier.size(14.dp))
                            Text("TOTAL SPENDING", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White.copy(0.7f), letterSpacing = 4.sp)
                        }
                        Spacer(Modifier.height(12.dp))
                        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Text("₹${totalCost.toLocaleString()}", fontSize = if (isExpanded) 56.sp else 40.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White, letterSpacing = (-2).sp)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color.White.copy(0.15f))
                                    .border(1.dp, Color.White.copy(0.1f), RoundedCornerShape(8.dp))
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text("FILTER: ${period.name}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 2.sp)
                            }
                        }
                        Spacer(Modifier.height(24.dp))
                        Divider(color = Color.White.copy(0.15f))
                        Spacer(Modifier.height(24.dp))
                        Row(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("BOOKINGS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White.copy(0.7f), letterSpacing = 1.sp)
                                Text("${filteredBookings.size}", fontSize = 36.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White, letterSpacing = (-1).sp)
                            }
                            Box(modifier = Modifier.width(1.dp).height(40.dp).background(Color.White.copy(0.15f)))
                            Column(modifier = Modifier.weight(1f).padding(start = 24.dp)) {
                                Text("AVERAGE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White.copy(0.7f), letterSpacing = 1.sp)
                                Text("₹${avgCost.toLocaleString()}", fontSize = 36.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White, letterSpacing = (-1).sp)
                            }
                        }
                    }
                }
            }

            // Booking list header
            item(span = { GridItemSpan(columns) }) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("BOOKING LIST", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                    Divider(modifier = Modifier.weight(1f), color = theme.colors.border)
                }
            }

            if (loading) {
                item(span = { GridItemSpan(columns) }) {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = theme.colors.accent)
                            Spacer(Modifier.height(12.dp))
                            Text("LOADING HISTORY...", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                        }
                    }
                }
            } else if (filteredBookings.isEmpty()) {
                item(span = { GridItemSpan(columns) }) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp)
                            .shadow(theme.elevation.card, RoundedCornerShape(24.dp))
                            .clip(RoundedCornerShape(24.dp))
                            .background(theme.colors.backgroundSecondary)
                            .border(2.dp, theme.colors.border, RoundedCornerShape(24.dp))
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("NO BOOKINGS FOUND", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                    }
                }
            } else {
                items(filteredBookings) { txn ->
                    val b = txn.booking
                    val isHost = user?.id == b.bookedBy
                    val contribution = if (b.isJoinable && !isHost) Math.ceil(b.amount / b.currentPlayers.coerceAtLeast(1)).toInt() else null
                    val paidAmount = if (b.status == BookingStatus.COMPLETED) b.amount else b.advancePaid

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .shadow(theme.elevation.card, RoundedCornerShape(20.dp))
                            .clip(RoundedCornerShape(20.dp))
                            .background(theme.colors.card)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))
                            .padding(16.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Top
                            ) {
                                Row(
                                    modifier = Modifier.weight(1f),
                                    verticalAlignment = Alignment.CenterVertically, 
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(52.dp)
                                            .shadow(theme.elevation.elevated, RoundedCornerShape(10.dp))
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(theme.colors.backgroundSecondary)
                                            .border(1.dp, theme.colors.border, RoundedCornerShape(10.dp)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(if (b.sport.contains("Football", ignoreCase = true)) "⚽" else "🏏", fontSize = 24.sp)
                                    }
                                    Column {
                                        Text(b.slotTime, fontSize = 18.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, letterSpacing = (-0.5).sp)
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = theme.colors.accent, modifier = Modifier.size(10.dp))
                                                Text(b.date, fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(
                                                        when(b.status) {
                                                            BookingStatus.CONFIRMED -> theme.colors.success.copy(0.1f)
                                                            BookingStatus.TIMED_OUT -> theme.colors.warning.copy(0.1f)
                                                            BookingStatus.BOOKED -> theme.colors.accent.copy(0.1f)
                                                            BookingStatus.DECLINED -> theme.colors.error.copy(0.1f)
                                                            else -> theme.colors.textDisabled.copy(0.1f)
                                                        }
                                                    )
                                                    .padding(horizontal = 4.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    when(b.status) {
                                                        BookingStatus.BOOKED -> "BOOKED"
                                                        BookingStatus.CONFIRMED -> "CONFIRMED"
                                                        BookingStatus.TIMED_OUT -> "TIMED OUT"
                                                        BookingStatus.DECLINED -> "DECLINED"
                                                        else -> b.status.name
                                                    },
                                                    fontSize = 7.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = when(b.status) {
                                                        BookingStatus.CONFIRMED -> theme.colors.success
                                                        BookingStatus.TIMED_OUT -> theme.colors.warning
                                                        BookingStatus.BOOKED -> theme.colors.accent
                                                        BookingStatus.DECLINED -> theme.colors.error
                                                        else -> theme.colors.textDisabled
                                                    }
                                                )
                                            }
                                            // Booking Type Badge
                                            val (typeLabel, typeColor) = when {
                                                b.isJoinable -> "JOINABLE MATCH" to theme.colors.accent
                                                else -> "NORMAL BOOKING" to theme.colors.textDisabled
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(typeColor.copy(0.1f))
                                                    .border(0.5.dp, typeColor.copy(0.3f), RoundedCornerShape(4.dp))
                                                    .padding(horizontal = 4.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    typeLabel,
                                                    fontSize = 7.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = typeColor
                                                )
                                            }
                                            // Court Badge
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(theme.colors.backgroundSecondary)
                                                    .border(0.5.dp, theme.colors.border, RoundedCornerShape(4.dp))
                                                    .padding(horizontal = 4.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    txn.courtName.uppercase(),
                                                    fontSize = 7.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = theme.colors.textDisabled
                                                )
                                            }
                                        }
                                        Text(txn.arenaName.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 0.5.sp)
                                    }
                                }

                                Column(horizontalAlignment = Alignment.End) {
                                    if (contribution != null) {
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(theme.colors.accent.copy(0.1f))
                                                .border(1.dp, theme.colors.accent.copy(0.3f), RoundedCornerShape(6.dp))
                                                .padding(horizontal = 6.dp, vertical = 2.dp)
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                Text("CONTRIBUTION:", fontSize = 7.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                                Text("₹${contribution.toLocaleString()}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                            }
                                        }
                                        Spacer(Modifier.height(4.dp))
                                    }
                                    
                                    Text("₹${paidAmount.toLocaleString()}", fontSize = 22.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, letterSpacing = (-1).sp)
                                    Text(if (b.status == BookingStatus.COMPLETED) "PAID FULL" else "ADVANCE PAID", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 0.5.sp)
                                }
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (expandedBookingId == b.id) theme.colors.accent.copy(0.2f) else theme.colors.backgroundSecondary)
                                            .border(1.dp, if (expandedBookingId == b.id) theme.colors.accent else theme.colors.border, RoundedCornerShape(10.dp))
                                            .clickable {
                                                expandedBookingId = if (expandedBookingId == b.id) null else b.id
                                            }
                                            .padding(horizontal = 10.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Icon(Icons.Default.Receipt, contentDescription = null, tint = if (expandedBookingId == b.id) theme.colors.accent else theme.colors.textDisabled, modifier = Modifier.size(14.dp))
                                        Text("LEDGER", fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (expandedBookingId == b.id) theme.colors.accent else theme.colors.textDisabled, letterSpacing = 1.sp)
                                        Icon(if (expandedBookingId == b.id) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, contentDescription = null, tint = if (expandedBookingId == b.id) theme.colors.accent else theme.colors.textDisabled, modifier = Modifier.size(14.dp))
                                    }

                                    if (b.status == BookingStatus.APPROVED || b.status == BookingStatus.BOOKED || b.status == BookingStatus.CONFIRMED || b.status == BookingStatus.COMPLETED) {
                                        Button(
                                            onClick = { handleViewTicket(b) },
                                            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                                            shape = RoundedCornerShape(10.dp),
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                            modifier = Modifier.height(36.dp).shadow(theme.elevation.elevated, RoundedCornerShape(10.dp))
                                        ) {
                                            Icon(Icons.Default.QrCode, contentDescription = null, modifier = Modifier.size(14.dp))
                                            Spacer(Modifier.width(6.dp))
                                            Text("VIEW TICKET", fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                        }
                                    }
                                }

                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("MATCH TOTAL:", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 0.5.sp)
                                    Text("₹${b.amount.toLocaleString()}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                }
                            }

                            // Option B Expandable Paid Ledger Drawer
                            AnimatedVisibility(
                                visible = expandedBookingId == b.id,
                                enter = expandVertically() + fadeIn(),
                                exit = shrinkVertically() + fadeOut()
                            ) {
                                val bookingPays = bookingPaymentsMap[b.id] ?: emptyList()
                                val ch = challengesMap[b.id]
                                val res = matchResultsMap[b.id]

                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 8.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(theme.colors.backgroundSecondary.copy(0.5f))
                                        .border(1.dp, theme.colors.border.copy(0.5f), RoundedCornerShape(12.dp))
                                        .padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Icon(Icons.Default.Receipt, contentDescription = null, tint = theme.colors.accent, modifier = Modifier.size(12.dp))
                                            Text("ITEMIZED PAYMENT LEDGER", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 1.sp)
                                        }
                                        Text("${bookingPays.size} Transaction(s)", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                    }

                                    if (bookingPays.isEmpty()) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(theme.colors.card)
                                                .padding(10.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text("INITIAL ADVANCE PAID: ₹${b.advancePaid.toLocaleString()}", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                        }
                                    } else {
                                        bookingPays.forEach { pay ->
                                            val uProfile = pay.user_id?.let { userProfilesMap[it] }
                                            val pName = uProfile?.display_name ?: uProfile?.username ?: "Player"
                                            val pHandle = if (!uProfile?.username.isNullOrBlank()) "@${uProfile?.username}" else ""

                                            val (roleTitle, payerLabel) = when (pay.payment_type.lowercase()) {
                                                "advance" -> {
                                                    if (ch != null && pay.user_id == ch.challenger_id) "CHALLENGER ADVANCE" to "$pName $pHandle"
                                                    else if (ch != null && pay.user_id == ch.accepted_by) "CHALLENGEE ADVANCE" to "$pName $pHandle"
                                                    else "HOST ADVANCE" to "$pName $pHandle"
                                                }
                                                "settlement" -> {
                                                    if (ch != null) {
                                                        if (ch.lose_to_pay && res != null) {
                                                            if (res.loser_id != null) {
                                                                val loserProfile = userProfilesMap[res.loser_id]
                                                                val lName = loserProfile?.display_name ?: loserProfile?.username ?: "Loser"
                                                                val lHandle = if (!loserProfile?.username.isNullOrBlank()) "@${loserProfile.username}" else ""
                                                                "FINAL SETTLEMENT (LOSE TO PAY)" to "Paid by Loser: $lName $lHandle"
                                                            } else {
                                                                "FINAL SETTLEMENT (TIE)" to "Paid by Challenger: $pName $pHandle"
                                                            }
                                                        } else {
                                                            val isChallengerPay = pay.user_id == ch.challenger_id
                                                            val isChallengeePay = pay.user_id == ch.accepted_by
                                                            val label = if (isChallengerPay) "Paid by Challenger" else if (isChallengeePay) "Paid by Challengee" else "Paid by Player"
                                                            "FINAL SETTLEMENT (FRIENDLY)" to "$label: $pName $pHandle"
                                                        }
                                                    } else {
                                                        "FINAL SETTLEMENT" to "Paid by Host: $pName $pHandle"
                                                    }
                                                }
                                                "full" -> "FULL PAYMENT" to "Paid by Host: $pName $pHandle"
                                                else -> "PLAYER CONTRIBUTION" to "Paid by: $pName $pHandle"
                                            }

                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clip(RoundedCornerShape(8.dp))
                                                    .background(theme.colors.card)
                                                    .border(0.5.dp, theme.colors.border, RoundedCornerShape(8.dp))
                                                    .padding(10.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                    Box(
                                                        modifier = Modifier
                                                            .size(28.dp)
                                                            .clip(RoundedCornerShape(6.dp))
                                                            .background(theme.colors.accent.copy(0.1f)),
                                                        contentAlignment = Alignment.Center
                                                    ) {
                                                        Icon(Icons.Default.Payments, contentDescription = null, tint = theme.colors.accent, modifier = Modifier.size(14.dp))
                                                    }
                                                    Column {
                                                        Text(roleTitle, fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                        Text(payerLabel, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = theme.colors.accent, fontStyle = FontStyle.Italic)
                                                    }
                                                }
                                                Column(horizontalAlignment = Alignment.End) {
                                                    Text("₹${pay.amount.toLocaleString()}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                    Text(pay.payment_method.uppercase(), fontSize = 7.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                                }
                                            }
                                        }
                                    }

                                    // Balance Summary Footer
                                    val collectedSum = bookingPays.sumOf { it.amount }.coerceAtLeast(b.advancePaid)
                                    val isFullySettled = collectedSum >= b.amount
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(theme.colors.accent.copy(0.08f))
                                            .padding(8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("TOTAL COLLECTED: ₹${collectedSum.toLocaleString()} / ₹${b.amount.toLocaleString()}", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                        Text(
                                            if (isFullySettled) "✓ FULLY SETTLED" else "DUE: ₹${(b.amount - collectedSum).coerceAtLeast(0.0).toLocaleString()}",
                                            fontSize = 8.sp,
                                            fontWeight = FontWeight.Black,
                                            color = if (isFullySettled) theme.colors.success else theme.colors.error
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item(span = { GridItemSpan(columns) }) { Spacer(Modifier.height(16.dp)) }
        }

        // Loading QR overlay
        if (loadingQR) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.5f)).zIndex(200f), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = theme.colors.accent)
            }
        }

        // QR Modal
        if (showQR && selectedBooking != null && selectedLocation != null) {
            Dialog(
                onDismissRequest = { showQR = false },
                properties = DialogProperties(usePlatformDefaultWidth = false)
            ) {
                Box(modifier = Modifier.zIndex(300f)) {
                    QRCodeModal(booking = selectedBooking!!, location = selectedLocation!!, onClose = { showQR = false }, onAlert = onAlert)
                }
            }
        }

        // Date picker
        if (isDatePickerOpen) {
            DatePickerModal(
                isOpen = true,
                onClose = { isDatePickerOpen = false },
                selectedDate = selectedDate,
                onSelect = { selectedDate = it; isDatePickerOpen = false }
            )
        }
    }
}
