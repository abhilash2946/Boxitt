package com.boxitt.app.pages

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
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
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.text.style.TextOverflow
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import com.boxitt.app.services.Storage
import java.util.Date
import com.boxitt.app.AppNotification
import com.boxitt.app.Booking
import com.boxitt.app.Location
import com.boxitt.app.components.QRCodeModal
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.theme.vw
import com.boxitt.app.theme.clamp
import com.boxitt.app.contexts.PermissionType
import com.boxitt.app.contexts.PermissionsManager
import com.boxitt.app.services.BookingService
import com.boxitt.app.services.NotificationService
import com.boxitt.app.services.Supabase
import com.boxitt.app.services.handleError
import com.boxitt.app.navigation.Screen
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun NotificationsPage(
    userId: String?,
    selectedSport: String? = null,
    onBack: () -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onConfirm: ((String, () -> Unit, (() -> Unit)?, String?, String?, Boolean?) -> Unit)? = null,
    onNavigate: ((String) -> Unit)? = null,
    viewModel: com.boxitt.app.hooks.NotificationsViewModel = androidx.hilt.navigation.compose.hiltViewModel()
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val notifications = viewModel.notificationsList
    val activeSport = selectedSport ?: Storage.getNavState()?.selectedSport?.name
    val filteredNotifications = notifications.filter { com.boxitt.app.components.isNotificationForSport(it, activeSport) }
    var showQR by remember { mutableStateOf(false) }
    var selectedBooking by remember { mutableStateOf<Booking?>(null) }
    var selectedLocation by remember { mutableStateOf<Location?>(null) }
    var loadingQR by remember { mutableStateOf(false) }

    // Check permissions and start sync (shared with bell)
    LaunchedEffect(userId) {
        if (userId != null) {
            viewModel.startSync(userId)
            viewModel.markAllAsRead()
        }
        // Automatically check for notification permissions when entering this page
        PermissionsManager.checkAndPrompt(context, PermissionType.NOTIFICATIONS, false)
    }

    fun handleDelete(id: String) {
        viewModel.deleteNotification(id)
        onAlert?.invoke("Deleted", "success", null)
    }

    fun runClearAll() {
        viewModel.clearAllNotifications(userId)
        onAlert?.invoke("Cleared", "success", null)
    }

    fun handleClearAll() {
        if (onConfirm != null) {
            onConfirm("Clear all?", { runClearAll() }, null, "Clear", "Cancel", true)
        } else {
            runClearAll()
        }
    }

    fun handleViewTicket(notif: com.boxitt.app.services.LocalNotification) {
        loadingQR = true
        scope.launch {
            try {
                val dataJson = notif.data?.let { com.boxitt.app.services.Storage.json.parseToJsonElement(it).jsonObject }
                val bookingId = dataJson?.get("booking_id")?.jsonPrimitive?.contentOrNull ?: dataJson?.get("challenge_id")?.jsonPrimitive?.contentOrNull
                val type = if (dataJson?.containsKey("booking_id") == true) "match" else "challenge"

                if (type == "match" && bookingId != null) {
                    val booking = BookingService.getBookingById(bookingId)
                    if (booking != null) {
                        val loc = Supabase.client.postgrest["locations"]
                            .select {
                                filter {
                                    eq("id", booking.locationId)
                                }
                                single()
                            }
                            .decodeAs<Location>()
                        selectedBooking = booking
                        selectedLocation = loc
                        showQR = true
                    }
                } else if (bookingId != null) {
                    val challenge = BookingService.getChallengeById(bookingId)
                    if (challenge != null) {
                        selectedBooking = Booking(
                            id = challenge.id,
                            slotTime = challenge.slotTime,
                            date = challenge.date,
                            locationId = challenge.locationId ?: "",
                            name = challenge.challenger?.display_name ?: challenge.challenger?.username ?: "User"
                        )
                        selectedLocation = challenge.location
                        showQR = true
                    }
                }
            } catch (e: Exception) {
                onAlert?.invoke(e.message ?: "Error", "error", null)
            } finally {
                loadingQR = false
            }
        }
    }

    fun handleNotifClick(notif: com.boxitt.app.services.LocalNotification) {
        val dataJson = notif.data?.let { com.boxitt.app.services.Storage.json.parseToJsonElement(it).jsonObject }
        val type = dataJson?.get("type")?.jsonPrimitive?.contentOrNull
        val sport = dataJson?.get("sport")?.jsonPrimitive?.contentOrNull
        
        when (type) {
            "challenge", "challenge_request", "challenge_accepted", "challenge_created",
            "joinable_match", "joinable_created", "match_join_request", "match_join_request_sent",
            "challenge_request_sent", "request_cancelled", "request_cancelled_self" -> {
                val route = if (!sport.isNullOrBlank()) {
                    Screen.Challenges.createRoute(sport)
                } else {
                    "challenges"
                }
                onNavigate?.invoke(route)
            }
            "challenge_confirmed", "match_join_confirmed",
            "challenge_confirmed_host", "match_join_confirmed_host" ->
                handleViewTicket(notif)
        }
    }

    val timeFormat = remember { SimpleDateFormat("hh:mm a", Locale.getDefault()) }
    val dateFormat = remember { SimpleDateFormat("MMM d, yyyy", Locale.getDefault()) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        // Background Blobs
        Box(
            modifier = Modifier
                .offset(x = (-100).dp, y = (-100).dp)
                .size(300.dp)
                .blur(100.dp)
                .background(theme.colors.accent.copy(alpha = 0.2f), CircleShape)
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = 100.dp, y = 100.dp)
                .size(300.dp)
                .blur(100.dp)
                .background(theme.colors.success.copy(alpha = 0.2f), CircleShape)
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(theme.colors.card)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))
                        .padding(20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        IconButton(
                            onClick = onBack,
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(theme.colors.backgroundSecondary)
                                .border(1.dp, theme.colors.border, RoundedCornerShape(10.dp))
                        ) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = "Back", tint = theme.colors.textPrimary)
                        }
                        Column {
                            Text(
                                "NOTIFICATIONS",
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textPrimary,
                                fontStyle = FontStyle.Italic,
                                letterSpacing = (-1).sp
                            )
                            Text(
                                "ACTIVITY",
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 3.2.sp
                            )
                        }
                    }
                    if (filteredNotifications.isNotEmpty()) {
                        Button(
                            onClick = { handleClearAll() },
                            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.error),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                        ) {
                            Text(
                                "CLEAR ALL",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 2.sp
                            )
                        }
                    }
                }
            }

            if (filteredNotifications.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp)
                            .clip(RoundedCornerShape(32.dp))
                            .background(theme.colors.backgroundSecondary)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(32.dp))
                            .padding(48.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                modifier = Modifier
                                    .size(72.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(theme.colors.card)
                                    .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.NotificationsOff, contentDescription = null, tint = theme.colors.textDisabled, modifier = Modifier.size(40.dp))
                            }
                            Spacer(Modifier.height(16.dp))
                            Text(
                                "NO NOTIFICATIONS YET",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 3.sp
                            )
                        }
                    }
                }
            } else {
                itemsIndexed(filteredNotifications, key = { _, notif -> notif.id }) { _, notif ->
                    var isVisible by remember { mutableStateOf(false) }
                    LaunchedEffect(Unit) { isVisible = true }

                    AnimatedVisibility(
                        visible = isVisible,
                        enter = slideInHorizontally(initialOffsetX = { -100 }) + fadeIn(),
                        exit = slideOutHorizontally(targetOffsetX = { 200 }) + fadeOut()
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(theme.colors.card)
                                .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                                .clickable { handleNotifClick(notif) }
                        ) {
                            // Accent left bar
                            Box(
                                modifier = Modifier
                                    .align(Alignment.CenterStart)
                                    .width(6.dp)
                                    .fillMaxHeight()
                                    .background(theme.colors.accent)
                            )

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 14.dp, top = 16.dp, end = 16.dp, bottom = 16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Top
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        if (!notif.is_read) {
                                            Box(
                                                modifier = Modifier
                                                    .size(8.dp)
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(theme.colors.accent)
                                            )
                                        }
                                        Icon(
                                            Icons.Default.Notifications,
                                            contentDescription = null,
                                            tint = theme.colors.accent,
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Text(
                                            notif.title.uppercase(),
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Black,
                                            color = theme.colors.textPrimary,
                                            letterSpacing = 1.sp,
                                            modifier = Modifier.offset(y = (-1).dp)
                                        )
                                    }
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        notif.message,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = theme.colors.textSecondary,
                                        lineHeight = 16.sp,
                                        maxLines = 3,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(Modifier.height(8.dp))

                                    // Timestamp
                                    val dt = try {
                                        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(notif.created_at) ?: Date()
                                    } catch (e: Exception) { Date() }

                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.AccessTime,
                                            contentDescription = null,
                                            tint = theme.colors.textDisabled,
                                            modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp))
                                        )
                                        Text(
                                            "${timeFormat.format(dt)} • ${dateFormat.format(dt)}",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Black,
                                            color = theme.colors.textDisabled,
                                            letterSpacing = 1.sp
                                        )
                                    }

                                    val dataJson = notif.data?.let { com.boxitt.app.services.Storage.json.parseToJsonElement(it).jsonObject }
                                    val nType = dataJson?.get("type")?.jsonPrimitive?.contentOrNull
                                    if (nType == "match_join_confirmed" || nType == "challenge_confirmed") {
                                        Spacer(Modifier.height(12.dp))
                                        Button(
                                            onClick = { handleViewTicket(notif) },
                                            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                                            shape = RoundedCornerShape(12.dp),
                                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                                            modifier = Modifier.height(36.dp)
                                        ) {
                                            Icon(
                                                Icons.Default.QrCode,
                                                contentDescription = null,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Spacer(Modifier.width(6.dp))
                                            Text(
                                                "VIEW TICKET",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Black,
                                                letterSpacing = 1.sp
                                            )
                                        }
                                    }
                                }

                                IconButton(onClick = { handleDelete(notif.id) }) {
                                    Icon(
                                        Icons.Default.Delete,
                                        contentDescription = "Delete",
                                        tint = theme.colors.textDisabled
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Loading overlay for QR
        if (loadingQR) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = theme.colors.accent)
            }
        }

        // QR Code Dialog
        if (showQR && selectedBooking != null && selectedLocation != null) {
            Dialog(onDismissRequest = { showQR = false }) {
                QRCodeModal(
                    booking = selectedBooking!!,
                    location = selectedLocation!!,
                    onClose = { showQR = false },
                    onAlert = onAlert
                )
            }
        }
    }
}



