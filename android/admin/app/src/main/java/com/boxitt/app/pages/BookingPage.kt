package com.boxitt.app.pages

import androidx.compose.foundation.layout.BoxWithConstraints
import com.boxitt.app.components.LoadingButton
import androidx.compose.animation.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import coil.compose.AsyncImage
import com.boxitt.app.Booking
import com.boxitt.app.BookingStatus
import com.boxitt.app.Location
import com.boxitt.app.SportType
import com.boxitt.app.User
import com.boxitt.app.components.ChallengeCard
import com.boxitt.app.components.DatePickerModal
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import com.boxitt.app.components.DurationPickerModal
import com.boxitt.app.components.DurationOption
import com.boxitt.app.components.JoinableCard
import com.boxitt.app.components.JoinGameCard
import com.boxitt.app.components.PaymentPage
import com.boxitt.app.components.QRCodeModal
import com.boxitt.app.components.SuccessModal
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.*
import com.boxitt.app.services.BookingService
import com.boxitt.app.services.LocationService
import com.boxitt.app.services.PricingService
import com.boxitt.app.services.Storage
import com.boxitt.app.services.Supabase
import com.boxitt.app.services.ChallengeService
import com.boxitt.app.services.NotificationService
import com.boxitt.app.services.BookingValidationResult
import com.boxitt.app.services.validateBookingSlot
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.UUID
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.round

data class Slot(
    val id: String,
    val startTime: String,
    val endTime: String,
    val startHour: Double,
    val endHour: Double,
    val timeRange: String,
    val price: Double,
    val advancePrice: Double,
    val isPast: Boolean,
    val isCurrent: Boolean
)

