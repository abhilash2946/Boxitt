package com.boxitt.app.pages

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.rememberAsyncImagePainter
import androidx.navigation.NavHostController
import kotlin.math.abs
import com.boxitt.app.navigation.Screen
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.boxitt.app.Booking
import com.boxitt.app.ChallengeItem
import com.boxitt.app.Location
import com.boxitt.app.User
import com.boxitt.app.components.QRCodeModal
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.hooks.UserProfileViewModel
import com.boxitt.app.services.ChallengeService
import com.boxitt.app.services.Storage
import com.boxitt.app.services.Supabase
import com.boxitt.app.utils.DistanceUtils
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.PostgresJoinConfig
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

// Tabs for matchmaking filter
enum class MatchTab { ALL, CHALLENGES, MATCHES, YOURS }

@Composable
fun ChallengesPage(
    user: User?,
    selectedLocation: Location? = null,
    sport: String? = null,
    initialSearchQuery: String? = null,
    onBack: () -> Unit,
    onOpenBooking: ((Location?, String?) -> Unit)? = null,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    navController: NavHostController? = null
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()
    val userProfileViewModel = remember { UserProfileViewModel(scope) }

    LaunchedEffect(Unit) {
        userProfileViewModel.fetchCurrentUserProfile()
    }
    val userProfile = userProfileViewModel.currentUserProfile

    val activeSport = remember(sport) {
        sport ?: Storage.prefs.getString("boxitt_selected_sport", null)
    }

    var items by remember { mutableStateOf<List<ChallengeItem>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var loadingMore by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var processingId by remember { mutableStateOf<String?>(null) }
    var expandedChallengeId by remember { mutableStateOf<String?>(null) }
    var activeTab by remember { mutableStateOf(MatchTab.ALL) }
    var searchQuery by remember { mutableStateOf(initialSearchQuery ?: "") }
    var currentOffset by remember { mutableStateOf(0) }
    var hasMore by remember { mutableStateOf(true) }

    var userSentRequests by remember { mutableStateOf<Set<String>>(emptySet()) }
    var userAcceptedChallenges by remember { mutableStateOf<Set<String>>(emptySet()) }
    var hostAcceptedChallenges by remember { mutableStateOf<Set<String>>(emptySet()) }
    var userSentMatchRequests by remember { mutableStateOf<Set<String>>(emptySet()) }
    var userAcceptedMatches by remember { mutableStateOf<Set<String>>(emptySet()) }
    var userRejectedChallenges by remember { mutableStateOf<Set<String>>(emptySet()) }

    // Payment & Success Modal state (matching web)
    var matchResults by remember { mutableStateOf<List<Map<String, Any?>>>(emptyList()) }
    var isFinalSettlementPayment by remember { mutableStateOf(false) }
    var paymentItem by remember { mutableStateOf<ChallengeItem?>(null) }
    var showPaymentSummary by remember { mutableStateOf(false) }
    var showSuccessModal by remember { mutableStateOf(false) }
    var successModalTitle by remember { mutableStateOf("") }
    var successModalMessage by remember { mutableStateOf("") }
    var selectedSquadMatch by remember { mutableStateOf<ChallengeItem?>(null) }

    var showQR by remember { mutableStateOf(false) }
    var selectedQRBooking by remember { mutableStateOf<Booking?>(null) }
    var selectedQRLocation by remember { mutableStateOf<Location?>(null) }
    var selectedQRTickets by remember { mutableStateOf<List<com.boxitt.app.components.TicketItem>>(emptyList()) }

    fun formatDate(dateStr: String): String {
        return try {
            val parts = dateStr.split("-")
            if (parts.size == 3) "${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}" else dateStr
        } catch (e: Exception) { dateStr }
    }

    fun toDateStartTs(dateStr: String): Long {
        if (dateStr.isBlank()) return 0L
        return try {
            val parts = if (dateStr.contains("-")) {
                dateStr.split("-").mapNotNull { it.toIntOrNull() }
            } else if (dateStr.contains("/")) {
                dateStr.split("/").mapNotNull { it.toIntOrNull() }.reversed()
            } else emptyList()
            
            if (parts.size != 3) return 0L
            val cal = java.util.Calendar.getInstance()
            cal.set(parts[0], parts[1] - 1, parts[2], 0, 0, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)
            cal.timeInMillis
        } catch (e: Exception) { 0L }
    }

    fun getEndTime(dateStr: String, slotTime: String, startHour: Double?, endHour: Double?): Long {
        try {
            if (dateStr.isBlank()) return 0L
            val parts = if (dateStr.contains("-")) {
                dateStr.split("-").mapNotNull { it.toIntOrNull() }
            } else if (dateStr.contains("/")) {
                dateStr.split("/").mapNotNull { it.toIntOrNull() }.reversed()
            } else emptyList()
            
            if (parts.size != 3) return 0L

            val cal = java.util.Calendar.getInstance()
            cal.set(parts[0], parts[1] - 1, parts[2], 0, 0, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)

            if (startHour != null && endHour != null) {
                val startMins = (startHour * 60).toInt()
                var endMins = (endHour * 60).toInt()
                if (endMins <= startMins) endMins += 24 * 60
                cal.add(java.util.Calendar.MINUTE, endMins)
                return cal.timeInMillis
            }

            if (slotTime.isBlank() || slotTime == "TBA") return 0L

            // Fallback parsing from slotTime string (Parity with Web)
            val rangeParts = slotTime.split("-").map { it.trim() }.filter { it.isNotEmpty() }
            val lastPart = rangeParts.lastOrNull() ?: slotTime.trim()
            val regex = """(\d{1,2})(?::(\d{2}))?\s*(AM|PM)""".toRegex(RegexOption.IGNORE_CASE)
            val match = regex.find(lastPart) ?: return 0L
            
            var hours = match.groupValues[1].toInt()
            val minutes = if (match.groupValues[2].isNotBlank()) match.groupValues[2].toInt() else 0
            val modifier = match.groupValues[3].uppercase()

            if (modifier == "PM" && hours < 12) hours += 12
            if (modifier == "AM" && hours == 12) hours = 0

            cal.set(java.util.Calendar.HOUR_OF_DAY, hours)
            cal.set(java.util.Calendar.MINUTE, minutes)
            return cal.timeInMillis
        } catch (e: Exception) { return 0L }
    }

    fun getStartMinutes(item: ChallengeItem): Int {
        val sh = item.startHour
        if (sh != null && sh > 0) return (sh * 60).toInt()
        val slotStr = item.slotTime
        if (slotStr.isBlank() || slotStr == "TBA") return 0
        try {
            val firstPart = slotStr.split("-").firstOrNull()?.trim() ?: ""
            val regex = Regex("""(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?""", RegexOption.IGNORE_CASE)
            val match = regex.find(firstPart)
            if (match != null) {
                var h = match.groupValues[1].toInt()
                val m = if (match.groupValues[2].isNotEmpty()) match.groupValues[2].toInt() else 0
                val ampm = match.groupValues[3].uppercase()
                if (ampm == "PM" && h < 12) h += 12
                if (ampm == "AM" && h == 12) h = 0
                return h * 60 + m
            }
        } catch (e: Exception) { }
        return 0
    }

    fun getItemSortPriority(item: ChallengeItem, userId: String?): Int {
        if (item.isExpired) return 3

        val isOwn = (item.challengerId != null && item.challengerId == userId) || (item.userId != null && item.userId == userId)
        val isAcceptedByMe = item.acceptedBy != null && item.acceptedBy == userId
        val isParticipant = isOwn || isAcceptedByMe

        if (isParticipant) return 0 // User's own or accepted items on TOP!

        val status = item.status.lowercase()
        if (item.type == "challenge") {
            if ((status == "active" || status == "open") && item.acceptedBy == null) return 1
            return 2
        } else {
            val current = item.currentPlayers ?: 0
            val max = item.maxPlayers ?: 0
            if (current < max) return 1
            return 2
        }
    }

    fun fetchItems(isLoadMore: Boolean = false) {
        if (isLoadMore) loadingMore = true else loading = true
        errorMsg = null
        scope.launch {
            try {
                val offset = if (isLoadMore) currentOffset else 0
                val result = ChallengeService.fetchChallengesAndMatches(
                    userId = user?.id,
                    locationId = selectedLocation?.id,
                    sport = activeSport,
                    limit = 50,
                    offset = offset
                )
                
                val now = System.currentTimeMillis()
                
                // Expiry and removal logic (Parity with Web)
                val processedItems = result.items.filter { item ->
                    val endTime = getEndTime(item.date, item.slotTime, item.startHour, item.endHour)
                    val dateStartTs = toDateStartTs(item.date)
                    val autoDeleteTs = if (!item.autoDeleteAt.isNullOrEmpty()) Instant.parse(item.autoDeleteAt!!).toEpochMilliseconds() else 0L
                    val fallbackRemoveAtTs = if (dateStartTs > 0) (dateStartTs + (26 * 60 * 60 * 1000)) else 0L
                    
                    val removeAtTs = if (autoDeleteTs > 0) autoDeleteTs else (if (endTime > 0) endTime + 3600000 else fallbackRemoveAtTs)
                    
                    if (removeAtTs > 0) {
                        removeAtTs > now
                    } else true
                }.map { item ->
                    val endTime = getEndTime(item.date, item.slotTime, item.startHour, item.endHour)
                    item.copy(isExpired = endTime > 0 && endTime < now)
                }

                if (isLoadMore) {
                    items = (items + processedItems).distinctBy { it.id }
                    currentOffset += result.items.size
                } else {
                    items = processedItems
                    currentOffset = result.items.size
                }

                // Sorting happens locally to ensure user's items on top, then date & time order
                items = items.sortedWith { a, b ->
                    val pA = getItemSortPriority(a, user?.id)
                    val pB = getItemSortPriority(b, user?.id)
                    if (pA != pB) {
                        pA.compareTo(pB)
                    } else {
                        val dateA = toDateStartTs(a.date)
                        val dateB = toDateStartTs(b.date)
                        if (dateA != dateB) {
                            dateA.compareTo(dateB)
                        } else {
                            val startA = getStartMinutes(a)
                            val startB = getStartMinutes(b)
                            startA.compareTo(startB)
                        }
                    }
                }

                hasMore = result.items.size >= 50
                
                userSentRequests = if (isLoadMore) userSentRequests + result.userSentRequests else result.userSentRequests
                userAcceptedChallenges = if (isLoadMore) userAcceptedChallenges + result.userAcceptedChallenges else result.userAcceptedChallenges
                userSentMatchRequests = if (isLoadMore) userSentMatchRequests + result.userSentMatchRequests else result.userSentMatchRequests
                userAcceptedMatches = if (isLoadMore) userAcceptedMatches + result.userAcceptedMatches else result.userAcceptedMatches
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                errorMsg = e.message
                onAlert?.invoke(e.message ?: "Error", "error", null)
            } finally {
                loading = false
                loadingMore = false
            }
        }
    }

    LaunchedEffect(user?.id) {
        if (user?.id == null) return@LaunchedEffect
        
        // Real-time listener for challenges status changes (Parity with Web)
        val channel = Supabase.client.realtime.channel("challenges_updates")
        val challengeFlow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "challenges"
        }
        challengeFlow.onEach { action ->
            if (action is PostgresAction.Update) {
                val acceptedBy = action.record["accepted_by"]?.toString()?.replace("\"", "")
                val updatedId = action.record["id"]?.toString()?.replace("\"", "") ?: ""
                val status = action.record["status"]?.toString()?.replace("\"", "") ?: ""
                val acceptorPaymentStatus = action.record["acceptor_payment_status"]?.toString()?.replace("\"", "") ?: ""
                if (acceptedBy == user.id) {
                    userSentRequests = userSentRequests + updatedId
                    if (status == "confirmed" || status == "booked" || acceptorPaymentStatus.lowercase() == "paid") {
                        userAcceptedChallenges = userAcceptedChallenges + updatedId
                    }
                }
            }
            fetchItems()
        }.launchIn(this)

        // Real-time listener for notifications (All events: Insert, Update, Delete)
        val notifChannel = Supabase.client.realtime.channel("notifications_updates:${user.id}")
        val notifFlow = notifChannel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "notifications"
            filter = "user_id=eq.${user.id}"
        }
        notifFlow.onEach { action ->
            fetchItems()
        }.launchIn(this)

        // Real-time listener for bookings (Parity with Web)
        val bookingsChannel = Supabase.client.realtime.channel("bookings_updates")
        val bookingsFlow = bookingsChannel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "bookings"
        }
        bookingsFlow.onEach { fetchItems() }.launchIn(this)

        channel.subscribe()
        notifChannel.subscribe()
        bookingsChannel.subscribe()
    }

    // Refresh on screen/fragment ON_RESUME (ensures fresh data without app restart)
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                fetchItems()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(user?.id) {
        fetchItems()
    }

    fun handleViewTicket(item: ChallengeItem) {
        val currentUserId = user?.id ?: ""
        val isHost = item.challengerId == currentUserId || item.userId == currentUserId
        val isAcceptor = item.acceptedBy == currentUserId

        val holderName = if (isHost) {
            user?.displayName ?: user?.username ?: item.challengerDisplayName ?: item.challengerUsername ?: "Challenger Host"
        } else if (isAcceptor) {
            user?.displayName ?: user?.username ?: item.acceptorDisplayName ?: item.acceptorUsername ?: "Challengee Acceptor"
        } else {
            user?.displayName ?: user?.username ?: "Player"
        }

        val participantCheckedIn = if (isHost) {
            item.challengerCheckedIn == true
        } else if (isAcceptor) {
            item.acceptorCheckedIn == true
        } else {
            item.status.lowercase() == "confirmed"
        }

        if (item.type == "match") {
            val role = if (isHost) "MATCH HOST" else "MATCH PARTICIPANT"
            val qrData = "match:${item.id}:${if (isHost) "host" else "player"}:$currentUserId"
            val adaptedBooking = Booking(
                id = item.id,
                slotTime = item.slotTime,
                date = item.date,
                locationId = item.locationId ?: "",
                name = holderName,
                status = if (participantCheckedIn) BookingStatus.CONFIRMED else BookingStatus.BOOKED,
                checkedIn = participantCheckedIn
            )
            selectedQRBooking = adaptedBooking
            selectedQRLocation = item.box
            selectedQRTickets = listOf(
                com.boxitt.app.components.TicketItem(
                    id = item.id,
                    qrNo = "QR #1",
                    ticketNumber = 1,
                    groupSize = "1 Ticket",
                    slotTime = item.slotTime,
                    date = item.date,
                    holderName = holderName,
                    role = role,
                    qrData = qrData,
                    participantCheckedIn = participantCheckedIn,
                    status = if (participantCheckedIn) BookingStatus.CONFIRMED else BookingStatus.BOOKED
                )
            )
        } else {
            val role = if (isHost) "CHALLENGER (HOST)" else if (isAcceptor) "CHALLENGEE (ACCEPTOR)" else "MATCH PARTICIPANT"
            val qrData = "challenge:${item.id}:${if (isHost) "host" else "acceptor"}:$currentUserId"
            val adaptedBooking = Booking(
                id = item.id,
                slotTime = item.slotTime,
                date = item.date,
                locationId = item.locationId ?: "",
                name = holderName,
                status = if (participantCheckedIn) BookingStatus.CONFIRMED else BookingStatus.BOOKED,
                checkedIn = participantCheckedIn
            )
            selectedQRBooking = adaptedBooking
            selectedQRLocation = item.box
            selectedQRTickets = listOf(
                com.boxitt.app.components.TicketItem(
                    id = item.id,
                    qrNo = "QR #1",
                    ticketNumber = 1,
                    groupSize = "1 Ticket",
                    slotTime = item.slotTime,
                    date = item.date,
                    holderName = holderName,
                    role = role,
                    qrData = qrData,
                    participantCheckedIn = participantCheckedIn,
                    status = if (participantCheckedIn) BookingStatus.CONFIRMED else BookingStatus.BOOKED
                )
            )
        }
        showQR = true
    }

    fun handleAction(item: ChallengeItem, action: String, requesterId: String? = null) {
        if (user?.id == null) { onAlert?.invoke("Please log in first", "error", null); return }
        processingId = item.id
        scope.launch {
            try {
                when {
                    action == "cancel-request" -> {
                        ChallengeService.cancelJoinRequest(
                            itemId = item.id,
                            userId = user.id,
                            hostId = item.challengerId ?: item.userId ?: "",
                            user = user,
                            itemName = item.box?.name ?: "Arena",
                            itemDate = item.date,
                            slotTime = item.slotTime,
                            itemSport = item.sport
                        )
                        onAlert?.invoke("Request cancelled", "success", null)
                        if (item.type == "challenge") {
                            userSentRequests = userSentRequests - item.id
                        } else {
                            userSentMatchRequests = userSentMatchRequests - item.id
                        }
                    }
                    item.type == "match" && action == "join" -> {
                        ChallengeService.sendMatchJoinRequest(item, user)
                        onAlert?.invoke("Join request sent!", "success", null)
                        userSentMatchRequests = userSentMatchRequests + item.id
                    }
                    item.type == "match" && action == "accept-request" && requesterId != null -> {
                        ChallengeService.acceptMatchJoinRequest(item, requesterId, user)
                        onAlert?.invoke("Request accepted!", "success", null)
                        // Immediate UI update logic matches web but simplified via fetchItems
                    }
                    item.type == "challenge" && action == "request" -> {
                        if (item.status != "active") {
                            onAlert?.invoke("This challenge is no longer open for requests.", "info", null)
                            return@launch
                        }
                        ChallengeService.sendChallengeRequest(item, user)
                        onAlert?.invoke("Request sent to challenger.", "success", null)
                        userSentRequests = userSentRequests + item.id
                    }
                    item.type == "challenge" && action == "accept-request" && requesterId != null -> {
                        if (item.challengerId != user.id) throw Exception("Only the challenger can accept requests")
                        ChallengeService.acceptChallengeRequest(item, requesterId, user)
                        onAlert?.invoke("Request accepted and match confirmed!", "success", null)
                        hostAcceptedChallenges = hostAcceptedChallenges + item.id
                        expandedChallengeId = null
                    }
                    action == "reject-request" && requesterId != null -> {
                        ChallengeService.rejectChallengeRequest(item, requesterId, user)
                        onAlert?.invoke("Request declined", "info", null)
                    }
                }
                kotlinx.coroutines.delay(500)
                fetchItems()
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Error", "error", null)
            } finally {
                processingId = null
            }
        }
    }

    fun isSportMatch(itemSport: String?, targetSport: String?): Boolean {
        if (targetSport.isNullOrBlank()) return true
        if (itemSport.isNullOrBlank()) return false
        val s1 = itemSport.lowercase().replace(Regex("[-_ ]"), "")
        val s2 = targetSport.lowercase().replace(Regex("[-_ ]"), "")
        return s1.contains(s2) || s2.contains(s1)
    }

    fun getItemSearchScore(item: ChallengeItem, query: String): Int {
        val q = query.lowercase().trim()
        if (q.isBlank()) return 1

        val arenaName = (item.box?.name ?: item.name ?: "").lowercase()
        val arenaAddress = (item.box?.address ?: "").lowercase()
        val challengerName = (item.challengerUsername ?: "").lowercase()
        val challengerPhone = (item.challengerPhone ?: "").lowercase()
        val sportName = (item.sport ?: "").lowercase()
        val slotTime = item.slotTime.lowercase()
        val dateStr = item.date.lowercase()
        val matchType = item.type.lowercase()

        fun getScore(text: String, qStr: String): Int {
            if (text.isBlank()) return 0
            if (text == qStr) return 100
            if (text.startsWith(qStr)) return 80
            if (text.contains(qStr)) return 50
            val words = text.split(Regex("""[\s,/@._-]+"""))
            if (words.any { it.startsWith(qStr) }) return 40
            return 0
        }

        val maxSingle = maxOf(
            getScore(arenaName, q),
            getScore(arenaAddress, q),
            getScore(challengerName, q),
            getScore(challengerPhone, q),
            getScore(sportName, q),
            getScore(slotTime, q),
            getScore(dateStr, q),
            getScore(matchType, q)
        )

        if (maxSingle > 0) return maxSingle

        val qWords = q.split(Regex("""\s+""")).filter { it.isNotBlank() }
        if (qWords.size > 1) {
            val combinedText = "$arenaName $arenaAddress $challengerName $challengerPhone $sportName $slotTime $dateStr $matchType"
            if (qWords.all { combinedText.contains(it) }) return 30
        }

        return 0
    }

    val filteredItems = items.filter { item ->
        // 1. Filter by sport if specified
        if (!isSportMatch(item.sport, activeSport)) {
            return@filter false
        }

        val matchesTab = when (activeTab) {
            MatchTab.ALL -> true
            MatchTab.CHALLENGES -> item.type == "challenge"
            MatchTab.MATCHES -> item.type == "match"
            MatchTab.YOURS -> item.challengerId == user?.id || item.userId == user?.id
        }
        if (!matchesTab) return@filter false

        // 2. Filter by search query (arena name, address/location, player name, time, etc.)
        if (searchQuery.isNotBlank()) {
            val score = getItemSearchScore(item, searchQuery)
            if (score <= 0) return@filter false
        }

        true
    }

    val sortedItems = remember(filteredItems, userProfile, user?.id, searchQuery) {
        filteredItems.sortedWith { a, b ->
            if (searchQuery.isNotBlank()) {
                val scoreA = getItemSearchScore(a, searchQuery)
                val scoreB = getItemSearchScore(b, searchQuery)
                if (scoreA != scoreB) return@sortedWith scoreB.compareTo(scoreA)
            }
            val pA = getItemSortPriority(a, user?.id)
            val pB = getItemSortPriority(b, user?.id)
            if (pA != pB) {
                pA.compareTo(pB)
            } else {
                val dateA = toDateStartTs(a.date)
                val dateB = toDateStartTs(b.date)
                if (dateA != dateB) {
                    dateA.compareTo(dateB)
                } else {
                    val startA = getStartMinutes(a)
                    val startB = getStartMinutes(b)
                    if (startA != startB) {
                        startA.compareTo(startB)
                    } else if (userProfile?.latitude != null && userProfile.longitude != null) {
                        val distA = if (a.box?.latitude != null && a.box.longitude != null) {
                            DistanceUtils.calculateDistance(userProfile.latitude, userProfile.longitude, a.box.latitude, a.box.longitude)
                        } else Double.MAX_VALUE

                        val distB = if (b.box?.latitude != null && b.box.longitude != null) {
                            DistanceUtils.calculateDistance(userProfile.latitude, userProfile.longitude, b.box.latitude, b.box.longitude)
                        } else Double.MAX_VALUE

                        distA.compareTo(distB)
                    } else {
                        0
                    }
                }
            }
        }
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        val isExpanded = maxWidth > 840.dp
        val columns = if (isExpanded) 2 else 1
        
        LazyVerticalGrid(
            columns = GridCells.Fixed(columns),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = if (isExpanded) 40.dp else 16.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            item(span = { GridItemSpan(columns) }) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(theme.colors.card)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(14.dp))
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = theme.colors.textPrimary)
                    }
                    Column {
                        Text("MATCHMAKING", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                        Text("NEARBY WARRIORS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
                    }
                }
            }

            // Tab bar
            item(span = { GridItemSpan(columns) }) {
                Row(
                    modifier = Modifier
                        .then(if (isExpanded) Modifier.width(400.dp) else Modifier.fillMaxWidth())
                        .clip(RoundedCornerShape(16.dp))
                        .background(theme.colors.card)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    MatchTab.values().forEach { tab ->
                        val isSelected = activeTab == tab
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) theme.colors.accent else Color.Transparent)
                                .clickable { activeTab = tab }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(tab.name, fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (isSelected) Color.White else theme.colors.textSecondary, letterSpacing = 1.sp)
                        }
                    }
                }
            }

            // Search bar
            item(span = { GridItemSpan(columns) }) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = {
                        Text(
                            "Search arena, location, player name, time...",
                            color = theme.colors.textDisabled,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = "Search", tint = theme.colors.textDisabled)
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", tint = theme.colors.textDisabled)
                            }
                        }
                    },
                    modifier = Modifier
                        .then(if (isExpanded) Modifier.width(600.dp) else Modifier.fillMaxWidth()),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = theme.colors.accent,
                        unfocusedBorderColor = theme.colors.border,
                        focusedContainerColor = theme.colors.card,
                        unfocusedContainerColor = theme.colors.card,
                        focusedTextColor = theme.colors.textPrimary,
                        unfocusedTextColor = theme.colors.textPrimary,
                        cursorColor = theme.colors.accent
                    ),
                    singleLine = true
                )
            }

            // Error
            if (errorMsg != null) {
                item(span = { GridItemSpan(columns) }) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(theme.colors.error.copy(0.1f))
                            .border(1.dp, theme.colors.error.copy(0.2f), RoundedCornerShape(12.dp))
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = theme.colors.error, modifier = Modifier.size(20.dp))
                        Text(errorMsg!!, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = theme.colors.error)
                    }
                }
            }

            // Loading / empty
            if (loading) {
                item(span = { GridItemSpan(columns) }) {
                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = theme.colors.accent)
                            Spacer(Modifier.height(12.dp))
                            Text("SYNCING ARENA DATA...", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                        }
                    }
                }
            } else if (filteredItems.isEmpty()) {
                item(span = { GridItemSpan(columns) }) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp)
                            .clip(RoundedCornerShape(32.dp))
                            .background(theme.colors.card.copy(0.5f))
                            .border(1.dp, theme.colors.border, RoundedCornerShape(32.dp))
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                modifier = Modifier
                                    .size(72.dp)
                                    .clip(RoundedCornerShape(50.dp))
                                    .background(theme.colors.accent.copy(0.05f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.People, contentDescription = null, tint = theme.colors.textDisabled.copy(0.3f), modifier = Modifier.size(40.dp))
                            }
                            Spacer(Modifier.height(16.dp))
                            Text("EMPTY ARENA", fontSize = 16.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            Text("No items found in this category.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled, modifier = Modifier.padding(top = 4.dp))
                            Spacer(Modifier.height(16.dp))
                            Button(
                                onClick = onBack,
                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text("RETURN TO BASE", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                            }
                        }
                    }
                }
            } else {
                items(sortedItems) { item ->
                    // Detect if we should load more
                    val index = sortedItems.indexOf(item)
                    if (index >= sortedItems.size - 5 && hasMore && !loadingMore && !loading) {
                        fetchItems(isLoadMore = true)
                    }
                    val isOwner = item.challengerId == user?.id || item.userId == user?.id
                    val isChallenge = item.type == "challenge"
                    val isMatch = item.type == "match"
                    val isChallengeConfirmed = isChallenge && (item.status == "confirmed" || item.status == "booked" || (item.status == "pending_payment" && item.acceptorPaymentStatus?.lowercase() == "paid") || userAcceptedChallenges.contains(item.id) || hostAcceptedChallenges.contains(item.id))
                    val challengeAcceptedByUser = isChallenge && (item.acceptedBy == user?.id || userAcceptedChallenges.contains(item.id))
                    val challengeClosedElsewhere = isChallenge && item.status == "confirmed" && !item.acceptedBy.isNullOrEmpty() && userSentRequests.contains(item.id) && item.acceptedBy != user?.id
                    val challengeUnavailable = isChallenge && item.status != "active" && !userSentRequests.contains(item.id)
                    val requestSent = (isChallenge && userSentRequests.contains(item.id)) || (isMatch && userSentMatchRequests.contains(item.id))
                    val matchAccepted = isMatch && userAcceptedMatches.contains(item.id)

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(28.dp))
                            .background(theme.colors.card)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(28.dp))
                    ) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            // Status tag (top right chip)
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                val tagText = when {
                                    item.isExpired -> "SESSION EXPIRED"
                                    isChallenge && item.status == "active" -> "OPEN CHALLENGE"
                                    isChallenge -> "CHALLENGE CLOSED"
                                    else -> "JOINABLE MATCH"
                                }
                                val tagColor = when {
                                    item.isExpired -> theme.colors.textDisabled
                                    isChallenge && item.status == "active" -> theme.colors.error
                                    isChallenge -> theme.colors.textDisabled
                                    else -> theme.colors.success
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(theme.colors.backgroundSecondary)
                                        .border(1.dp, theme.colors.border, RoundedCornerShape(10.dp))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(tagText, fontSize = 8.sp, fontWeight = FontWeight.Black, color = tagColor, letterSpacing = 1.sp)
                                }
                            }

                            Spacer(Modifier.height(8.dp))

                            // Host info
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(52.dp)
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(theme.colors.backgroundSecondary)
                                        .border(1.dp, theme.colors.border, RoundedCornerShape(14.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    val avatarUrl = item.challengerAvatarUrl
                                    if (!avatarUrl.isNullOrEmpty()) {
                                        androidx.compose.foundation.Image(
                                            painter = rememberAsyncImagePainter(avatarUrl),
                                            contentDescription = "Host",
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = androidx.compose.ui.layout.ContentScale.Crop
                                        )
                                    } else {
                                        Icon(Icons.Default.Group, contentDescription = null, tint = theme.colors.textDisabled.copy(0.4f), modifier = Modifier.size(28.dp))
                                    }
                                }
                                Column {
                                    Text(
                                        item.challengerUsername ?: item.name ?: "Private Player", 
                                        fontSize = 15.sp, 
                                        fontWeight = FontWeight.Black, 
                                        color = theme.colors.textPrimary,
                                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                                        letterSpacing = (-0.5).sp
                                    )
                                    Text(item.challengerPhone ?: "CONTACT HIDDEN", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.colors.accent)
                                }
                            }

                            Spacer(Modifier.height(12.dp))

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(theme.colors.backgroundSecondary.copy(0.3f))
                                    .border(1.dp, Color.White.copy(0.05f), RoundedCornerShape(12.dp))
                                    .clickable {
                                        val arenaName = item.box?.name ?: item.name
                                        val itemSport = if (!sport.isNullOrBlank()) sport else (item.sport ?: "CRICKET")
                                        if (arenaName != null && navController != null) {
                                            navController.navigate(Screen.LocationSelector.createRoute(itemSport, arenaName))
                                        }
                                    }
                                    .padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.Place, contentDescription = null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text("ARENA LOCATION", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                        Text(item.box?.name ?: "Main Arena", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                        if (!item.box?.address.isNullOrBlank()) {
                                            Text(item.box!!.address, fontSize = 9.sp, fontWeight = FontWeight.Medium, color = theme.colors.textSecondary)
                                        }
                                    }
                                    
                                    if (userProfile?.latitude != null && userProfile.longitude != null && item.box?.latitude != null && item.box.longitude != null) {
                                        val dist = DistanceUtils.calculateDistance(userProfile.latitude, userProfile.longitude, item.box.latitude, item.box.longitude)
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(10.dp))
                                                .background(theme.colors.accent.copy(alpha = 0.1f))
                                                .border(1.dp, theme.colors.accent.copy(alpha = 0.2f), RoundedCornerShape(10.dp))
                                                .padding(horizontal = 10.dp, vertical = 4.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                Icon(
                                                    imageVector = Icons.AutoMirrored.Filled.Send, // Using Send as a Navigation-like icon
                                                    contentDescription = null,
                                                    tint = theme.colors.accent,
                                                    modifier = Modifier.size(10.dp)
                                                )
                                                Text(
                                                    DistanceUtils.formatDistance(dist),
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = theme.colors.accent,
                                                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            Spacer(Modifier.height(6.dp))

                            // Time row
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(theme.colors.backgroundSecondary.copy(0.3f))
                                    .border(1.dp, Color.White.copy(0.05f), RoundedCornerShape(12.dp))
                                    .padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.AccessTime, contentDescription = null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                                Column {
                                    Text("SCHEDULED TIME", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    val slotDisplay = if (!item.slotTime.isNullOrBlank() && item.slotTime != "TBA") "${item.slotTime} • " else ""
                                    Text("$slotDisplay${formatDate(item.date)}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                }
                            }

                            // Squad availability (match only)
                            if (isMatch || isChallenge) {
                                Spacer(Modifier.height(10.dp))
                                Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text(if (isChallenge) "MATCH FORMAT" else "SQUAD AVAILABILITY", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Text(
                                            if (isChallenge) "${(item.maxPlayers ?: 10) / 2}v${(item.maxPlayers ?: 10) / 2}"
                                            else "${item.currentPlayers ?: 0} / ${item.maxPlayers ?: 0}", 
                                            fontSize = 13.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary
                                        )
                                        if (isMatch) {
                                            Box(
                                                modifier = Modifier
                                                    .width(80.dp)
                                                    .height(6.dp)
                                                    .clip(RoundedCornerShape(3.dp))
                                                    .background(theme.colors.backgroundSecondary)
                                            ) {
                                                val progress = ((item.currentPlayers ?: 0).toFloat() / (item.maxPlayers ?: 1).coerceAtLeast(1))
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxHeight()
                                                        .fillMaxWidth(progress)
                                                        .background(theme.colors.accent)
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            Spacer(Modifier.height(16.dp))

                            // ── ACTION BUTTONS ──
                            when {
                                isMatch -> {
                                    val currentCount = item.currentPlayers ?: 0
                                    val maxCount = item.maxPlayers ?: 10
                                    val freeSpots = (maxCount - currentCount).coerceAtLeast(0)
                                    val isJoined = isOwner || matchAccepted || userAcceptedMatches.contains(item.id) || item.userAcceptedMembers > 0

                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        if (isJoined) {
                                            Button(
                                                onClick = { handleViewTicket(item) },
                                                modifier = Modifier.fillMaxWidth().height(52.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                                                shape = RoundedCornerShape(16.dp)
                                            ) {
                                                Icon(Icons.Default.QrCode, null, modifier = Modifier.size(20.dp))
                                                Spacer(Modifier.width(8.dp))
                                                Text("VIEW TICKET", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                            }
                                            if (freeSpots > 0) {
                                                OutlinedButton(
                                                    onClick = { selectedSquadMatch = item },
                                                    modifier = Modifier.fillMaxWidth().height(48.dp),
                                                    shape = RoundedCornerShape(14.dp),
                                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = theme.colors.textPrimary)
                                                ) {
                                                    Icon(Icons.Default.GroupAdd, null, modifier = Modifier.size(18.dp))
                                                    Spacer(Modifier.width(8.dp))
                                                    Text("ADD MORE PLAYERS", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                                }
                                            }
                                        } else if (freeSpots <= 0) {
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clip(RoundedCornerShape(16.dp))
                                                    .background(Color.White.copy(0.05f))
                                                    .border(1.dp, Color.White.copy(0.1f), RoundedCornerShape(16.dp))
                                                    .padding(16.dp),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text("MATCH FULL ($currentCount / $maxCount)", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                            }
                                        } else {
                                            Button(
                                                onClick = { selectedSquadMatch = item },
                                                enabled = processingId == null && !item.isExpired,
                                                modifier = Modifier.fillMaxWidth().height(52.dp),
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = if (item.isExpired) theme.colors.backgroundSecondary else theme.colors.accent,
                                                    contentColor = if (item.isExpired) theme.colors.textDisabled else Color.White
                                                ),
                                                shape = RoundedCornerShape(16.dp)
                                            ) {
                                                Icon(Icons.Default.GroupAdd, null, modifier = Modifier.size(20.dp))
                                                Spacer(Modifier.width(8.dp))
                                                Text(if (item.isExpired) "SESSION EXPIRED" else "JOIN MATCH", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                            }
                                        }
                                    }
                                }

                                // 1. OWNER: confirmed challenge
                                isOwner && (isChallengeConfirmed || (isChallenge && item.status == "pending_payment" && !item.acceptedBy.isNullOrEmpty())) -> {
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(16.dp))
                                                .background(if (item.status == "pending_payment" && item.acceptorPaymentStatus?.lowercase() != "paid") theme.colors.accent.copy(0.1f) else theme.colors.success.copy(0.1f))
                                                .border(1.dp, if (item.status == "pending_payment" && item.acceptorPaymentStatus?.lowercase() != "paid") theme.colors.accent.copy(0.2f) else theme.colors.success.copy(0.2f), RoundedCornerShape(16.dp))
                                                .padding(16.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                if (item.status == "pending_payment" && item.acceptorPaymentStatus?.lowercase() != "paid") {
                                                    val reqUser = item.requests.firstOrNull { it.requesterId == item.acceptedBy }?.requesterUsername
                                                    val acceptorName = if (!reqUser.isNullOrEmpty()) "@$reqUser" else "ACCEPTOR"
                                                    "REQUEST APPROVED - WAITING FOR $acceptorName PAYMENT"
                                                } else if (item.status == "booked") {
                                                    "REQUEST ACCEPTED - MATCH BOOKED"
                                                } else {
                                                    "REQUEST ACCEPTED - MATCH CONFIRMED"
                                                },
                                                fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (item.status == "pending_payment" && item.acceptorPaymentStatus?.lowercase() != "paid") theme.colors.accent else theme.colors.success, letterSpacing = 1.sp
                                            )
                                        }
                                        if (item.status == "confirmed" || item.status == "booked" || item.acceptorPaymentStatus?.lowercase() == "paid") {
                                            Button(
                                                onClick = { handleViewTicket(item) },
                                                modifier = Modifier.fillMaxWidth().height(52.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                                                shape = RoundedCornerShape(16.dp)
                                            ) {
                                                Icon(Icons.Default.QrCode, null, modifier = Modifier.size(20.dp))
                                                Spacer(Modifier.width(8.dp))
                                                Text("VIEW TICKET", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                            }
                                        }
                                    }
                                }

                                // 2. OWNER: show requests
                                isOwner -> {
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(
                                            onClick = { expandedChallengeId = if (expandedChallengeId == item.id) null else item.id },
                                            modifier = Modifier.fillMaxWidth().height(52.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                                            shape = RoundedCornerShape(16.dp)
                                        ) {
                                            Icon(Icons.Default.CheckCircle, null, modifier = Modifier.size(20.dp))
                                            Spacer(Modifier.width(8.dp))
                                            Text(
                                                "ACCEPT REQUEST (${item.requests.size})",
                                                fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp
                                            )
                                        }
                                        AnimatedVisibility(visible = expandedChallengeId == item.id) {
                                            Column(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clip(RoundedCornerShape(14.dp))
                                                    .background(theme.colors.backgroundSecondary)
                                                    .border(1.dp, theme.colors.border, RoundedCornerShape(14.dp))
                                                    .padding(10.dp),
                                                verticalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                if (item.requests.isEmpty()) {
                                                    Text("NO REQUESTS YET", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp, modifier = Modifier.align(Alignment.CenterHorizontally).padding(8.dp))
                                                } else {
                                                    item.requests.forEach { req ->
                                                        Row(
                                                            modifier = Modifier
                                                                .fillMaxWidth()
                                                                .clip(RoundedCornerShape(10.dp))
                                                                .background(theme.colors.card)
                                                                .border(1.dp, theme.colors.border, RoundedCornerShape(10.dp))
                                                                .padding(10.dp),
                                                            horizontalArrangement = Arrangement.SpaceBetween,
                                                            verticalAlignment = Alignment.CenterVertically
                                                        ) {
                                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                                                Box(
                                                                    modifier = Modifier
                                                                        .size(36.dp)
                                                                        .clip(RoundedCornerShape(10.dp))
                                                                        .background(theme.colors.backgroundSecondary),
                                                                    contentAlignment = Alignment.Center
                                                                ) {
                                                                    if (!req.requesterAvatarUrl.isNullOrEmpty()) {
                                                                        androidx.compose.foundation.Image(
                                                                            painter = rememberAsyncImagePainter(req.requesterAvatarUrl),
                                                                            contentDescription = null,
                                                                            modifier = Modifier.fillMaxSize()
                                                                        )
                                                                    } else {
                                                                        Icon(Icons.Default.Person, null, tint = theme.colors.textDisabled.copy(0.4f), modifier = Modifier.size(18.dp))
                                                                    }
                                                                }
                                                                Column {
                                                                    val reqName = req.requesterDisplayName ?: req.requesterUsername ?: req.playerName ?: "User"
                                                                    val reqHandle = "@" + (req.requesterUsername ?: reqName).lowercase().replace(" ", "_")
                                                                    Text(reqName, fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                                    val groupLabel = if ((req.groupSize ?: 1) > 1) " (+${req.groupSize} players)" else ""
                                                                    Text("$reqHandle$groupLabel", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.colors.textSecondary)
                                                                }
                                                            }
                                                            Button(
                                                                onClick = { handleAction(item, "accept-request", req.requesterId) },
                                                                enabled = processingId == null,
                                                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.success),
                                                                shape = RoundedCornerShape(8.dp),
                                                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                                            ) {
                                                                Text(if (processingId == item.id) "..." else "ACCEPT", fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                // 3. Challenge accepted by user (non-owner)
                                challengeAcceptedByUser -> {
                                    val isPendingAdvance = item.status == "pending_payment" && item.acceptorPaymentStatus?.lowercase() != "paid"
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        if (isPendingAdvance) {
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clip(RoundedCornerShape(16.dp))
                                                    .background(theme.colors.accent.copy(0.1f))
                                                    .border(1.dp, theme.colors.accent.copy(0.2f), RoundedCornerShape(16.dp))
                                                    .padding(16.dp),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text("PAYMENT REQUIRED TO CONFIRM MATCH", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 1.sp)
                                                    Text("Pay the advance to get your ticket", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = theme.colors.accent.copy(0.7f), modifier = Modifier.padding(top = 4.dp))
                                                }
                                            }
                                            Button(
                                                onClick = { handleAction(item, "pay-advance") },
                                                enabled = processingId == null,
                                                modifier = Modifier.fillMaxWidth().height(52.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.success),
                                                shape = RoundedCornerShape(16.dp)
                                            ) {
                                                Icon(Icons.Default.CreditCard, null, modifier = Modifier.size(20.dp))
                                                Spacer(Modifier.width(8.dp))
                                                Text("PAY ADVANCE", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                            }
                                        } else {
                                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.success.copy(0.1f)).border(1.dp, theme.colors.success.copy(0.2f), RoundedCornerShape(16.dp)).padding(16.dp), contentAlignment = Alignment.Center) {
                                                Text(if (item.status == "booked") "REQUEST ACCEPTED - MATCH BOOKED" else "REQUEST ACCEPTED - MATCH CONFIRMED", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.success, letterSpacing = 1.sp)
                                            }
                                            Button(onClick = { handleViewTicket(item) }, modifier = Modifier.fillMaxWidth().height(52.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent), shape = RoundedCornerShape(16.dp)) {
                                                Icon(Icons.Default.QrCode, null, modifier = Modifier.size(20.dp))
                                                Spacer(Modifier.width(8.dp))
                                                Text("VIEW TICKET", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                            }
                                        }
                                    }
                                }

                                // 4. Challenge closed for user
                                challengeClosedElsewhere -> {
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White.copy(0.05f)).border(1.dp, Color.White.copy(0.1f), RoundedCornerShape(16.dp)).padding(16.dp), contentAlignment = Alignment.Center) {
                                        Text("CHALLENGE WAS ACCEPTED FOR OTHER PERSON", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textSecondary, letterSpacing = 1.sp)
                                    }
                                }

                                // 5. Challenge unavailable
                                challengeUnavailable -> {
                                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White.copy(0.05f)).border(1.dp, Color.White.copy(0.1f), RoundedCornerShape(16.dp)).padding(16.dp), contentAlignment = Alignment.Center) {
                                        Text("NOT AVAILABLE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled.copy(0.5f), letterSpacing = 1.sp)
                                    }
                                }

                                // 6. Request sent — waiting
                                requestSent -> {
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.accent.copy(0.1f)).border(1.dp, theme.colors.accent.copy(0.2f), RoundedCornerShape(16.dp)).padding(16.dp), contentAlignment = Alignment.Center) {
                                            Text("REQUEST SENT - WAITING FOR HOST", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 1.sp)
                                        }
                                        TextButton(onClick = { handleAction(item, "cancel-request") }) {
                                            Text("CANCEL REQUEST", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.error, letterSpacing = 1.sp)
                                        }
                                    }
                                }

                                // 7. Default: send request / join
                                else -> {
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(
                                            onClick = { handleAction(item, "request") },
                                            enabled = processingId == null && !item.isExpired,
                                            modifier = Modifier.fillMaxWidth().height(52.dp),
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = if (item.isExpired) theme.colors.backgroundSecondary else theme.colors.accent,
                                                contentColor = if (item.isExpired) theme.colors.textDisabled else Color.White
                                            ),
                                            shape = RoundedCornerShape(16.dp)
                                        ) {
                                            if (processingId == item.id) {
                                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                                            } else {
                                                if (!item.isExpired) {
                                                    Icon(Icons.Default.SportsTennis, null, modifier = Modifier.size(20.dp))
                                                    Spacer(Modifier.width(8.dp))
                                                }
                                                Text(if (item.isExpired) "SESSION EXPIRED" else "SEND REQUEST", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                            }
                                        }
                                    }
                                }
                                                    else -> "SEND JOIN REQUEST"
                                                }
                                                Text(btnText, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(20.dp)) }

            if (loadingMore) {
                item(span = { GridItemSpan(columns) }) {
                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = theme.colors.accent, modifier = Modifier.size(24.dp))
                    }
                }
            }

            item { Spacer(Modifier.height(80.dp)) }
        }

        // QR Modal
        if (showQR && selectedQRBooking != null && selectedQRLocation != null) {
            Dialog(onDismissRequest = { showQR = false }) {
                QRCodeModal(booking = selectedQRBooking!!, location = selectedQRLocation!!, tickets = selectedQRTickets, onClose = { showQR = false }, onAlert = onAlert)
            }
        }

        // Squad Join Dialog
        if (selectedSquadMatch != null) {
            val match = selectedSquadMatch!!
            SquadJoinDialog(
                match = match,
                theme = theme,
                onDismiss = { selectedSquadMatch = null },
                onConfirm = { addingCount, contributionAmount ->
                    processingId = match.id
                    scope.launch {
                        try {
                            ChallengeService.sendMatchJoinRequest(match, user, addingCount)
                            userAcceptedMatches = userAcceptedMatches + match.id
                            onAlert?.invoke("Successfully joined squad for $addingCount spot(s)!", "success", null)
                            selectedSquadMatch = null
                            fetchItems()
                        } catch (e: Exception) {
                            onAlert?.invoke(e.message ?: "Failed to join squad", "error", null)
                        } finally {
                            processingId = null
                        }
                    }
                },
                isProcessing = processingId == selectedSquadMatch?.id
            )
        }
    }
}

@Composable
fun SquadJoinDialog(
    match: ChallengeItem,
    theme: Theme,
    onDismiss: () -> Unit,
    onConfirm: (addingCount: Int, contributionAmount: Double) => Unit,
    isProcessing: Boolean = false
) {
    val currentCount = match.currentPlayers ?: 0
    val maxCount = match.maxPlayers ?: 10
    val freeSpots = (maxCount - currentCount).coerceAtLeast(0)
    val maxSelectable = freeSpots.coerceAtMost(10)
    var addingPlayers by remember { mutableStateOf(1) }

    val matchTotal = match.amount ?: 1000.0
    val perPlayerShare = Math.round(matchTotal / maxCount).toDouble()
    val yourContribution = addingPlayers * perPlayerShare

    Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(28.dp))
                .background(theme.colors.card)
                .border(1.dp, theme.colors.border, RoundedCornerShape(28.dp))
                .padding(24.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(theme.colors.accent),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Group, contentDescription = null, tint = Color.White, modifier = Modifier.size(32.dp))
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "SQUAD JOIN",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        color = theme.colors.textPrimary,
                        letterSpacing = (-0.5).sp
                    )
                    Text(
                        match.slotTime.ifEmpty { "TBA" },
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.accent,
                        letterSpacing = 1.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(theme.colors.backgroundSecondary)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(18.dp))
                        .padding(16.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("ADDING PLAYERS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                            Text("$addingPlayers", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                        }

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            (1..maxSelectable).forEach { num ->
                                val isSelected = addingPlayers == num
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (isSelected) theme.colors.accent else Color.Transparent)
                                        .border(1.5.dp, if (isSelected) theme.colors.accent else theme.colors.border, RoundedCornerShape(12.dp))
                                        .clickable(enabled = !isProcessing) { addingPlayers = num },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        "$num",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Black,
                                        color = if (isSelected) Color.White else theme.colors.textSecondary
                                    )
                                }
                            }
                        }
                    }
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(theme.colors.backgroundSecondary)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(18.dp))
                        .padding(16.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("MATCH TOTAL", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                            Text("₹${matchTotal.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("YOUR CONTRIBUTION", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textSecondary, letterSpacing = 1.sp)
                            Text("₹${yourContribution.toInt()}", fontSize = 22.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                        }
                    }
                }

                Button(
                    onClick = { onConfirm(addingPlayers, yourContribution) },
                    enabled = !isProcessing,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                    } else {
                        Text("CONFIRM & JOIN SQUAD", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                    }
                }
            }
        }
    }
}