enum class PaymentType { ADVANCE, FULL }

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun BookingPage(
    modifier: Modifier = Modifier,
    location: Location,
    isAdminManual: Boolean = false,
    onComplete: (() -> Unit)? = null,
    userRole: String = "user",
    user: User?,
    onBack: (() -> Unit)? = null,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    navViewModel: com.boxitt.app.navigation.NavigationViewModel? = null
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()
    val sdf = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()) }

    fun todayStr() = sdf.format(Calendar.getInstance().time)

    val PAGE_ID = "booking_${location.id}"
    
    var currentLocation by remember { mutableStateOf(location) }
    


    // Manual helper to get saved state since generic getPageState is inlined
    val savedState: Map<String, String>? = remember {
        try {
            val raw = com.boxitt.app.services.Storage.prefs.getString("boxitt_page_data_$PAGE_ID", null)
            if (raw != null) {
                com.boxitt.app.services.Storage.json.decodeFromString<Map<String, String>>(raw)
            } else null
        } catch (e: Exception) { null }
    }

    var now by remember { mutableStateOf(Calendar.getInstance()) }
    
    // Auto-refresh 'now' every 30 seconds (Parity with Web)
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                now = Calendar.getInstance()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        
        while(true) {
            kotlinx.coroutines.delay(30000)
            now = Calendar.getInstance()
        }
    }

    var name by remember { mutableStateOf(savedState?.get("name") ?: "") }
    var phone by remember { mutableStateOf(savedState?.get("phone") ?: "") }
    
    // Flag to ensure profile sync only happens once if state was empty
    var profileSynced by remember { mutableStateOf(savedState?.get("name") != null) }
    
    LaunchedEffect(user) {
        if (user != null && !profileSynced) {
            if (name.isBlank()) name = user.displayName ?: ""
            if (phone.isBlank()) phone = user.phoneNumber ?: ""
            profileSynced = true
        }
    }
    var selectedCourtId by remember { mutableStateOf(savedState?.get("selectedCourtId")?.takeIf { it.isNotBlank() }) }
    var duration by remember { mutableStateOf(savedState?.get("duration") ?: "1") }
    var date by remember { mutableStateOf(todayStr()) }
    var selectedSlotId by remember { mutableStateOf<String?>(savedState?.get("selectedSlotId")) }
    
    var isJoinable by remember { 
        mutableStateOf(savedState?.get("isJoinable")?.toBoolean() ?: false) 
    }
    var isChallengeEnabled by remember { 
        mutableStateOf(savedState?.get("isChallengeEnabled")?.toBoolean() ?: false) 
    }
    var paymentChoice by remember { 
        mutableStateOf<PaymentType>(if (isChallengeEnabled || isJoinable) PaymentType.ADVANCE else (savedState?.get("paymentChoice")?.let {
            try { PaymentType.valueOf(it) } catch(e: Exception) { null }
        } ?: if (location.advance_booking_required == true) PaymentType.ADVANCE else PaymentType.FULL))
    }

    LaunchedEffect(location.advance_booking_required, isChallengeEnabled, isJoinable) {
        if (isChallengeEnabled || isJoinable) {
            paymentChoice = PaymentType.ADVANCE
        } else if (location.advance_booking_required != true) {
            paymentChoice = PaymentType.FULL
        }
    }

    val vmSport by navViewModel?.selectedSport?.collectAsState() ?: remember { mutableStateOf<String?>(null) }
    val selectedSport = remember(location, vmSport) { 
        if (!vmSport.isNullOrBlank() && location.supported_sports?.any { it.equals(vmSport, ignoreCase = true) } == true) {
            vmSport!!
        } else {
            location.supported_sports?.firstOrNull() ?: "Box Cricket"
        }
    }
    val sportConfig = remember(selectedSport) { 
        Constants.SPORT_CONFIG.entries.firstOrNull { it.key.equals(selectedSport, ignoreCase = true) }?.value 
            ?: Constants.SPORT_CONFIG["Box Cricket"]!!
    }

    var maxPlayersLimit by remember { 
        mutableStateOf(savedState?.get("maxPlayersLimit")?.toInt() ?: sportConfig.defaultCapacity) 
    }
    var playersIHave by remember { 
        mutableStateOf(savedState?.get("playersIHave")?.toInt() ?: 1) 
    }

    // Update capacity if sport changes
    LaunchedEffect(sportConfig) {
        if (savedState?.get("maxPlayersLimit") == null) {
            maxPlayersLimit = sportConfig.defaultCapacity
        }
    }

    // Persist state whenever fields change (Mirror Web)
    LaunchedEffect(name, phone, duration, date, selectedSlotId, paymentChoice, isJoinable, isChallengeEnabled, maxPlayersLimit, playersIHave) {
        val currentRaw = com.boxitt.app.services.Storage.prefs.getString("boxitt_page_data_$PAGE_ID", null)
        val currentMap = try {
            if (currentRaw != null) com.boxitt.app.services.Storage.json.decodeFromString<Map<String, String>>(currentRaw) else emptyMap()
        } catch (e: Exception) { emptyMap() }

        val preJoinId = currentMap["preJoinBookingId"] ?: ""
        
        val newState = mutableMapOf(
            "name" to name,
            "phone" to phone,
            "duration" to duration,
            "date" to date,
            "selectedSlotId" to (selectedSlotId ?: ""),
            "selectedCourtId" to (selectedCourtId ?: ""),
            "paymentChoice" to paymentChoice.name,
            "maxPlayersLimit" to maxPlayersLimit.toString(),
            "playersIHave" to playersIHave.toString()
        )
        if (preJoinId.isNotBlank()) {
            newState["preJoinBookingId"] = preJoinId
        }

        try {
            val dataStr = com.boxitt.app.services.Storage.json.encodeToString(newState.toMap())
            com.boxitt.app.services.Storage.prefs.edit().putString("boxitt_page_data_$PAGE_ID", dataStr).apply()
            
            // Save toggles to session storage only (Parity with Web sessionStorage)
            com.boxitt.app.services.Storage.setSessionPageState(PAGE_ID, mapOf(
                "isJoinable" to isJoinable.toString(),
                "isChallengeEnabled" to isChallengeEnabled.toString()
            ))
        } catch (e: Exception) { e.printStackTrace() }
    }

    var validationError by remember { mutableStateOf("") }
    var showConfirm by remember { mutableStateOf(false) }
    var joiningBooking by remember { mutableStateOf<Booking?>(null) }
    var joiningPlayersCount by remember { mutableStateOf(1) }
    var confirmedBooking by remember { mutableStateOf<Booking?>(null) }
    var showQR by remember { mutableStateOf(false) }
    var showSuccess by remember { mutableStateOf(false) }
    var allBookings by remember { mutableStateOf<List<Booking>>(emptyList()) }
    var pricing by remember { mutableStateOf<List<Pricing>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var isBooking by remember { mutableStateOf(false) }
    var showPayment by remember { mutableStateOf(false) }
    var showDurationPicker by remember { mutableStateOf(false) }
    var showDatePicker by remember { mutableStateOf(false) }
    var userSentMatchRequests by remember { mutableStateOf<Set<String>>(emptySet()) }
    var userAcceptedMatches by remember { mutableStateOf<Set<String>>(emptySet()) }

    // Fetch full location details if needed (Parity with Web handleInitialData)
    LaunchedEffect(location.id, date) {
        if (location.id.isBlank()) return@LaunchedEffect
        try {
            val bookingsData = BookingService.getBookings(location.id, date)
            allBookings = bookingsData.map { BookingService.checkAndApplyTimeout(it) }

            LocationService.getLocationById(location.id)?.let {
                currentLocation = it
                navViewModel?.setSelectedLocation(it)
            }
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            e.printStackTrace()
        }
    }

    // Fetch match requests for the user (Parity with Web fetchUserRequests)
    fun fetchUserRequests() {
        if (user?.id == null) return
        scope.launch {
            try {
                val result = ChallengeService.fetchChallengesAndMatches(user.id, location.id)
                userSentMatchRequests = result.userSentMatchRequests
                userAcceptedMatches = result.userAcceptedMatches
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                e.printStackTrace()
            }
        }
    }

    LaunchedEffect(user?.id) {
        fetchUserRequests()
    }
    
    val lazyListState = rememberLazyListState()

    // Sync user data
    LaunchedEffect(user) {
        if (name.isBlank() && !user?.displayName.isNullOrBlank()) name = user!!.displayName!!
        if (phone.isBlank() && !user?.phoneNumber.isNullOrBlank()) phone = user!!.phoneNumber!!
    }

    fun getSlotBookingStats(startH: Double, endH: Double): Triple<Int, Int, Boolean> {
        val targetCourt = currentLocation.courts?.find { it.id == selectedCourtId } ?: currentLocation.courts?.firstOrNull()
        val courtMaxCap = targetCourt?.maxCapacity ?: currentLocation.maxCapacity
        val isSwimming = selectedSport == SportType.SWIMMING
        val slotCapacity = if (courtMaxCap > 0) courtMaxCap else if (isSwimming) 50 else if (isJoinable || isChallengeEnabled) maxPlayersLimit else 10

        val overlapping = allBookings.filter { b ->
            b.date == date && b.locationId == location.id &&
            (selectedCourtId == null || b.courtId == selectedCourtId) &&
            (b.status != BookingStatus.CANCELLED && b.status != BookingStatus.REJECTED && b.status != BookingStatus.DECLINED && b.status != BookingStatus.TIMED_OUT) &&
            (startH < b.endHour && b.startHour < endH)
        }

        val bookedCount = overlapping.sumOf { b -> b.currentPlayers.coerceAtLeast(1) }
        val isFree = bookedCount < slotCapacity
        return Triple(bookedCount, slotCapacity, isFree)
    }

    // Helper to check if slot is free
    fun isSlotFree(startH: Double, endH: Double): Boolean {
        return getSlotBookingStats(startH, endH).third
    }

    // Generate slots
    val availableSlots = remember(duration, date, now, pricing, currentLocation, allBookings, selectedCourtId) {
        if (selectedCourtId == null) return@remember emptyList<Slot>()
        val slots = mutableListOf<Slot>()
        val durRaw = duration.toDoubleOrNull() ?: 1.0
        val durMins = round(durRaw * 60).toInt()
        
        val targetCourt = currentLocation.courts?.find { it.id == selectedCourtId } ?: currentLocation.courts?.firstOrNull()
        if (targetCourt == null) return@remember emptyList<Slot>()

        val startHour = targetCourt.open_hour ?: currentLocation.openHour ?: 6
        val endHour = targetCourt.close_hour ?: currentLocation.closeHour ?: 23
        val startMinsTotal = startHour * 60
        val endMinsTotal = endHour * 60
        val morningStartMins = (targetCourt.morning_start ?: currentLocation.morningStart ?: 6) * 60
        val morningEndMins = (targetCourt.morning_end ?: currentLocation.morningEnd ?: 18) * 60
        val currentTimeMins = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

        val cal = Calendar.getInstance().apply {
            val parts = date.split("-")
            if (parts.size == 3) set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
        }
        val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK) - 1 // 0=Sun

        var currentStartMins = startMinsTotal
        while (currentStartMins + durMins <= endMinsTotal) {
            val midpoint = currentStartMins + durMins / 2.0
            val isMorning = midpoint >= morningStartMins && midpoint < morningEndMins
            val category = if (isMorning) "morning" else "night"

            var rules = pricing.filter { p ->
                p.court_id == selectedCourtId && abs(p.duration_hours - durRaw) < 0.001 && (p.category ?: "morning") == category
            }
            
            if (rules.isEmpty()) {
                val court1 = currentLocation.courts?.find { it.courtNumber == 1 }
                if (court1 != null) {
                    rules = pricing.filter { p ->
                        p.court_id == court1.id && abs(p.duration_hours - durRaw) < 0.001 && (p.category ?: "morning") == category
                    }
                }
            }
            
            // Best rule: specific date > day > default
            val priceRule = rules.find { it.rule_type == "date" && it.specific_date == date }
                ?: rules.find { it.rule_type == "day" && it.day_of_week == dayOfWeek }
                ?: rules.find { it.rule_type == "default" || it.rule_type == null }

            if (priceRule != null) {
                val endMinutes = currentStartMins + durMins
                fun formatTimeStr(totalMins: Int): String {
                    val h24 = (totalMins / 60) % 24
                    val m = totalMins % 60
                    val period = if (h24 >= 12) "PM" else "AM"
                    val h12 = if (h24 % 12 == 0) 12 else h24 % 12
                    val mStr = if (m < 10) "0$m" else "$m"
                    return "$h12:$mStr $period"
                }
                val startStr = formatTimeStr(currentStartMins)
                val endStr = formatTimeStr(endMinutes)
                val isPast = (date == todayStr() && currentStartMins < currentTimeMins) || !currentLocation.isOpen
                val isCurrent = !isPast && currentStartMins >= currentTimeMins && currentStartMins < currentTimeMins + 60

                slots.add(Slot(
                    id = "slot-$selectedCourtId-$date-$currentStartMins-$durMins",
                    startTime = startStr, endTime = endStr,
                    startHour = currentStartMins / 60.0, endHour = endMinutes / 60.0,
                    timeRange = "$startStr - $endStr",
                    price = priceRule.price,
                    advancePrice = priceRule.advance_price ?: 0.0,
                    isPast = isPast, isCurrent = isCurrent
                ))
            }
            currentStartMins += 30
        }
        slots
    }

    // Auto-scroll logic (Parity with Web scrollGridToFirstAvailable)
    val slotsGridState = rememberLazyGridState()
    var hasAutoScrolled by remember(location.id, date, duration, allBookings.size) { mutableStateOf(false) }

    // Clear selection on changes (Parity with Web)
    var isFirstMount by remember { mutableStateOf(true) }
    LaunchedEffect(date, duration, location.id) {
        if (isFirstMount) {
            isFirstMount = false
        } else {
            selectedSlotId = null
        }
    }

    LaunchedEffect(loading, joiningBooking, availableSlots, hasAutoScrolled) {
        if (!loading && joiningBooking == null && availableSlots.isNotEmpty() && !hasAutoScrolled) {
            val firstAvailableIndex = availableSlots.indexOfFirst { slot ->
                !slot.isPast && isSlotFree(slot.startHour, slot.endHour)
            }
            if (firstAvailableIndex != -1) {
                // Scroll the grid to the first available slot
                slotsGridState.animateScrollToItem(firstAvailableIndex)
                hasAutoScrolled = true
            }
        }
    }

    suspend fun fetchInitialData() {
        if (location.id.isBlank()) return
        loading = true
        try {
            val bookingsData = BookingService.getBookings(location.id, date)
            allBookings = bookingsData.map { BookingService.checkAndApplyTimeout(it) }
            
            val fetchedPricing = PricingService.getPricingForLocation(location.id)
            pricing = fetchedPricing
            
            LocationService.getLocationById(location.id)?.let {
                currentLocation = it
                navViewModel?.setSelectedLocation(it)
            }
            
            if (fetchedPricing.isNotEmpty() && (duration == "1" || duration.isBlank()) && savedState?.get("duration") == null) {
                duration = fetchedPricing[0].duration_hours.toString()
            }
            
            android.util.Log.d("BookingPage", "Data loaded for ${location.id}. Rules: ${fetchedPricing.size}, Courts: ${currentLocation.courts?.size ?: 0}")
        } catch (e: Exception) {
            android.util.Log.e("BookingPage", "Failed to load data", e)
            onAlert?.invoke(e.message ?: "Failed to load data", "error", null)
        } finally {
            loading = false
        }
    }

    // Fetch bookings + pricing
    LaunchedEffect(location.id, date) {
        fetchInitialData()
    }

    LaunchedEffect(currentLocation.courts, selectedCourtId) {
        if (currentLocation.courts?.isNotEmpty() == true && selectedCourtId == null) {
            selectedCourtId = currentLocation.courts!![0].id
        }
    }

    fun refreshBookings() {
        scope.launch {
            try {
                val bookingsData = BookingService.getBookings(location.id, date)
                allBookings = bookingsData.map { BookingService.checkAndApplyTimeout(it) }
            } catch (e: Exception) {
                onAlert?.invoke(e.message ?: "Error refreshing bookings", "error", null)
            }
        }
    }

    val availableDurations = remember(pricing, date, currentLocation, selectedCourtId) {
        val uniqueDurations = pricing.map { it.duration_hours }.distinct().sorted()
        if (selectedCourtId == null) return@remember emptyList<DurationOption>()

        val targetCourt = currentLocation.courts?.find { it.id == selectedCourtId } ?: currentLocation.courts?.firstOrNull()
        if (targetCourt == null) return@remember emptyList<DurationOption>()

        val startHour = targetCourt.open_hour ?: currentLocation.openHour ?: 6
        val endHour = targetCourt.close_hour ?: currentLocation.closeHour ?: 23
        val startMinsTotal = startHour * 60
        val endMinsTotal = endHour * 60
        val morningStartMins = (targetCourt.morning_start ?: currentLocation.morningStart ?: 6) * 60
        val morningEndMins = (targetCourt.morning_end ?: currentLocation.morningEnd ?: 18) * 60

        val cal = Calendar.getInstance().apply {
            val parts = date.split("-")
            if (parts.size == 3) set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
        }
        val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK) - 1 // 0=Sun

        uniqueDurations.filter { durRaw ->
            val durMins = (durRaw * 60).toInt()
            var hasAny = false
            var currentStartMins = startMinsTotal
            while (currentStartMins + durMins <= endMinsTotal) {
                val midpoint = currentStartMins + durMins / 2.0
                val isMorning = midpoint >= morningStartMins && midpoint < morningEndMins
                val category = if (isMorning) "morning" else "night"

                var rules = pricing.filter { p ->
                    p.court_id == selectedCourtId && abs(p.duration_hours - durRaw) < 0.001 && (p.category ?: "morning") == category
                }
                if (rules.isEmpty()) {
                    val court1 = currentLocation.courts?.find { it.courtNumber == 1 }
                    if (court1 != null) {
                        rules = pricing.filter { p ->
                            p.court_id == court1.id && abs(p.duration_hours - durRaw) < 0.001 && (p.category ?: "morning") == category
                        }
                    }
                }
                
                val priceRule = rules.find { it.rule_type == "date" && it.specific_date == date }
                    ?: rules.find { it.rule_type == "day" && it.day_of_week == dayOfWeek }
                    ?: rules.find { it.rule_type == "default" || it.rule_type == null }

                if (priceRule != null) {
                    hasAny = true
                    break
                }
                currentStartMins += 30
            }
            hasAny
        }.map { dh -> 
            DurationOption(value = dh.toString(), label = "${if (dh % 1.0 == 0.0) dh.toInt() else dh} ${if (dh == 1.0) "Hour" else "Hours"}") 
        }
    }

    val joinableBookings = remember(allBookings, date, now, location.id, selectedCourtId) {
        val currentHours = now.get(Calendar.HOUR_OF_DAY) + now.get(Calendar.MINUTE) / 60.0
        allBookings.filter { b ->
            val effectiveEndHour = if (b.endHour <= b.startHour) (if (b.endHour == 0.0) 24.0 else b.endHour + 24.0) else b.endHour
            val isPast = date == todayStr() && effectiveEndHour <= currentHours
            b.locationId == location.id &&
            (selectedCourtId == null || b.courtId == selectedCourtId) &&
            b.date == date && b.isJoinable && !isPast &&
            b.currentPlayers < b.maxPlayers &&
            (b.status == BookingStatus.APPROVED || b.status == BookingStatus.PENDING)
        }.sortedBy { it.startHour }
    }

    val currentSelectedSlot = remember(availableSlots, selectedSlotId) {
        availableSlots.find { it.id == selectedSlotId }
    }
    val hasAnyAvailableSlots = availableSlots.any { !it.isPast && isSlotFree(it.startHour, it.endHour) }
    val joiningSpotsLeft = joiningBooking?.let { it.maxPlayers - it.currentPlayers } ?: 0
    val isFormValid = (name.trim().isNotEmpty() || isAdminManual) && (phone.length == 10 || isAdminManual)
    val isJoinableValid = !isJoinable || (playersIHave >= 1 && playersIHave <= maxPlayersLimit)
    val canBook = isFormValid && selectedSlotId != null && isJoinableValid && currentLocation.isOpen



    fun handleOpenConfirm() {
        if (!isAdminManual) {
            if (selectedSlotId == null) {
                onAlert?.invoke("Please select a time slot", "error", null)
                return
            }
            if (name.trim().isEmpty()) {
                onAlert?.invoke("Please enter your name", "error", null)
                return
            }
            if (phone.length != 10) {
                onAlert?.invoke("Phone number must be 10 digits", "error", null)
                return
            }
            if (!isJoinableValid) {
                onAlert?.invoke("Invalid player count for joinable match", "error", null)
                return
            }
        }

        val slot = currentSelectedSlot ?: return
        validationError = ""
        loading = true
        scope.launch {
            try {
                val validation = validateBookingSlot(location.id, date, slot.startHour, slot.endHour, userRole, selectedCourtId)
                loading = false
                if (!validation.valid) {
                    validationError = validation.error ?: "This slot was just booked by someone else."
                    refreshBookings()
                    return@launch
                }
                showConfirm = true
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Validation failed", "error", null)
                loading = false
            }
        }
    }

    // Deep-link Join logic (Matching Web)
    LaunchedEffect(joinableBookings) {
        if (joiningBooking != null) return@LaunchedEffect
        
        val currentRaw = com.boxitt.app.services.Storage.prefs.getString("boxitt_page_data_$PAGE_ID", null)
        val currentMap = try {
            if (currentRaw != null) com.boxitt.app.services.Storage.json.decodeFromString<Map<String, String>>(currentRaw) else emptyMap()
        } catch (e: Exception) { emptyMap() }
        
        val preJoinId = currentMap["preJoinBookingId"]
        if (!preJoinId.isNullOrBlank()) {
            val target = joinableBookings.find { it.id == preJoinId }
            if (target != null) {
                joiningBooking = target
                
                // Refresh requests to update button state (Already Requested etc)
                launch {
                    try {
                        val result = ChallengeService.fetchChallengesAndMatches(user?.id, location.id)
                        userSentMatchRequests = result.userSentMatchRequests
                        userAcceptedMatches = result.userAcceptedMatches
                    } catch (e: Exception) { e.printStackTrace() }
                }
                
                // Clear the preJoinId from state
                val map = currentMap.toMutableMap()
                map.remove("preJoinBookingId")
                com.boxitt.app.services.Storage.prefs.edit().putString("boxitt_page_data_$PAGE_ID", com.boxitt.app.services.Storage.json.encodeToString(map)).apply()
            }
        }
    }

    suspend fun performBooking(): Booking? {
        if (isBooking) return null
        val slot = currentSelectedSlot ?: return null
        isBooking = true
        val effectiveTickets = if (selectedSport == "Swimming" || selectedSport == SportType.SWIMMING.value) swimmingTicketsCount else 1
        val totalSlotFee = slot.price * effectiveTickets
        val singleAdvance = slot.advancePrice
        val totalAdvance = singleAdvance * effectiveTickets
        val advanceAmt = if (paymentChoice == PaymentType.FULL) totalSlotFee else totalAdvance

        val newBooking = Booking(
            id = "BK-${(Math.random() * 1e9).toLong().toString(36).uppercase()}",
            name = name.trim().ifBlank { if (isAdminManual) "Admin Entry" else user?.displayName ?: "Unknown" },
            phone = phone.trim().ifBlank { if (isAdminManual) "0000000000" else user?.phoneNumber ?: "N/A" },
            date = date, locationId = location.id, courtId = selectedCourtId, slotId = slot.id, slotTime = slot.timeRange,
            startHour = slot.startHour, endHour = slot.endHour,
            amount = totalSlotFee, advancePaid = advanceAmt,
            advance_price = totalAdvance,
            status = BookingStatus.BOOKED, isJoinable = isJoinable,
            paymentType = paymentChoice.name.lowercase(),
            maxPlayers = if (isJoinable || isChallengeEnabled) maxPlayersLimit else (if (selectedSport == "Swimming" || selectedSport == SportType.SWIMMING.value) currentLocation.maxCapacity else 10),
            currentPlayers = if (selectedSport == "Swimming" || selectedSport == SportType.SWIMMING.value) effectiveTickets else (if (isJoinable) playersIHave else (if (isChallengeEnabled) maxPlayersLimit / 2 else 1)),
            sport = selectedSport,
            userId = user?.id,
            bookedBy = user?.displayName ?: user?.email ?: "User"
        )
        return try {
            val saved = BookingService.saveBooking(newBooking).getOrThrow()
            val realBookingId = saved.id
            allBookings = BookingService.getBookings(location.id, date)
            
            // Capture current states to local variables before background scope (Parity with Web)
            val challengeEnabledAtBooking = isChallengeEnabled
            val joinableAtBooking = isJoinable
            val userAtBooking = user
            val locationAtBooking = currentLocation
            val slotAtBooking = slot
            val dateAtBooking = date

            // Background broadcast logic (Matching Web)
            if ((challengeEnabledAtBooking || joinableAtBooking) && userAtBooking?.id != null) {
                scope.launch {
                    // 1. Insert into challenges table if enabled (Parity with Web)
                    if (challengeEnabledAtBooking) {
                        try {
                            val challengePayload = buildJsonObject {
                                put("box_id", locationAtBooking.id)
                                put("challenger_id", userAtBooking.id)
                                put("latitude", locationAtBooking.latitude ?: 0.0)
                                put("longitude", locationAtBooking.longitude ?: 0.0)
                                put("radius", 5)
                                put("status", "active")
                                put("slot_time", slotAtBooking.timeRange)
                                put("booking_id", realBookingId)
                                put("date", dateAtBooking)
                                put("max_players", if (challengeEnabledAtBooking) maxPlayersLimit else 10)
                                put("current_players", if (challengeEnabledAtBooking) maxPlayersLimit / 2 else 1)
                                put("sport", locationAtBooking.supportedSports.firstOrNull()?.value ?: "Box Cricket")
                            }
                            Supabase.client.postgrest["challenges"].insert(challengePayload)
                            android.util.Log.d("BookingPage", "Challenge created successfully for booking: $realBookingId")
                        } catch (e: Exception) {
                            android.util.Log.e("BookingPage", "Failed to create challenge", e)
                            e.printStackTrace()
                        }
                    }

                    // 2. Broadcast notifications
                    NotificationService.broadcastNewChallenge(
                        userId = userAtBooking.id,
                        userName = name.trim().ifBlank { userAtBooking.displayName ?: "A player" },
                        userPhone = phone.trim().ifBlank { userAtBooking.phoneNumber ?: "N/A" },
                        locationId = locationAtBooking.id,
                        locationName = locationAtBooking.name,
                        latitude = locationAtBooking.latitude ?: 0.0,
                        longitude = locationAtBooking.longitude ?: 0.0,
                        slotTime = slotAtBooking.timeRange,
                        date = dateAtBooking,
                        bookingId = realBookingId,
                        isChallenge = challengeEnabledAtBooking,
                        isJoinable = joinableAtBooking,
                        startHour = slotAtBooking.startHour,
                        endHour = slotAtBooking.endHour
                    )
                }
            }

            if (isAdminManual) {
                onComplete?.invoke()
                showConfirm = false
            } else {
                confirmedBooking = saved
            }
            // Clear slot but keep name/phone for persistence and reset toggles
            selectedSlotId = null
            isJoinable = false
            isChallengeEnabled = false
            saved
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            validationError = e.message ?: "Booking failed"
            null
        } finally {
            isBooking = false
        }
    }

    fun handleBooking() {
        scope.launch { performBooking() }
    }

    fun handleJoin() {
        val jb = joiningBooking ?: return
        if (!user?.id.isNullOrBlank() && userSentMatchRequests.contains(jb.id)) {
            onAlert?.invoke("Request already sent for this match", "info", null); return
        }
        isBooking = true
        scope.launch {
            try {
                BookingService.sendJoinRequest(jb, user!!, joiningPlayersCount, name, phone)
                
                // Send notifications (Matching Web)
                NotificationService.sendJoinRequestNotifications(
                    hostId = jb.userId ?: "",
                    joinerId = user.id ?: "",
                    joinerName = name.ifBlank { user.displayName ?: "A player" },
                    joinerPhone = phone.ifBlank { user.phoneNumber ?: "N/A" },
                    groupSize = joiningPlayersCount,
                    locationName = location.name,
                    date = jb.date,
                    slotTime = jb.slotTime,
                    bookingId = jb.id
                )

                showSuccess = true
                userSentMatchRequests = userSentMatchRequests + jb.id
                joiningBooking = null
                joiningPlayersCount = 1
                name = ""; phone = ""
                
                // Re-fetch to update button states immediately
                fetchUserRequests()
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Failed to send join request", "error", null)
            } finally {
                isBooking = false
            }
        }
    }

    val backgroundColor = theme.colors.background
    BoxWithConstraints(modifier = modifier.background(backgroundColor)) {
        val isExpanded = maxWidth > 840.dp && !isAdminManual
        
        if (isExpanded) {
            Row(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // Left Column: Location & Inputs
                Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    // Hero image replacement for desktop
                    Box(modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(28.dp))) {
                        val headerImages = remember(currentLocation, selectedCourtId) {
                            val court = currentLocation.courts?.find { it.id == selectedCourtId }
                            if (court?.imageUrls?.isNotEmpty() == true) {
                                court.imageUrls
                            } else {
                                currentLocation.imageUrls
                            }
                        }
                        val pagerState = rememberPagerState(pageCount = { headerImages.size })
                        
                        LaunchedEffect(headerImages) {
                            if (headerImages.size > 1) {
                                while (true) {
                                    kotlinx.coroutines.delay(5000)
                                    try {
                                        val nextPage = (pagerState.currentPage + 1) % headerImages.size
                                        pagerState.animateScrollToPage(nextPage)
                                    } catch (e: Exception) {
                                        if (e is CancellationException) throw e
                                    }
                                }
                            }
                        }

                        if (headerImages.isNotEmpty()) {
                            HorizontalPager(
                                state = pagerState,
                                modifier = Modifier.fillMaxSize()
                            ) { page ->
                                AsyncImage(
                                    model = headerImages[page],
                                    contentDescription = null,
                                    modifier = Modifier.fillMaxSize().alpha(0.4f),
                                    contentScale = ContentScale.Crop
                                )
                            }
                        } else {
                            Box(modifier = Modifier.fillMaxSize().background(theme.colors.backgroundSecondary))
                        }
                        Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf<Color>(Color.Transparent, backgroundColor.copy(0.8f)))))
                        Column(
                            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(currentLocation.name.uppercase(), fontSize = 24.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, letterSpacing = (-1).sp, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)
                            Text(currentLocation.address.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
                        }
                    }

                    // Inputs Card
                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(28.dp)).padding(20.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Column {
                                Text("PLAYER NAME", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                Spacer(Modifier.height(6.dp))
                                OutlinedTextField(value = name, onValueChange = { name = it }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, focusedContainerColor = theme.colors.backgroundSecondary.copy(0.4f), unfocusedContainerColor = theme.colors.backgroundSecondary.copy(0.4f), focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                            }
                            Column {
                                Text("PHONE NUMBER", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                Spacer(Modifier.height(6.dp))
                                OutlinedTextField(value = phone, onValueChange = { v -> phone = v.filter { it.isDigit() }.take(10) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, focusedContainerColor = theme.colors.backgroundSecondary.copy(0.4f), unfocusedContainerColor = theme.colors.backgroundSecondary.copy(0.4f), focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                            }
                            if (joiningBooking == null) {
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("DURATION", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                        Box(modifier = Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary.copy(0.4f)).clickable { showDurationPicker = true }.padding(horizontal = 12.dp), contentAlignment = Alignment.CenterStart) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                                Text(availableDurations.find { it.value == duration }?.label ?: "Select", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                                                Icon(Icons.Default.ExpandMore, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                                            }
                                        }
                                    }
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("DATE", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                        Box(modifier = Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary.copy(0.4f)).clickable { showDatePicker = true }.padding(horizontal = 12.dp), contentAlignment = Alignment.CenterStart) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                                Text(date.split("-").let { p -> if (p.size >= 3) "${p[2]}/${p[1]}" else date }, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                                                Icon(Icons.Default.CalendarToday, null, tint = theme.colors.accent, modifier = Modifier.size(14.dp))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Middle Column: Slots & Available Matches
                Column(modifier = Modifier.weight(1.5f), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    Box(modifier = Modifier.fillMaxWidth().weight(1f).clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(28.dp)).padding(24.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                            if (joiningBooking == null) {
                                // Court Selection
                                Column {
                                    Text("SELECT COURT", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    Spacer(Modifier.height(8.dp))
                                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        location.courts?.forEach { court ->
                                            val selected = selectedCourtId == court.id
                                            Box(
                                                modifier = Modifier.clip(RoundedCornerShape(12.dp))
                                                    .background(if (selected) theme.colors.accent else theme.colors.backgroundSecondary.copy(0.4f))
                                                    .border(1.dp, if (selected) theme.colors.accent else theme.colors.border.copy(0.2f), RoundedCornerShape(12.dp))
                                                    .clickable { selectedCourtId = court.id; selectedSlotId = null }
                                                    .padding(horizontal = 16.dp, vertical = 10.dp)
                                            ) {
                                                Text(court.name ?: "Court ${court.courtNumber}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (selected) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                            }
                                        }
                                    }
                                }

                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column {
                                        Text("SELECT TIME", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        val currentCourtTiming = location.courts?.find { it.id == selectedCourtId }
                                        Text("Open: ${currentCourtTiming?.open_hour ?: location.openHour ?: 6}:00 - Close: ${currentCourtTiming?.close_hour ?: location.closeHour ?: 23}:00", fontSize = 9.sp, color = theme.colors.textDisabled.copy(0.6f))
                                    }
                                }
                                if (loading) {
                                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = theme.colors.accent) }
                                } else if (!currentLocation.isOpen) {
                                    Box(modifier = Modifier.fillMaxWidth().weight(1f).clip(RoundedCornerShape(20.dp)).background(Color.White.copy(0.05f)).border(1.dp, theme.colors.error.copy(0.4f), RoundedCornerShape(20.dp)).padding(24.dp), contentAlignment = Alignment.Center) {
                                        Text("THIS ARENA IS CURRENTLY CLOSED FOR BOOKINGS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.error, letterSpacing = 2.sp, textAlign = TextAlign.Center)
                                    }
                                } else {
                                    LazyVerticalGrid(
                                        columns = GridCells.Fixed(2),
                                        modifier = Modifier.fillMaxSize(),
                                        state = slotsGridState,
                                        verticalArrangement = Arrangement.spacedBy(10.dp),
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        items(availableSlots) { slot ->
                                            val (bookedCount, slotCapacity, isFree) = getSlotBookingStats(slot.startHour, slot.endHour)
                                            val isAvailable = !slot.isPast && isFree
                                            val isSelected = selectedSlotId == slot.id
                                            val isFull = bookedCount >= slotCapacity
                                            Box(
                                                modifier = Modifier.clip(RoundedCornerShape(16.dp)).background(when { isSelected -> theme.colors.accent.copy(0.2f); isAvailable -> theme.colors.backgroundSecondary.copy(0.4f); else -> Color.Transparent }).border(1.5.dp, if (isSelected) theme.colors.accent else Color.Transparent, RoundedCornerShape(16.dp)).clickable(enabled = isAvailable && !isBooking) { selectedSlotId = slot.id }.padding(12.dp).then(if (!isAvailable) Modifier.alpha(0.25f) else Modifier),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text(slot.startTime, fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (isSelected) theme.colors.textPrimary else theme.colors.textSecondary)
                                                    Text(slot.endTime, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                                                    Spacer(modifier = Modifier.height(4.dp))
                                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                                        Text("₹${slot.price.toInt()}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                                        Text(text = if (isFull) "FULL ($bookedCount/$slotCapacity)" else "$bookedCount/$slotCapacity", fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (isFull) Color.Red else theme.colors.accent)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                // Joining Panel
                                val jb = joiningBooking!!
                                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Column {
                                            Text("SQUAD JOIN", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)
                                            Text(jb.slotTime, fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
                                        }
                                        IconButton(onClick = { if (!isBooking) joiningBooking = null }) { Icon(Icons.Default.Close, null, tint = theme.colors.accent) }
                                    }
                                    // Player count & Contribution
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.backgroundSecondary.copy(0.6f)).padding(20.dp)) {
                                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                            Text("YOUR CONTRIBUTION", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, letterSpacing = 2.sp)
                                            Text("₹${ceil(jb.amount.toDouble() / (jb.currentPlayers + joiningPlayersCount)).toInt()}", fontSize = 32.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                        }
                                    }
                                    LoadingButton(onClick = { handleJoin() }, loading = isBooking, enabled = isFormValid, text = "CONFIRM & JOIN SQUAD", loadingText = "Joining...", gradient = theme.colors.buttonGradient)
                                }
                            }
                        }
                    }
                }

                // Right Column: actions & Payment
                Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(32.dp)) {
                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(28.dp)).padding(24.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                            if (selectedSlotId != null && joiningBooking == null && (location.advance_booking_required == true || isChallengeEnabled || isJoinable)) {
                                Column {
                                    Text("PAYMENT STRATEGY", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    Spacer(Modifier.height(10.dp))
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        val paymentOptions = if (isChallengeEnabled || isJoinable) {
                                            listOf(PaymentType.ADVANCE to "Security Advance")
                                        } else {
                                            listOf(PaymentType.ADVANCE to "Security Advance", PaymentType.FULL to "Pre-paid Full")
                                        }
                                        paymentOptions.forEach { (type, label) ->
                                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(if (paymentChoice == type) theme.colors.accent else theme.colors.backgroundSecondary.copy(0.4f)).clickable(enabled = !isBooking) { paymentChoice = type }.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                                                Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (paymentChoice == type) Color.White else theme.colors.textDisabled)
                                            }
                                        }
                                    }
                                }
                            }

                            ChallengeCard(isEnabled = isChallengeEnabled, onToggle = { 
                                isChallengeEnabled = it
                                if (it) {
                                    isJoinable = false
                                    paymentChoice = PaymentType.ADVANCE
                                } else if (location.advance_booking_required != true && !isJoinable) {
                                    paymentChoice = PaymentType.FULL
                                }
                            }, disabled = isBooking) {
                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Column {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text("MATCH FORMAT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Text("${maxPlayersLimit / 2}v${maxPlayersLimit / 2}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                        }
                                        Spacer(Modifier.height(8.dp))
                                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            listOf(6, 8, 10, 12, 14, 16).forEach { num ->
                                                Box(
                                                    modifier = Modifier.size(60.dp, 44.dp).clip(RoundedCornerShape(10.dp)).background(if (maxPlayersLimit == num) theme.colors.accent else Color.Transparent).border(2.dp, if (maxPlayersLimit == num) theme.colors.accent else theme.colors.border.copy(0.4f), RoundedCornerShape(10.dp)).clickable(enabled = !isBooking) { maxPlayersLimit = num },
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text("${num / 2}v${num / 2}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (maxPlayersLimit == num) Color.White else theme.colors.textDisabled)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            JoinableCard(isJoinable = isJoinable, onToggle = { 
                                isJoinable = it
                                if (it) {
                                    isChallengeEnabled = false
                                    paymentChoice = PaymentType.ADVANCE
                                } else if (location.advance_booking_required != true && !isChallengeEnabled) {
                                    paymentChoice = PaymentType.FULL
                                }
                            }, disabled = isBooking) {
                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Text("MAX PLAYERS: $maxPlayersLimit", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        listOf(6, 8, 10, 12, 14, 16).forEach { num ->
                                            Box(modifier = Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)).background(if (maxPlayersLimit == num) theme.colors.accent else Color.Transparent).border(2.dp, if (maxPlayersLimit == num) theme.colors.accent else theme.colors.border.copy(0.4f), RoundedCornerShape(10.dp)).clickable(enabled = !isBooking) { maxPlayersLimit = num }, contentAlignment = Alignment.Center) { Text("$num", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (maxPlayersLimit == num) Color.White else theme.colors.textDisabled) }
                                        }
                                    }
                                }
                            }

                            if (validationError.isNotBlank()) {
                                Text(validationError, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.colors.error)
                            }

                            if (joiningBooking == null) {
                                LoadingButton(
                                    onClick = { handleOpenConfirm() },
                                    enabled = !loading && !isBooking,
                                    loading = isBooking,
                                    text = "CONFIRM ARENA",
                                    loadingText = "Confirming...",
                                    gradient = theme.colors.buttonGradient,
                                    modifier = Modifier.alpha(if (canBook) 1f else 0.5f)
                                )
                            }
                        }
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().background(backgroundColor),
                state = lazyListState,
                contentPadding = PaddingValues(bottom = 16.dp)
            ) {
                // Hero image header (non-admin) - Slideshow like Web
                if (!isAdminManual) {
                    item {
                        val headerImages = remember(currentLocation, selectedCourtId) {
                            val court = currentLocation.courts?.find { it.id == selectedCourtId }
                            if (court?.imageUrls?.isNotEmpty() == true) {
                                court.imageUrls
                            } else {
                                currentLocation.imageUrls
                            }
                        }
                        val pagerState = rememberPagerState(pageCount = { headerImages.size })
                        
                        // Auto-scroll logic (Parity with Web)
                        LaunchedEffect(headerImages) {
                            if (headerImages.size > 1) {
                                while (true) {
                                    kotlinx.coroutines.delay(5000)
                                    try {
                                        val nextPage = (pagerState.currentPage + 1) % headerImages.size
                                        pagerState.animateScrollToPage(nextPage)
                                    } catch (e: Exception) {
                                        if (e is CancellationException) throw e
                                    }
                                }
                            }
                        }
                        
                        Box(modifier = Modifier.fillMaxWidth().height(220.dp)) {
                            if (headerImages.isNotEmpty()) {
                                HorizontalPager(
                                    state = pagerState,
                                    modifier = Modifier.fillMaxSize()
                                ) { page ->
                                    AsyncImage(
                                        model = headerImages[page],
                                        contentDescription = null,
                                        modifier = Modifier.fillMaxSize().alpha(0.3f), // Parity with Web opacity-30
                                        contentScale = ContentScale.Crop
                                    )
                                }
                            } else {
                                Box(modifier = Modifier.fillMaxSize().background(theme.colors.backgroundSecondary))
                            }
                            
                            Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf<Color>(Color.Transparent, backgroundColor))))

                            // Back Button (Parity with mobile-first navigation)
                            if (onBack != null) {
                                IconButton(
                                    onClick = onBack,
                                    modifier = Modifier
                                        .align(Alignment.TopStart)
                                        .padding(16.dp)
                                        .size(40.dp)
                                        .clip(CircleShape)
                                        .background(Color.Black.copy(0.2f))
                                ) {
                                    Icon(Icons.Default.ArrowBack, null, tint = Color.White, modifier = Modifier.size(20.dp))
                                }
                            }
                            
                            Column(
                                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(currentLocation.name.uppercase(), fontSize = 32.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, letterSpacing = (-1).sp, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)
                                Text(currentLocation.address.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 4.sp)
                            }

                            // Pager indicators (Parity with Web LocationCard)
                            if (headerImages.size > 1) {
                                Row(
                                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 60.dp),
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    repeat(headerImages.size) { i ->
                                        Box(
                                            modifier = Modifier
                                                .height(4.dp)
                                                .width(if (i == pagerState.currentPage) 20.dp else 6.dp)
                                                .clip(RoundedCornerShape(2.dp))
                                                .background(if (i == pagerState.currentPage) theme.colors.accent else Color.White.copy(0.4f))
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = if (isAdminManual) 8.dp else 0.dp)
                            .clip(RoundedCornerShape(28.dp))
                            .background(theme.colors.card)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(28.dp))
                    ) {
                        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            // Name field
                            Column {
                                Text("PLAYER NAME", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                Spacer(Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = name,
                                    onValueChange = { name = it },
                                    placeholder = { Text("Your Name", color = theme.colors.textDisabled) },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = theme.colors.accent,
                                        unfocusedBorderColor = Color.Transparent,
                                        focusedContainerColor = theme.colors.backgroundSecondary.copy(0.4f),
                                        unfocusedContainerColor = theme.colors.backgroundSecondary.copy(0.4f),
                                        focusedTextColor = theme.colors.textPrimary,
                                        unfocusedTextColor = theme.colors.textPrimary
                                    )
                                )
                            }

                            // Phone field
                            Column {
                                Text("PHONE NUMBER", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                Spacer(Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = phone,
                                    onValueChange = { v -> phone = v.filter { it.isDigit() }.take(10) },
                                    placeholder = { Text("10 Digits", color = theme.colors.textDisabled) },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = theme.colors.accent,
                                        unfocusedBorderColor = Color.Transparent,
                                        focusedContainerColor = theme.colors.backgroundSecondary.copy(0.4f),
                                        unfocusedContainerColor = theme.colors.backgroundSecondary.copy(0.4f),
                                        focusedTextColor = theme.colors.textPrimary,
                                        unfocusedTextColor = theme.colors.textPrimary
                                    )
                                )
                            }

                            // Duration + Date selectors (only when not joining)
                            if (joiningBooking == null) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    // Duration
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("MATCH DURATION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        Spacer(Modifier.height(6.dp))
                                        Box(
                                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary.copy(0.4f)).clickable { showDurationPicker = true }.padding(16.dp),
                                            contentAlignment = Alignment.CenterStart
                                        ) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                                val selectedDurationLabel = availableDurations.find { it.value == duration }?.label ?: "Select"
                                                Text(selectedDurationLabel, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                                                Icon(Icons.Default.ExpandMore, null, tint = theme.colors.accent, modifier = Modifier.size(18.dp))
                                            }
                                        }
                                    }
                                    // Date
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("MATCH DATE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        Spacer(Modifier.height(6.dp))
                                        Box(
                                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary.copy(0.4f)).clickable { showDatePicker = true }.padding(16.dp),
                                            contentAlignment = Alignment.CenterStart
                                        ) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                                val dateLabel = date.split("-").let { p -> if (p.size == 3) "${p[2]}/${p[1]}/${p[0]}" else date }
                                                Text(dateLabel, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                                                Icon(Icons.Default.CalendarToday, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Joinable matches carousel
                if (joinableBookings.isNotEmpty() && joiningBooking == null && (savedState?.get("preJoinBookingId") ?: "").isBlank()) {
                    item {
                        Column(modifier = Modifier.padding(top = 24.dp)) {
                            Row(modifier = Modifier.padding(horizontal = 24.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text("AVAILABLE MATCHES", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accentGlow, letterSpacing = 2.sp)
                                Divider(modifier = Modifier.weight(1f), color = theme.colors.border.copy(0.4f))
                            }
                            Spacer(Modifier.height(12.dp))
                            LazyRow(contentPadding = PaddingValues(horizontal = 24.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                items(joinableBookings) { jb ->
                                    val isHost = user?.id != null && jb.userId == user.id
                                    Box(modifier = Modifier.width(280.dp)) {
                                        JoinGameCard(booking = jb, onJoin = { joiningBooking = it }, isHost = isHost)
                                    }
                                }
                            }
                        }
                    }
                }

                // Slot grid
                item {
                    if (joiningBooking == null) {
                        Column(modifier = Modifier.padding(24.dp)) {
                            // Court Selection
                            Text("SELECT COURT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(8.dp))
                            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                currentLocation.courts?.forEach { court ->
                                    val selected = selectedCourtId == court.id
                                    Box(
                                        modifier = Modifier.clip(RoundedCornerShape(12.dp))
                                            .background(if (selected) theme.colors.accent else theme.colors.backgroundSecondary.copy(0.4f))
                                            .border(1.dp, if (selected) theme.colors.accent else theme.colors.border.copy(0.2f), RoundedCornerShape(12.dp))
                                            .clickable { selectedCourtId = court.id; selectedSlotId = null }
                                            .padding(horizontal = 16.dp, vertical = 10.dp)
                                    ) {
                                        Text(court.name ?: "Court ${court.courtNumber}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (selected) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                    }
                                }
                            }
                            Spacer(Modifier.height(20.dp))

                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column {
                                    Text("SELECT TIME", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    val currentCourtTiming = currentLocation.courts?.find { it.id == selectedCourtId }
                                    Text("Open: ${currentCourtTiming?.open_hour ?: currentLocation.openHour ?: 6}:00 - Close: ${currentCourtTiming?.close_hour ?: currentLocation.closeHour ?: 23}:00", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled.copy(0.6f), letterSpacing = 1.sp)
                                }
                                if (date == todayStr() && hasAnyAvailableSlots) {
                                    Box(modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(theme.colors.success.copy(0.2f)).padding(horizontal = 10.dp, vertical = 4.dp)) {
                                        Text("AVAILABLE NOW", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.success, letterSpacing = 1.sp)
                                    }
                                }
                            }
                            Spacer(Modifier.height(10.dp))
                            if (loading) {
                                Box(modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                                    CircularProgressIndicator(color = theme.colors.accent)
                                }
                            } else if (!currentLocation.isOpen) {
                                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color.White.copy(0.05f)).border(1.dp, theme.colors.error.copy(0.4f), RoundedCornerShape(20.dp)).padding(24.dp), contentAlignment = Alignment.Center) {
                                    Text("THIS ARENA IS CURRENTLY CLOSED FOR BOOKINGS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.error, letterSpacing = 2.sp, textAlign = TextAlign.Center)
                                }
                            } else if (!hasAnyAvailableSlots) {
                                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color.White.copy(0.05f)).border(1.dp, theme.colors.border.copy(0.4f), RoundedCornerShape(20.dp)).padding(24.dp), contentAlignment = Alignment.Center) {
                                    Text("NO SLOTS FOUND", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                }
                            } else {
                                // Slots grid (2 columns matching web)
                                LazyVerticalGrid(
                                    columns = GridCells.Fixed(2),
                                    modifier = Modifier.heightIn(max = 320.dp), // Slightly increased height for 2 columns
                                    state = slotsGridState,
                                    verticalArrangement = Arrangement.spacedBy(10.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(availableSlots) { slot ->
                                        val isAvailable = !slot.isPast && isSlotFree(slot.startHour, slot.endHour)
                                        val isSelected = selectedSlotId == slot.id
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(16.dp))
                                                .background(when {
                                                    isSelected -> theme.colors.accent.copy(0.2f)
                                                    isAvailable -> theme.colors.backgroundSecondary.copy(0.4f)
                                                    else -> Color.Transparent
                                                })
                                                .border(1.5.dp, if (isSelected) theme.colors.accent else Color.Transparent, RoundedCornerShape(16.dp))
                                                .clickable(enabled = isAvailable && !isBooking) { selectedSlotId = slot.id }
                                                .padding(vertical = 12.dp)
                                                .then(if (!isAvailable) Modifier.alpha(0.25f) else Modifier),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(slot.startTime, fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (isSelected) theme.colors.textPrimary else theme.colors.textSecondary)
                                                Text("₹${slot.price.toInt()}", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Joining booking panel
                item {
                    if (joiningBooking != null) {
                        val jb = joiningBooking!!
                        val isHost = user?.id != null && jb.userId == user.id
                        Box(
                            modifier = Modifier.padding(horizontal = 24.dp).fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.accent.copy(0.1f)).border(1.dp, theme.colors.accent.copy(0.3f), RoundedCornerShape(24.dp)).padding(20.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                                    Column {
                                        Text(if (isHost) "YOUR MATCH" else "SQUAD JOIN", fontSize = 16.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)
                                        Text(jb.slotTime, fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
                                    }
                                    IconButton(onClick = { if (!isBooking) joiningBooking = null }) {
                                        Icon(Icons.Default.Close, null, tint = theme.colors.accent)
                                    }
                                }

                                // Player count selector
                                Column {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("ADDING PLAYERS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        Text("$joiningPlayersCount", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        (1..joiningSpotsLeft.coerceAtLeast(1)).forEach { num ->
                                            Box(
                                                modifier = Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)).background(if (joiningPlayersCount == num) theme.colors.accent else Color.Transparent).border(2.dp, if (joiningPlayersCount == num) theme.colors.accent else theme.colors.border.copy(0.4f), RoundedCornerShape(10.dp)).clickable(enabled = !isBooking) { joiningPlayersCount = num },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text("$num", fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (joiningPlayersCount == num) Color.White else theme.colors.textDisabled)
                                            }
                                        }
                                    }
                                }

                                // Contribution display
                                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.backgroundSecondary.copy(0.6f)).border(1.dp, theme.colors.accent.copy(0.2f), RoundedCornerShape(16.dp)).padding(16.dp)) {
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text("MATCH TOTAL", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Text("₹${jb.amount}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                        }
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text("YOUR CONTRIBUTION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, letterSpacing = 2.sp)
                                            Text("₹${ceil(jb.amount.toDouble() / (jb.currentPlayers + joiningPlayersCount)).toInt()}", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                        }
                                    }
                                }

                                LoadingButton(
                                    onClick = { handleJoin() },
                                    loading = isBooking,
                                    enabled = isFormValid && !isHost && !userSentMatchRequests.contains(jb.id),
                                    text = when {
                                        isHost -> "HOST CANNOT JOIN"
                                        userSentMatchRequests.contains(jb.id) || userAcceptedMatches.contains(jb.id) -> "SEND ANOTHER JOIN REQUEST"
                                        else -> "CONFIRM & JOIN SQUAD"
                                    },
                                    loadingText = "Joining...",
                                    gradient = if (!isHost && !userSentMatchRequests.contains(jb.id)) theme.colors.buttonGradient else listOf(theme.colors.textDisabled, theme.colors.textDisabled)
                                )
                            }
                        }
                    }
                }

                // Payment toggle (only when slot selected)
                item {
                    if (selectedSlotId != null && joiningBooking == null) {
                        Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)) {
                            Text("PAYMENT STRATEGY", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.backgroundSecondary.copy(0.4f)).border(1.dp, theme.colors.border.copy(0.2f), RoundedCornerShape(16.dp)).padding(6.dp),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                val paymentOptions = if (isChallengeEnabled || isJoinable) {
                                    listOf(PaymentType.ADVANCE to "Security Advance")
                                } else {
                                    listOf(PaymentType.ADVANCE to "Security Advance", PaymentType.FULL to "Pre-paid Full")
                                }
                                paymentOptions.forEach { (type, label) ->
                                    val effectiveTickets = if (selectedSport == "Swimming" || selectedSport == SportType.SWIMMING.value) swimmingTicketsCount else 1
                                    val unitPrice = currentSelectedSlot?.price ?: 0.0
                                    val unitAdvance = currentSelectedSlot?.advancePrice ?: currentLocation.minAdvance ?: unitPrice
                                    val feeText = if (type == PaymentType.ADVANCE) "₹${(unitAdvance * effectiveTickets).toInt()}" else "₹${(unitPrice * effectiveTickets).toInt()}"
                                    Box(
                                        modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (paymentChoice == type) theme.colors.accent else Color.Transparent).clickable(enabled = !isBooking) { paymentChoice = type }.padding(vertical = 8.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (paymentChoice == type) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                            Text(feeText, fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (paymentChoice == type) Color.White else theme.colors.accent)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Challenge + Joinable toggles (non-admin)
                item {
                    if (!isAdminManual && joiningBooking == null && selectedSport != SportType.SWIMMING) {
                        Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            ChallengeCard(isEnabled = isChallengeEnabled, onToggle = { 
                                isChallengeEnabled = it
                                if (it) {
                                    isJoinable = false
                                    paymentChoice = PaymentType.ADVANCE
                                } else if (location.advance_booking_required != true && !isJoinable) {
                                    paymentChoice = PaymentType.FULL
                                }
                            }, disabled = isBooking) {
                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Column {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text("MATCH FORMAT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            val formatText = when (selectedSport) {
                                                "Box Badminton", "Box Tennis" -> if (maxPlayersLimit == 2) "1v1" else "2v2"
                                                else -> "${maxPlayersLimit / 2}v${maxPlayersLimit / 2}"
                                            }
                                            Text(formatText, fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                        }
                                        Spacer(Modifier.height(8.dp))
                                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            val capacities = sportConfig.capacityOptions
                                            for (num in capacities) {
                                                val btnText = when (selectedSport) {
                                                    "Box Badminton", "Box Tennis" -> if (num == 2) "1v1" else "2v2"
                                                    else -> "${num / 2}v${num / 2}"
                                                }
                                                Box(
                                                    modifier = Modifier.size(60.dp, 44.dp).clip(RoundedCornerShape(10.dp)).background(if (maxPlayersLimit == num) theme.colors.accent else Color.Transparent).border(2.dp, if (maxPlayersLimit == num) theme.colors.accent else theme.colors.border.copy(0.4f), RoundedCornerShape(10.dp)).clickable(enabled = !isBooking) { maxPlayersLimit = num },
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text(btnText, fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (maxPlayersLimit == num) Color.White else theme.colors.textDisabled)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            JoinableCard(isJoinable = isJoinable, onToggle = { 
                                isJoinable = it
                                if (it) {
                                    isChallengeEnabled = false
                                    paymentChoice = PaymentType.ADVANCE
                                } else if (location.advance_booking_required != true && !isChallengeEnabled) {
                                    paymentChoice = PaymentType.FULL
                                }
                            }, disabled = isBooking) {
                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Column {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text("PLAYER CAPACITY", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Text("$maxPlayersLimit", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                        }
                                        Spacer(Modifier.height(8.dp))
                                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            sportConfig.capacityOptions.forEach { num ->
                                                Box(modifier = Modifier.size(50.dp).clip(RoundedCornerShape(10.dp)).background(if (maxPlayersLimit == num) theme.colors.accent else Color.Transparent).border(2.dp, if (maxPlayersLimit == num) theme.colors.accent else theme.colors.border.copy(0.4f), RoundedCornerShape(10.dp)).clickable(enabled = !isBooking) { maxPlayersLimit = num }, contentAlignment = Alignment.Center) {
                                                    Text("$num", fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (maxPlayersLimit == num) Color.White else theme.colors.textDisabled)
                                                }
                                            }
                                        }
                                    }

                                    Column {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text("MY SQUAD SIZE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            Text("$playersIHave", fontSize = 18.sp, fontWeight = FontWeight.Black, color = if (playersIHave > maxPlayersLimit) theme.colors.error else theme.colors.textPrimary)
                                        }
                                        Spacer(Modifier.height(8.dp))
                                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            val sizes = sportConfig.squadSizeOptions.filter { it <= maxPlayersLimit }
                                            for (num in sizes) {
                                                Box(modifier = Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)).background(if (playersIHave == num) theme.colors.accent else Color.Transparent).border(2.dp, if (playersIHave == num) theme.colors.accent else theme.colors.border.copy(0.4f), RoundedCornerShape(10.dp)).clickable(enabled = !isBooking) { playersIHave = num }, contentAlignment = Alignment.Center) {
                                                    Text("$num", fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (playersIHave == num) Color.White else theme.colors.textDisabled)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Validation error
                item {
                    if (validationError.isNotBlank()) {
                        Box(modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(theme.colors.error.copy(0.1f)).border(1.dp, theme.colors.error.copy(0.3f), RoundedCornerShape(12.dp)).padding(start = 12.dp, top = 8.dp, bottom = 8.dp)) {
                            Text(validationError, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.colors.error)
                        }
                    }
                }

                // Confirm button
                item {
                    if (joiningBooking == null) {
                        Box(modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)) {
                            LoadingButton(
                                onClick = { handleOpenConfirm() },
                                enabled = canBook && !loading,
                                loading = isBooking,
                                text = if (isAdminManual) "SUBMIT MANUAL" else "CONFIRM ARENA",
                                loadingText = "Confirming...",
                                gradient = theme.colors.buttonGradient
                            )
                        }
                    }
                }
            }
        }
    }

    // Confirm Modal
    if (showConfirm) {
        val effectiveTickets = if (selectedSport == "Swimming" || selectedSport == SportType.SWIMMING.value) swimmingTicketsCount else 1
        val unitPrice = currentSelectedSlot?.price ?: 0.0
        val unitAdvance = currentSelectedSlot?.advancePrice ?: currentLocation.minAdvance ?: unitPrice
        val calculatedTotalFee = (unitPrice * effectiveTickets).toInt()
        val calculatedAdvanceFee = (unitAdvance * effectiveTickets).toInt()
        val calculatedPayableNow = if (paymentChoice == PaymentType.FULL) calculatedTotalFee else calculatedAdvanceFee
        val selectedCourtName = remember(selectedCourtId, location) {
            location.courts?.find { it.id == selectedCourtId }?.name ?: "Court 1"
        }

        Dialog(
            onDismissRequest = { showConfirm = false },
            properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).clip(RoundedCornerShape(28.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(28.dp)).padding(28.dp)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)).background(theme.colors.accent), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.CheckCircle, null, tint = Color.White, modifier = Modifier.size(32.dp))
                    }
                    Spacer(Modifier.height(16.dp))
                    Text(if (isAdminManual) "FINAL CHECK" else "PAYMENT SUMMARY", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)
                    Spacer(Modifier.height(16.dp))
                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.backgroundSecondary.copy(0.4f)).border(1.dp, theme.colors.border.copy(0.2f), RoundedCornerShape(16.dp)).padding(16.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("SPORT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text(selectedSport.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            }
                            if (selectedSport == "Swimming" || selectedSport == SportType.SWIMMING.value) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("TICKETS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                    Text("$effectiveTickets Tickets", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                }
                            } else {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("COURT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                    Text(selectedCourtName.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                }
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("DATE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text(date, fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            }
                            if (currentSelectedSlot != null) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("TIME SLOT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                    Text(currentSelectedSlot.timeRange, fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                }
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("DURATION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text(duration, fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            }
                            HorizontalDivider(color = theme.colors.border.copy(0.2f))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("TOTAL ARENA FEE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text("₹$calculatedTotalFee", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("PAYABLE NOW", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 1.sp)
                                Text("₹$calculatedPayableNow", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    LoadingButton(
                        onClick = {
                            if (isAdminManual) {
                                handleBooking()
                            } else {
                                showConfirm = false
                                showPayment = true
                            }
                        },
                        loading = isBooking,
                        text = if (isAdminManual) "FINALIZE" else "PAY NOW",
                        loadingText = "Processing...",
                        backgroundColor = theme.colors.accent
                    )
                    TextButton(onClick = { showConfirm = false }) { Text("Discard", color = theme.colors.textDisabled, fontWeight = FontWeight.Black, fontSize = 9.sp, letterSpacing = 2.sp) }
                }
            }
        }
    }

    // Payment Page
    if (showPayment && currentSelectedSlot != null) {
        val courtName = remember(selectedCourtId, location) {
            location.courts?.find { it.id == selectedCourtId }?.name ?: "Court 1"
        }
        PaymentPage(
            amount = (if (paymentChoice == PaymentType.FULL) currentSelectedSlot!!.price else currentSelectedSlot!!.advancePrice).toDouble(),
            bookingId = confirmedBooking?.id ?: UUID.randomUUID().toString().take(6).uppercase(),
            locationName = location.name, 
            courtName = courtName,
            date = date, 
            slotTime = currentSelectedSlot!!.timeRange,
            totalFee = currentSelectedSlot!!.price.toInt(), onBack = { showPayment = false },
            onPay = {
                scope.launch {
                    val result = performBooking()
                    if (result != null) {
                        showPayment = false
                        showSuccess = true
                    } else {
                        // User feedback on failure (Avoid stuck state)
                        onAlert?.invoke(validationError.ifBlank { "Unable to process booking. Please try again or check your connection." }, "error", null)
                    }
                }
            },
            isLoading = isBooking
        )
    }

    // QR Modal
    if (showQR && confirmedBooking != null) {
        QRCodeModal(booking = confirmedBooking!!, location = location, onClose = { showQR = false }, onAlert = onAlert)
    }

    // Success Modal
    SuccessModal(
        isOpen = showSuccess,
        onConfirm = { 
            showSuccess = false
            if (confirmedBooking != null) {
                showQR = true
            }
        },
        title = "SUCCESS",
        message = if (joiningBooking != null) "Join request sent to host!" else "Booking successful! Your ticket is ready."
    )

    // Duration Picker
    DurationPickerModal(
        isOpen = showDurationPicker, onClose = { showDurationPicker = false },
        options = availableDurations,
        selectedValue = duration,
        onSelect = { v -> duration = v; selectedSlotId = null; validationError = "" }
    )

    // Date Picker
    DatePickerModal(
        isOpen = showDatePicker, onClose = { showDatePicker = false },
        selectedDate = date, minDate = todayStr(),
        onSelect = { d -> date = d; selectedSlotId = null }
    )
}
