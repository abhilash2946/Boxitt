package com.boxitt.app.pages

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import com.boxitt.app.components.LoadingButton
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.boxitt.app.*
import com.boxitt.app.services.LocationService
import com.boxitt.app.services.AdminService
import com.boxitt.app.services.PricingService
import com.boxitt.app.services.SupabaseStorageService
import com.boxitt.app.Pricing
import com.boxitt.app.theme.AppTheme
import androidx.compose.ui.draw.alpha
import androidx.compose.material.icons.automirrored.filled.*
import com.boxitt.app.BookingStatus
import com.boxitt.app.Location
import com.boxitt.app.*
import com.boxitt.app.components.DatePickerModal
import com.boxitt.app.components.ImageViewer
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.*
import com.boxitt.app.contexts.PermissionsManager
import com.boxitt.app.contexts.PermissionType
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun AdminDashboard(
    selectedLocation: Location,
    onLocationChange: ((Location) -> Unit)? = null,
    user: User?,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onConfirm: ((String, () -> Unit, (() -> Unit)?, String?, String?, Boolean?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var isLoggedIn by remember { mutableStateOf(false) }
    var role by remember { mutableStateOf<String?>(null) }
    
    // SECURITY FIX: Local internal state to prevent admin session from changing user's global view
    var dashboardLocation by remember { mutableStateOf(selectedLocation) }

    LaunchedEffect(selectedLocation.id) {
        dashboardLocation = selectedLocation
    }

    var email by remember { mutableStateOf(user?.email ?: "") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var bookings by remember { mutableStateOf<List<Booking>>(emptyList()) }
    var pricing by remember { mutableStateOf<List<Pricing>>(emptyList()) }
    var locations by remember { mutableStateOf<List<Location>>(emptyList()) }
    var activeTab by remember { mutableStateOf(AdminTab.BOOKINGS) }
    var loading by remember { mutableStateOf(false) }
    var isActionLoading by remember { mutableStateOf(false) }
    var selectedCourtId by remember { mutableStateOf<String?>(null) }
    var dbVersion by remember { mutableStateOf(0) }

    val isGameZoneArena = remember(dashboardLocation) {
        val name = (dashboardLocation.name ?: "").lowercase()
        val desc = (dashboardLocation.description ?: "").lowercase()
        val supported = dashboardLocation.supportedSports.map { it.value.lowercase() }
        name.contains("game zone") ||
        name.contains("gamezone") ||
        name.contains("gaming") ||
        desc.contains("game zone") ||
        desc.contains("gamezone") ||
        supported.any { it.contains("game") || it.contains("zone") }
    }

    var gameZonePlatforms by remember { mutableStateOf<List<GameZonePlatform>>(emptyList()) }
    var gameZoneResources by remember { mutableStateOf<List<GameZoneResource>>(emptyList()) }
    var gameZoneGames by remember { mutableStateOf<List<GameZoneGame>>(emptyList()) }

    LaunchedEffect(dashboardLocation.id, isGameZoneArena) {
        if (isGameZoneArena && dashboardLocation.id.isNotBlank()) {
            gameZonePlatforms = GameZoneService.getPlatforms(dashboardLocation.id)
            gameZoneResources = GameZoneService.getResources(dashboardLocation.id)
            gameZoneGames = GameZoneService.getGames(dashboardLocation.id)
        } else {
            gameZonePlatforms = emptyList()
            gameZoneResources = emptyList()
            gameZoneGames = emptyList()
        }
    }

    LaunchedEffect(activeTab, isGameZoneArena) {
        if (activeTab == AdminTab.GAMEZONE && !isGameZoneArena) {
            activeTab = AdminTab.BOOKINGS
        }
    }

    // Sync selectedCourtId / platformId
    LaunchedEffect(dashboardLocation, gameZonePlatforms, isGameZoneArena, selectedCourtId) {
        if (isGameZoneArena && gameZonePlatforms.isNotEmpty()) {
            val exists = gameZonePlatforms.any { it.id == selectedCourtId }
            if (!exists) selectedCourtId = gameZonePlatforms[0].id
        } else if (!isGameZoneArena && dashboardLocation.courts?.isNotEmpty() == true) {
            val exists = dashboardLocation.courts!!.any { it.id == selectedCourtId }
            if (!exists) selectedCourtId = dashboardLocation.courts!![0].id
        }
    }

    LaunchedEffect(dashboardLocation.id) {
        val savedAuth = Storage.getAdminAuth()
        if (savedAuth != null) {
            // SECURITY FIX: Only auto-login if the saved session matches the currently viewed arena
            if (savedAuth.role == "superadmin" || savedAuth.locationId == dashboardLocation.id) {
                role = savedAuth.role
                email = savedAuth.email
                isLoggedIn = true
            } else {
                // Clear conflicting admin session UI state
                isLoggedIn = false
                role = null
            }
        }
    }
    var currentPwdForUpdate by remember { mutableStateOf("") }
    var newUsername by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmNewPassword by remember { mutableStateOf("") }

    // Time filter
    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    var timeFilter by remember { mutableStateOf(TimeFilter.DAY) }
    var filterDate by remember { mutableStateOf(sdf.format(java.util.Date())) }

    // Manual booking
    var showManualBooking by remember { mutableStateOf(false) }

    // Image upload
    var currentEditingLocId by remember { mutableStateOf<String?>(null) }

    // Pricing form
    var newDuration by remember { mutableStateOf("") }
    var newPrice by remember { mutableStateOf("") }
    var newAdvancePrice by remember { mutableStateOf("") }
    var newCategory by remember { mutableStateOf("morning") }
    var newRuleType by remember { mutableStateOf("default") }
    var newDayOfWeek by remember { mutableStateOf(0) }
    var newSpecificDate by remember { mutableStateOf(sdf.format(java.util.Date())) }
    var showDatePicker by remember { mutableStateOf(false) }

    // Timing form
    val currentPlatform = remember(dashboardLocation, gameZonePlatforms, selectedCourtId, isGameZoneArena) {
        if (isGameZoneArena) gameZonePlatforms.find { it.id == selectedCourtId } else null
    }
    val currentCourt = remember(dashboardLocation, selectedCourtId, isGameZoneArena) {
        if (!isGameZoneArena) dashboardLocation.courts?.find { it.id == selectedCourtId } else null
    }
    
    var openHour by remember { mutableStateOf((currentPlatform?.openHour ?: currentCourt?.open_hour ?: dashboardLocation.openHour ?: 6).toString()) }
    var closeHour by remember { mutableStateOf((currentPlatform?.closeHour ?: currentCourt?.close_hour ?: dashboardLocation.closeHour ?: 23).toString()) }
    var morningStart by remember { mutableStateOf((currentPlatform?.morningStart ?: currentCourt?.morning_start ?: dashboardLocation.morningStart ?: 6).toString()) }
    var morningEnd by remember { mutableStateOf((currentPlatform?.morningEnd ?: currentCourt?.morning_end ?: dashboardLocation.morningEnd ?: 18).toString()) }
    var nightStart by remember { mutableStateOf((currentPlatform?.nightStart ?: currentCourt?.night_start ?: dashboardLocation.nightStart ?: 18).toString()) }
    var nightEnd by remember { mutableStateOf((currentPlatform?.nightEnd ?: currentCourt?.night_end ?: dashboardLocation.nightEnd ?: 24).toString()) }

    // About form
    var aboutDescription by remember { mutableStateOf((if (isGameZoneArena) currentPlatform?.description else currentCourt?.description) ?: dashboardLocation.description ?: "") }
    var aboutContact by remember { mutableStateOf(dashboardLocation.contact ?: "") }
    var aboutAdvanceRequired by remember { mutableStateOf(dashboardLocation.advanceBookingRequired ?: false) }

    LaunchedEffect(currentPlatform, currentCourt, dashboardLocation, isGameZoneArena) {
        val srcOpen = if (isGameZoneArena) currentPlatform?.openHour else currentCourt?.open_hour ?: dashboardLocation.open_hour
        val srcClose = if (isGameZoneArena) currentPlatform?.closeHour else currentCourt?.close_hour ?: dashboardLocation.close_hour
        val srcMStart = if (isGameZoneArena) currentPlatform?.morningStart else currentCourt?.morning_start ?: dashboardLocation.morning_start
        val srcMEnd = if (isGameZoneArena) currentPlatform?.morningEnd else currentCourt?.morning_end ?: dashboardLocation.morning_end
        val srcNStart = if (isGameZoneArena) currentPlatform?.nightStart else currentCourt?.night_start ?: dashboardLocation.night_start
        val srcNEnd = if (isGameZoneArena) currentPlatform?.nightEnd else currentCourt?.night_end ?: dashboardLocation.night_end

        openHour = (srcOpen ?: 6).toString()
        closeHour = (srcClose ?: 23).toString()
        morningStart = (srcMStart ?: 6).toString()
        morningEnd = (srcMEnd ?: 18).toString()
        nightStart = (srcNStart ?: 18).toString()
        nightEnd = (srcNEnd ?: 24).toString()

        aboutDescription = (if (isGameZoneArena) currentPlatform?.description else currentCourt?.description) ?: dashboardLocation.description ?: ""
        aboutContact = dashboardLocation.contact ?: ""
        aboutAdvanceRequired = dashboardLocation.advanceBookingRequired ?: false
    }

    val imagePickerLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        if (uris.isNotEmpty() && currentEditingLocId != null) {
            val locId = currentEditingLocId!!
            val targetCourtId = (context as? android.app.Activity)?.intent?.getStringExtra("_targetCourtId")
            isActionLoading = true
            scope.launch {
                try {
                    val loc = locations.find { it.id == locId } ?: return@launch
                    val court = loc.courts?.find { it.id == targetCourtId }
                    
                    val courtNum = if (court != null) court.courtNumber 
                                  else if (targetCourtId?.startsWith("temp-") == true) targetCourtId.split("-").last().toIntOrNull() ?: 1
                                  else 1

                    // Structured path: ArenaName_ShortID/CourtName/filename
                    val arenaFolder = "${loc.name.replace(Regex("[^a-zA-Z0-9]"), "_")}_${loc.id.take(8)}"
                    val courtFolder = if (targetCourtId != null) (court?.name?.replace(Regex("[^a-zA-Z0-9]"), "_") ?: "Court_$courtNum") else "Arena_Global"

                    val bucket = if (targetCourtId != null) "courts" else "arenas"

                    val newUrls = uris.map { uri ->
                        val stream = context.contentResolver.openInputStream(uri)!!
                        val fileName = "$arenaFolder/$courtFolder/${System.currentTimeMillis()}-${uri.lastPathSegment?.replace(Regex("[^a-zA-Z0-9.]"), "_")}"
                        SupabaseStorageService.uploadFile(bucket, fileName, stream, "image/jpeg")
                    }
                    
                    // Update parent state to trigger flow down to cards
                    locations = locations.map { l ->
                        if (l.id != locId) l
                        else {
                            if (targetCourtId == null) {
                                l.copy(image_urls = (l.imageUrls + newUrls).distinct())
                            } else {
                                val updatedCourts = (l.courts ?: emptyList()).toMutableList()
                                val cIdx = updatedCourts.indexOfFirst { it.id == targetCourtId }
                                if (cIdx > -1) {
                                    updatedCourts[cIdx] = updatedCourts[cIdx].copy(image_urls = (updatedCourts[cIdx].imageUrls + newUrls).distinct())
                                } else {
                                    updatedCourts.add(Court(id = targetCourtId, locationId = locId, courtNumber = courtNum, image_urls = newUrls))
                                }
                                l.copy(courts = updatedCourts)
                            }
                        }
                    }
                    
                    // Also sync dashboardLocation if it matches
                    if (dashboardLocation.id == locId) {
                        dashboardLocation = locations.find { it.id == locId } ?: dashboardLocation
                    }

                    onAlert?.invoke("Photos uploaded! Click 'Save Arena Changes' to persist.", "info", null)
                } catch (e: Exception) {
                    if (e is kotlinx.coroutines.CancellationException) throw e
                    onAlert?.invoke(e.message ?: "Upload failed", "error", null)
                } finally {
                    isActionLoading = false
                    currentEditingLocId = null
                }
            }
        }
    }

    fun refreshPricing() {
        scope.launch {
            try {
                pricing = PricingService.getPricingForLocation(dashboardLocation.id)
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Error", "error", null)
            }
        }
    }

    fun refreshData() {
        if (!isLoggedIn || dashboardLocation.id.isBlank()) return
        loading = true
        scope.launch {
            try {
                val allBookings = BookingService.getBookings(dashboardLocation.id)
                val allLocations = LocationService.getLocations()
                val filtered = if (role == "admin") allLocations.filter { it.id == dashboardLocation.id } else allLocations
                bookings = allBookings.sortedByDescending { it.createdAt }
                locations = filtered

                allLocations.find { it.id == dashboardLocation.id }?.let {
                    dashboardLocation = it
                }

                dbVersion++
                if (activeTab == AdminTab.PRICING) refreshPricing()
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Error", "error", null)
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(isLoggedIn, activeTab) { if (isLoggedIn) refreshData() }
    LaunchedEffect(activeTab) { if (activeTab == AdminTab.PRICING) refreshPricing() }

    LaunchedEffect(dashboardLocation, selectedCourtId) {
        openHour = (currentCourt?.open_hour ?: dashboardLocation.open_hour ?: 6).toString()
        closeHour = (currentCourt?.close_hour ?: dashboardLocation.close_hour ?: 23).toString()
        morningStart = (currentCourt?.morning_start ?: dashboardLocation.morning_start ?: 6).toString()
        morningEnd = (currentCourt?.morning_end ?: dashboardLocation.morning_end ?: 18).toString()
        nightStart = (currentCourt?.night_start ?: dashboardLocation.night_start ?: 18).toString()
        nightEnd = (currentCourt?.night_end ?: dashboardLocation.night_end ?: 24).toString()
        aboutDescription = currentCourt?.description ?: dashboardLocation.description ?: ""
        aboutContact = dashboardLocation.contact ?: ""
        aboutAdvanceRequired = dashboardLocation.advanceBookingRequired ?: false
    }

    val filteredBookings = remember(bookings, timeFilter, filterDate) {
        bookings.filter { b ->
            when (timeFilter) {
                TimeFilter.DAY -> b.date == filterDate
                TimeFilter.MONTH -> b.date.startsWith(filterDate.take(7))
                TimeFilter.YEAR -> b.date.startsWith(filterDate.take(4))
            }
        }
    }

    val reportStats = remember(filteredBookings) {
        val valid = filteredBookings.filter { it.status == BookingStatus.BOOKED || it.status == BookingStatus.APPROVED || it.status == BookingStatus.CONFIRMED || it.status == BookingStatus.COMPLETED }
        val totalRevenue = valid.sumOf { it.amount }
        val moneyCollected = valid.sumOf { if (it.status == BookingStatus.COMPLETED || it.status == BookingStatus.CONFIRMED) it.amount else it.advancePaid }
        Triple(totalRevenue, moneyCollected, filteredBookings.size)
    }

    LaunchedEffect(Unit) {
        val savedAuth = Storage.getAdminAuth()
        if (savedAuth != null) {
            // SECURITY FIX: Only auto-login if the saved session matches the currently viewed arena
            if (savedAuth.role == "superadmin" || savedAuth.locationId == dashboardLocation.id) {
                role = savedAuth.role
                email = savedAuth.email
                isLoggedIn = true
            } else {
                // Clear conflicting admin session
                isLoggedIn = false
                role = null
            }
        }
    }

    fun handleLogin() {
        loading = true
        scope.launch {
            try {
                val result = AdminService.loginAdmin(email.trim(), username.trim(), password)
                if (result.success) {
                    // SECURITY FIX: Enforce "Arena-to-Key" matching
                    // Ensure the logged in admin actually owns the arena they are trying to manage
                    if (result.role != "superadmin" && result.location?.id != dashboardLocation.id) {
                        onAlert?.invoke("Unauthorized: This account belongs to a different arena.", "error", null)
                        return@launch
                    }

                    role = result.role
                    // SECURITY FIX: Isolate Dashboard context. 
                    // Do NOT update the global user view unless they are browsing their own arena.
                    if (result.location != null) {
                        dashboardLocation = result.location
                        // Only sync global context if superadmin or matching ID
                        if (role == "superadmin" || result.location.id == selectedLocation.id) {
                             onLocationChange?.invoke(result.location)
                        }
                    }
                    isLoggedIn = true
                    
                    Storage.setAdminAuth(
                        AdminAuth(
                            role = result.role,
                            locationId = result.location?.id,
                            email = email.trim()
                        )
                    )
                } else {
                    onAlert?.invoke("Invalid credentials.", "error", null)
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Login failed", "error", null)
            } finally {
                loading = false
            }
        }
    }

    fun handleUpdateCredentials() {
        loading = true
        scope.launch {
            try {
                val verified = AdminService.verifyAndUpdate(
                    usernameQuery = if (role == "superadmin") "superadmin" else username,
                    currentPwd = currentPwdForUpdate,
                    newUsername = newUsername, newPassword = newPassword
                )
                if (!verified) { onAlert?.invoke("Incorrect password.", "error", null); return@launch }
                if (newPassword.isNotBlank() && newPassword != confirmNewPassword) { onAlert?.invoke("Passwords do not match.", "error", null); return@launch }
                onAlert?.invoke("Settings Updated!", "success", null)
                currentPwdForUpdate = ""; newPassword = ""; confirmNewPassword = ""
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Error", "error", null)
            } finally {
                loading = false
            }
        }
    }

    fun handleAddPrice() {
        if (newDuration.isBlank() || newPrice.isBlank() || newAdvancePrice.isBlank() || selectedCourtId == null) { onAlert?.invoke("Please fill all fields.", "error", null); return }
        isActionLoading = true
        scope.launch {
            try {
                PricingService.upsertPricing(
                    Pricing(
                        location_id = dashboardLocation.id,
                        court_id = selectedCourtId,
                        duration_hours = newDuration.toDouble(),
                        price = newPrice.toDouble(),
                        advance_price = newAdvancePrice.toDouble(),
                        category = newCategory,
                        rule_type = newRuleType,
                        day_of_week = if (newRuleType == "day") newDayOfWeek else null,
                        specific_date = if (newRuleType == "date") newSpecificDate else null
                    )
                )
                newDuration = ""; newPrice = ""; newAdvancePrice = ""
                refreshPricing()
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Error", "error", null)
            } finally {
                isActionLoading = false
            }
        }
    }

    fun handleDeletePrice(priceId: String) {
        fun doDelete() {
            isActionLoading = true
            scope.launch {
                try { PricingService.deletePricing(priceId); refreshPricing() }
                catch (e: Exception) { onAlert?.invoke(e.message ?: "Error", "error", null) }
                finally { isActionLoading = false }
            }
        }
        if (onConfirm != null) onConfirm("Delete this pricing rule?", { doDelete() }, null, "Delete", "Cancel", true)
        else doDelete()
    }

    fun handleUpdateTiming() {
        if (selectedCourtId == null) return
        isActionLoading = true
        scope.launch {
            try {
                val updates = mapOf(
                    "open_hour" to openHour.toIntOrNull(),
                    "close_hour" to closeHour.toIntOrNull(),
                    "morning_start" to morningStart.toIntOrNull(),
                    "morning_end" to morningEnd.toIntOrNull(),
                    "night_start" to nightStart.toIntOrNull(),
                    "night_end" to nightEnd.toIntOrNull()
                )
                if (isGameZoneArena) {
                    GameZoneService.updatePlatform(selectedCourtId!!, updates)
                    onAlert?.invoke("Operational hours updated for platform!", "success", null)
                } else {
                    LocationService.updateCourt(selectedCourtId!!, updates)
                    onAlert?.invoke("Operational hours updated for court!", "success", null)
                }
                refreshData()
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Error", "error", null)
            } finally { isActionLoading = false }
        }
    }

    fun handleUpdateAbout() {
        isActionLoading = true
        scope.launch {
            try {
                val arenaUpdates = mapOf(
                    "description" to aboutDescription,
                    "contact" to aboutContact,
                    "advance_booking_required" to aboutAdvanceRequired
                )
                if (isGameZoneArena && selectedCourtId != null) {
                    GameZoneService.updatePlatform(selectedCourtId!!, mapOf("description" to aboutDescription))
                }
                LocationService.updateLocation(dashboardLocation.id, arenaUpdates)
                
                if (!isGameZoneArena && selectedCourtId != null) {
                    LocationService.updateCourt(selectedCourtId!!, mapOf("description" to aboutDescription))
                    val updatedCourts = dashboardLocation.courts?.map { court ->
                        if (court.id == selectedCourtId) court.copy(description = aboutDescription) else court
                    }
                    dashboardLocation = dashboardLocation.copy(
                        courts = updatedCourts,
                        contact = aboutContact,
                        advanceBookingRequired = aboutAdvanceRequired
                    )
                } else {
                    dashboardLocation = dashboardLocation.copy(
                        description = aboutDescription,
                        contact = aboutContact,
                        advanceBookingRequired = aboutAdvanceRequired
                    )
                }
                
                refreshData()
                onAlert?.invoke("Arena details updated!", "success", null)
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Error", "error", null)
            } finally { isActionLoading = false }
        }
    }

    fun handleCopyFromCourt(tab: String, sourceCourt: com.boxitt.app.Court) {
        if (selectedCourtId == null) return
        if (sourceCourt.id == selectedCourtId) return
        
        isActionLoading = true
        scope.launch {
            try {
                when(tab) {
                    "pricing" -> {
                        // Clear existing pricing for target court first
                        PricingService.deletePricingByCourt(selectedCourtId!!)
                        
                        val sourcePricing = pricing.filter { it.court_id == sourceCourt.id }
                        if (sourcePricing.isNotEmpty()) {
                            val bulkData = sourcePricing.map { p ->
                                p.copy(id = null, court_id = selectedCourtId)
                            }
                            PricingService.bulkUpsertPricing(bulkData)
                        }
                        refreshPricing()
                    }
                    "timing" -> {
                        LocationService.updateCourt(selectedCourtId!!, mapOf(
                            "open_hour" to sourceCourt.open_hour,
                            "close_hour" to sourceCourt.close_hour,
                            "morning_start" to sourceCourt.morning_start,
                            "morning_end" to sourceCourt.morning_end,
                            "night_start" to sourceCourt.night_start,
                            "night_end" to sourceCourt.night_end
                        ))
                        refreshData()
                    }
                }
                onAlert?.invoke("Settings copied from ${sourceCourt.name ?: "Court ${sourceCourt.courtNumber}"}!", "success", null)
            } catch (e: Exception) {
                onAlert?.invoke(e.message ?: "Copy failed", "error", null)
            } finally { isActionLoading = false }
        }
    }

    fun handleUpdateBookingStatus(id: String, status: BookingStatus) {
        isActionLoading = true
        scope.launch {
            try {
                BookingService.updateBooking(id, status = status)
                refreshData()
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                onAlert?.invoke(e.message ?: "Error", "error", null)
            } finally { isActionLoading = false }
        }
    }

    fun handleDeleteArena(id: String) {
        if (role != "superadmin") return
        fun doDelete() {
            isActionLoading = true
            scope.launch {
                try { LocationService.deleteLocation(id); refreshData() }
                catch (e: Exception) { onAlert?.invoke(e.message ?: "Error", "error", null) }
                finally { isActionLoading = false }
            }
        }
        if (onConfirm != null) onConfirm("Delete this Arena?", { doDelete() }, null, "Delete", "Cancel", true)
        else doDelete()
    }

    // Login screen
    if (!isLoggedIn) {
        Box(modifier = Modifier.fillMaxSize().background(theme.colors.background), contentAlignment = Alignment.Center) {
            Column(modifier = Modifier.width(400.dp).padding(24.dp)) {
                // Icon
                Box(modifier = Modifier.size(72.dp).clip(RoundedCornerShape(20.dp)).background(theme.colors.accent).align(Alignment.CenterHorizontally), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.AdminPanelSettings, null, tint = Color.White, modifier = Modifier.size(36.dp))
                }
                Spacer(Modifier.height(16.dp))
                Text("ADMIN LOGIN", fontSize = 28.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, modifier = Modifier.align(Alignment.CenterHorizontally))
                Box(modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(horizontal = 16.dp, vertical = 6.dp).align(Alignment.CenterHorizontally)) {
                    Text("SECURITY VERIFICATION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                }
                Spacer(Modifier.height(28.dp))

                Text("ADMIN EMAIL", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(value = email, onValueChange = { email = it }, leadingIcon = { Icon(Icons.Default.Email, null, tint = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, focusedContainerColor = theme.colors.backgroundSecondary, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                Spacer(Modifier.height(12.dp))
                Text("USERNAME", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(value = username, onValueChange = { username = it }, leadingIcon = { Icon(Icons.Default.Person, null, tint = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, focusedContainerColor = theme.colors.backgroundSecondary, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                Spacer(Modifier.height(12.dp))
                Text("PASSWORD", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(value = password, onValueChange = { password = it }, leadingIcon = { Icon(Icons.Default.Lock, null, tint = theme.colors.textDisabled) }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, focusedContainerColor = theme.colors.backgroundSecondary, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                Spacer(Modifier.height(20.dp))
                LoadingButton(
                    onClick = { handleLogin() },
                    loading = loading,
                    text = "LOGIN",
                    loadingText = "Authenticating...",
                    backgroundColor = theme.colors.accent,
                    modifier = Modifier.fillMaxWidth().height(54.dp)
                )
            }
        }
        return
    }

    // Dashboard
    BoxWithConstraints(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        val isExpanded = maxWidth > 840.dp
        
        if (isExpanded) {
            Row(modifier = Modifier.fillMaxSize()) {
                // Desktop Sidebar
                Column(
                    modifier = Modifier
                        .width(260.dp)
                        .fillMaxHeight()
                        .background(theme.colors.card)
                        .border(BorderStroke(1.dp, theme.colors.border))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("ADMIN PANEL", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, modifier = Modifier.padding(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(horizontal = 8.dp)) {
                        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(if (role == "superadmin") Color(0xFFA855F7) else theme.colors.accent))
                        Text(if (role == "superadmin") "UNIVERSAL" else selectedLocation.name.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                    }
                    
                    Spacer(Modifier.height(24.dp))
                    
                    val tabs = listOfNotNull(
                        AdminTab.BOOKINGS to Icons.Default.Dashboard,
                        if (isGameZoneArena) AdminTab.GAMEZONE to Icons.Default.Gamepad else null,
                        AdminTab.LOCATIONS to Icons.Default.Storage,
                        AdminTab.REPORTS to Icons.Default.BarChart,
                        AdminTab.SECURITY to Icons.Default.Security,
                        AdminTab.TIMING to Icons.Default.AccessTime,
                        AdminTab.PRICING to Icons.Default.Settings,
                        AdminTab.ABOUT to Icons.Default.Info,
                        AdminTab.SCHEDULE to Icons.Default.DateRange
                    )
                    tabs.forEach { (tab, icon) ->
                        val selected = activeTab == tab
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(if (selected) theme.colors.accent else Color.Transparent)
                                .clickable { activeTab = tab }
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            contentAlignment = Alignment.CenterStart
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Icon(icon, null, tint = if (selected) Color.White else theme.colors.textSecondary, modifier = Modifier.size(20.dp))
                                Text(tab.name.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (selected) Color.White else theme.colors.textSecondary, letterSpacing = 1.sp)
                            }
                        }
                    }
                    
                    Spacer(Modifier.weight(1f))
                    
                    Button(onClick = { showManualBooking = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent)) { Text("MANUAL ENTRY", fontSize = 10.sp, fontWeight = FontWeight.Black) }
                    OutlinedButton(onClick = { isLoggedIn = false; scope.launch { Storage.logout() } }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, theme.colors.border)) { Text("LOGOUT", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary) }
                }
                
                // Content Area
                Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
                    AnimatedContent(targetState = activeTab, transitionSpec = { fadeIn() togetherWith fadeOut() }) { tab ->
                        Box(modifier = Modifier.fillMaxSize().padding(24.dp)) {
                            when (tab) {
                                AdminTab.BOOKINGS -> BookingsTab(filteredBookings, dashboardLocation.courts, loading, timeFilter, filterDate, isActionLoading, theme, isExpanded = true, onTimeFilterChange = { timeFilter = it }, onFilterDateChange = { filterDate = it }, onStatusUpdate = { id, s -> handleUpdateBookingStatus(id, s) })
                                AdminTab.LOCATIONS -> LocationsTab(
                                    locations = locations,
                                    role = role,
                                    isProcessing = isActionLoading,
                                    theme = theme,
                                    onDelete = { handleDeleteArena(it) },
                                    onUpdate = { locId, updates, courtUpdates ->
                                        scope.launch {
                                            try {
                                                isActionLoading = true
                                                LocationService.updateLocation(locId, updates)

                                                if (courtUpdates != null) {
                                                    val freshLoc = LocationService.getLocations().find { it.id == locId }
                                                    courtUpdates.forEach { cu ->
                                                        val courtId = cu["id"] as String
                                                        val targetId = if (courtId.startsWith("temp-")) {
                                                            val num = cu["courtNumber"] as Int
                                                            freshLoc?.courts?.find { it.courtNumber == num }?.id ?: return@forEach
                                                        } else courtId

                                                        LocationService.updateCourt(targetId, cu.filterKeys { it != "id" && it != "courtNumber" })
                                                    }
                                                }

                                                refreshData()
                                            } catch (e: Exception) {
                                                onAlert?.invoke(e.message ?: "Update failed", "error", null)
                                            } finally { isActionLoading = false }
                                        }
                                    }, onAlert = onAlert, dbVersion = dbVersion)
                                AdminTab.REPORTS -> ReportsTab(reportStats, selectedLocation, theme)
                                AdminTab.SECURITY -> SecurityTab(currentPwdForUpdate, newUsername, newPassword, confirmNewPassword, loading, theme, onCurrentPwdChange = { currentPwdForUpdate = it }, onNewUsernameChange = { newUsername = it }, onNewPwdChange = { newPassword = it }, onConfirmPwdChange = { confirmNewPassword = it }, onSubmit = { handleUpdateCredentials() })
                                AdminTab.GAMEZONE -> GameZoneTab(gameZonePlatforms, gameZoneResources, gameZoneGames, theme)
                                AdminTab.TIMING -> {
                                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                            PlatformOrCourtSelector(isGameZoneArena, dashboardLocation, gameZonePlatforms, selectedCourtId, theme) { selectedCourtId = it }
                                            if (!isGameZoneArena) {
                                                CopyDropdown(dashboardLocation, selectedCourtId, theme) { handleCopyFromCourt("timing", it) }
                                            }
                                        }
                                        TimingTab(openHour, closeHour, morningStart, morningEnd, nightStart, nightEnd, isActionLoading, theme, onChange = { field, v -> 
                                            when(field) {
                                                "openHour" -> openHour = v
                                                "closeHour" -> closeHour = v
                                                "morningStart" -> morningStart = v
                                                "morningEnd" -> morningEnd = v
                                                "nightStart" -> nightStart = v
                                                "nightEnd" -> nightEnd = v
                                            }
                                        }, onSave = { handleUpdateTiming() })
                                    }
                                }
                                AdminTab.PRICING -> {
                                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                            PlatformOrCourtSelector(isGameZoneArena, dashboardLocation, gameZonePlatforms, selectedCourtId, theme) { selectedCourtId = it }
                                            if (!isGameZoneArena) {
                                                CopyDropdown(dashboardLocation, selectedCourtId, theme) { handleCopyFromCourt("pricing", it) }
                                            }
                                        }
                                        PricingTab(pricing, selectedCourtId, newDuration, newPrice, newAdvancePrice, newCategory, newRuleType, newDayOfWeek, newSpecificDate, isActionLoading, showDatePicker, theme, onDurationChange = { newDuration = it }, onPriceChange = { newPrice = it }, onAdvancePriceChange = { newAdvancePrice = it }, onCategoryChange = { newCategory = it }, onRuleTypeChange = { newRuleType = it }, onDayOfWeekChange = { newDayOfWeek = it }, onSpecificDateChange = { newSpecificDate = it }, onShowDatePicker = { showDatePicker = it }, onAddPrice = { handleAddPrice() }, onDeletePrice = { handleDeletePrice(it) }, copyDropdown = { if (!isGameZoneArena) CopyDropdown(dashboardLocation, selectedCourtId, theme) { handleCopyFromCourt("pricing", it) } })
                                    }
                                }
                                AdminTab.ABOUT -> {
                                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        if (!isGameZoneArena) {
                                            PlatformOrCourtSelector(isGameZoneArena, dashboardLocation, gameZonePlatforms, selectedCourtId, theme) { selectedCourtId = it }
                                        }
                                        AboutTab(aboutDescription, aboutContact, selectedLocation.rating ?: 0.0, aboutAdvanceRequired, isActionLoading, theme, onDescriptionChange = { aboutDescription = it }, onContactChange = { aboutContact = it }, onAdvanceChange = { aboutAdvanceRequired = it }, onSave = { handleUpdateAbout() })
                                    }
                                }
                                AdminTab.SCHEDULE -> {
                                    ScheduleTabContent(locationId = dashboardLocation.id, theme = theme, onAlert = onAlert, onConfirm = onConfirm)
                                }
                            }
                        }
                    }
                }
            }
        } else {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header
                Box(modifier = Modifier.fillMaxWidth().background(theme.colors.card).border(1.dp, theme.colors.border).padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("ADMIN DASHBOARD", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(if (role == "superadmin") Color(0xFFA855F7) else theme.colors.accent))
                                Text(if (role == "superadmin") "UNIVERSAL ACCESS" else "ARENA: ${dashboardLocation.name.uppercase()}", fontSize = 8.sp, fontWeight = FontWeight.Black, color = if (role == "superadmin") Color(0xFFA855F7) else theme.colors.accent, letterSpacing = 1.sp)
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Button(onClick = { showManualBooking = true }, colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent), shape = RoundedCornerShape(10.dp), contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp), modifier = Modifier.height(32.dp)) { Text("MANUAL", fontSize = 9.sp, fontWeight = FontWeight.Black) }
                            OutlinedButton(onClick = { 
                                isLoggedIn = false
                                role = null
                                scope.launch { 
                                    Storage.logout() 
                                    // SECURITY FIX: In Android, we don't have window.location.href, 
                                    // but we can trigger a navigation back to the entry point if needed.
                                    // The parent (MainActivity) usually handles auth state.
                                } 
                            }, shape = RoundedCornerShape(10.dp), contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp), modifier = Modifier.height(32.dp), border = BorderStroke(1.dp, theme.colors.border)) { Text("LOGOUT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary) }
                        }
                    }
                }

                // Tab bar (Mobile)
                Row(modifier = Modifier.fillMaxWidth().background(theme.colors.card).horizontalScroll(rememberScrollState()).padding(8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    val tabs = listOfNotNull(
                        AdminTab.BOOKINGS to "Bookings",
                        if (isGameZoneArena) AdminTab.GAMEZONE to "Game Zone" else null,
                        AdminTab.LOCATIONS to "Locations",
                        AdminTab.REPORTS to "Reports",
                        AdminTab.SECURITY to "Security",
                        AdminTab.TIMING to "Timing",
                        AdminTab.PRICING to "Pricing",
                        AdminTab.ABOUT to "About",
                        AdminTab.SCHEDULE to "Schedule"
                    )
                    tabs.forEach { (tab, label) ->
                        Box(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(if (activeTab == tab) theme.colors.accent else theme.colors.backgroundSecondary.copy(0.4f)).clickable { activeTab = tab }.padding(horizontal = 16.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
                            Text(label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (activeTab == tab) Color.White else theme.colors.textSecondary, letterSpacing = 1.sp)
                        }
                    }
                }

                // Tab content
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    AnimatedContent(targetState = activeTab, transitionSpec = { fadeIn() togetherWith fadeOut() }) { tab ->
                        when (tab) {
                            AdminTab.BOOKINGS -> BookingsTab(filteredBookings, dashboardLocation.courts, loading, timeFilter, filterDate, isActionLoading, theme, isExpanded = false, onTimeFilterChange = { timeFilter = it }, onFilterDateChange = { filterDate = it }, onStatusUpdate = { id, s -> handleUpdateBookingStatus(id, s) })
                            AdminTab.LOCATIONS -> LocationsTab(
                        locations = locations,
                        role = role,
                        isProcessing = isActionLoading,
                        theme = theme,
                        onDelete = { handleDeleteArena(it) },
                        onUpdate = { locId, updates, courtUpdates ->
                            scope.launch {
                                try {
                                    isActionLoading = true
                                    LocationService.updateLocation(locId, updates)
                                    courtUpdates?.forEach { cu ->
                                        val cid = cu["id"] as? String
                                        if (cid != null) {
                                            LocationService.updateCourt(cid, cu.filterKeys { it != "id" })
                                        }
                                    }
                                    refreshData()
                                } catch (e: Exception) {
                                    onAlert?.invoke(e.message ?: "Update failed", "error", null)
                                } finally { isActionLoading = false }
                            }
                        },
                        onAlert = onAlert,
                        dbVersion = dbVersion
                    )
                            AdminTab.REPORTS -> ReportsTab(reportStats, selectedLocation, theme)
                            AdminTab.SECURITY -> SecurityTab(currentPwdForUpdate, newUsername, newPassword, confirmNewPassword, loading, theme, onCurrentPwdChange = { currentPwdForUpdate = it }, onNewUsernameChange = { newUsername = it }, onNewPwdChange = { newPassword = it }, onConfirmPwdChange = { confirmNewPassword = it }, onSubmit = { handleUpdateCredentials() })
                            AdminTab.GAMEZONE -> GameZoneTab(gameZonePlatforms, gameZoneResources, gameZoneGames, theme)
                            AdminTab.TIMING -> {
                                Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                        PlatformOrCourtSelector(isGameZoneArena, dashboardLocation, gameZonePlatforms, selectedCourtId, theme) { selectedCourtId = it }
                                        if (!isGameZoneArena) {
                                            CopyDropdown(dashboardLocation, selectedCourtId, theme) { handleCopyFromCourt("timing", it) }
                                        }
                                    }
                                    TimingTab(openHour, closeHour, morningStart, morningEnd, nightStart, nightEnd, isActionLoading, theme, onChange = { field, v -> 
                                        when(field) {
                                            "openHour" -> openHour = v
                                            "closeHour" -> closeHour = v
                                            "morningStart" -> morningStart = v
                                            "morningEnd" -> morningEnd = v
                                            "nightStart" -> nightStart = v
                                            "nightEnd" -> nightEnd = v
                                        }
                                    }, onSave = { handleUpdateTiming() })
                                }
                            }
                            AdminTab.PRICING -> {
                                Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                        PlatformOrCourtSelector(isGameZoneArena, dashboardLocation, gameZonePlatforms, selectedCourtId, theme) { selectedCourtId = it }
                                        if (!isGameZoneArena) {
                                            CopyDropdown(dashboardLocation, selectedCourtId, theme) { handleCopyFromCourt("pricing", it) }
                                        }
                                    }
                                    PricingTab(pricing, selectedCourtId, newDuration, newPrice, newAdvancePrice, newCategory, newRuleType, newDayOfWeek, newSpecificDate, isActionLoading, showDatePicker, theme, onDurationChange = { newDuration = it }, onPriceChange = { newPrice = it }, onAdvancePriceChange = { newAdvancePrice = it }, onCategoryChange = { newCategory = it }, onRuleTypeChange = { newRuleType = it }, onDayOfWeekChange = { newDayOfWeek = it }, onSpecificDateChange = { newSpecificDate = it }, onShowDatePicker = { showDatePicker = it }, onAddPrice = { handleAddPrice() }, onDeletePrice = { handleDeletePrice(it) }, copyDropdown = { if (!isGameZoneArena) CopyDropdown(dashboardLocation, selectedCourtId, theme) { handleCopyFromCourt("pricing", it) } })
                                }
                            }
                            AdminTab.ABOUT -> {
                                Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    AboutTab(aboutDescription, aboutContact, selectedLocation.rating ?: 0.0, aboutAdvanceRequired, isActionLoading, theme, onDescriptionChange = { aboutDescription = it }, onContactChange = { aboutContact = it }, onAdvanceChange = { aboutAdvanceRequired = it }, onSave = { handleUpdateAbout() })
                                }
                            }
                            AdminTab.SCHEDULE -> {
                                Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                                    ScheduleTabContent(locationId = dashboardLocation.id, theme = theme, onAlert = onAlert, onConfirm = onConfirm)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Manual booking dialog
    if (showManualBooking) {
        Dialog(
            onDismissRequest = { showManualBooking = false },
            properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.95f)
                    .fillMaxHeight(0.9f)
                    .clip(RoundedCornerShape(24.dp))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
            ) {
                Column {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(theme.colors.backgroundSecondary)
                            .padding(20.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("MANUAL BOOKING", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                        IconButton(onClick = { showManualBooking = false }) {
                            Icon(Icons.Default.Close, null, tint = theme.colors.textDisabled)
                        }
                    }
                    Box(modifier = Modifier.weight(1f)) {
                        BookingPage(
                            modifier = Modifier.fillMaxSize(),
                            location = selectedLocation,
                            isAdminManual = true,
                            onComplete = {
                                showManualBooking = false
                                refreshData()
                            },
                            user = user,
                            onAlert = onAlert,
                            navViewModel = null
                        )
                    }
                }
            }
        }
    }
}

// ---- Sub-composables ----

@Composable
private fun CourtSelector(
    location: Location,
    selectedCourtId: String?,
    theme: com.boxitt.app.theme.AppTheme,
    onSelect: (String) -> Unit
) {
    if (location.courts == null || location.courts.isEmpty()) return
    
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        location.courts.forEach { court ->
            val selected = court.id == selectedCourtId
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (selected) theme.colors.accent else theme.colors.backgroundSecondary)
                    .clickable { onSelect(court.id) }
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = court.name ?: "Court ${court.courtNumber}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = if (selected) Color.White else theme.colors.textSecondary,
                    letterSpacing = 1.sp
                )
            }
        }
    }
}

@Composable
private fun CopyDropdown(
    dashboardLocation: Location,
    selectedCourtId: String?,
    theme: com.boxitt.app.theme.AppTheme,
    onCopy: (com.boxitt.app.Court) -> Unit
) {
    if (selectedCourtId == null || dashboardLocation.courts == null || dashboardLocation.courts.size <= 1) return
    val otherCourts = dashboardLocation.courts.filter { it.id != selectedCourtId }
    if (otherCourts.isEmpty()) return

    var expanded by remember { mutableStateOf(false) }
    val rotation by animateFloatAsState(targetValue = if (expanded) 45f else 0f, label = "rotation")

    Box {
        Button(
            onClick = { expanded = !expanded },
            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.backgroundSecondary, contentColor = theme.colors.accent),
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, theme.colors.accent.copy(0.2f)),
            modifier = Modifier.height(48.dp)
        ) {
            Icon(
                Icons.Default.Add, 
                null, 
                modifier = Modifier
                    .size(16.dp)
                    .graphicsLayer(rotationZ = rotation)
            )
            Spacer(Modifier.width(8.dp))
            Text("COPY SETTINGS", fontSize = 10.sp, fontWeight = FontWeight.Black)
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
        ) {
            otherCourts.forEach { source ->
                DropdownMenuItem(
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Text(source.name ?: "Court ${source.courtNumber}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            Icon(Icons.Default.ChevronRight, null, modifier = Modifier.size(14.dp), tint = theme.colors.textDisabled)
                        }
                    },
                    onClick = {
                        expanded = false
                        onCopy(source)
                    }
                )
            }
        }
    }
}

@Composable
private fun BookingsTab(
    bookings: List<Booking>, courts: List<Court>?, loading: Boolean, timeFilter: TimeFilter, filterDate: String,
    isActionLoading: Boolean, theme: com.boxitt.app.theme.AppTheme,
    isExpanded: Boolean,
    onTimeFilterChange: (TimeFilter) -> Unit, onFilterDateChange: (String) -> Unit,
    onStatusUpdate: (String, BookingStatus) -> Unit
) {
    val itemsContent = @Composable {
        if (loading) {
            Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = theme.colors.accent)
            }
        } else if (bookings.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.backgroundSecondary).border(2.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(40.dp), contentAlignment = Alignment.Center) {
                Text("NO RECENT ACTIVITY FOUND", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(bookings) { b -> BookingCard(b, courts, isActionLoading, theme, onStatusUpdate) }
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // Filters
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(TimeFilter.DAY to "Day", TimeFilter.MONTH to "Month", TimeFilter.YEAR to "Year").forEach { (f, label) ->
                    Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(if (timeFilter == f) theme.colors.accent else Color.Transparent).clickable { onTimeFilterChange(f) }.padding(vertical = 10.dp), contentAlignment = Alignment.Center) {
                        Text(label.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (timeFilter == f) Color.White else theme.colors.textSecondary, letterSpacing = 1.sp)
                    }
                }
            }
            
            OutlinedTextField(
                value = if (timeFilter == TimeFilter.YEAR) filterDate.take(4) else if (timeFilter == TimeFilter.MONTH) filterDate.take(7) else filterDate,
                onValueChange = { onFilterDateChange(it) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                placeholder = { Text(if (timeFilter == TimeFilter.DAY) "YYYY-MM-DD" else if (timeFilter == TimeFilter.MONTH) "YYYY-MM" else "YYYY") },
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, focusedContainerColor = theme.colors.card, unfocusedContainerColor = theme.colors.card, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary)
            )
        }
        
        Box(modifier = Modifier.weight(1f)) { itemsContent() }
    }
}

@Composable
private fun BookingCard(
    b: Booking, courts: List<Court>?, isActionLoading: Boolean, theme: com.boxitt.app.theme.AppTheme,
    onStatusUpdate: (String, BookingStatus) -> Unit
) {
    val court = courts?.find { it.id == b.courtId }
    val courtName = court?.let { it.name ?: "Court ${it.courtNumber}" } ?: "Unknown Court"
    val context = LocalContext.current
    var isExpanded by remember { mutableStateOf(false) }

    val isSuccess = b.status == BookingStatus.CONFIRMED || b.status == BookingStatus.APPROVED
    val isBooked = b.status == BookingStatus.BOOKED
    val isTimedOut = b.status == BookingStatus.TIMED_OUT

    val statusColor = when {
        isSuccess -> theme.colors.success
        isBooked -> theme.colors.accent
        isTimedOut -> theme.colors.warning
        else -> theme.colors.error
    }

    val pendingAmount = kotlin.math.max(0.0, b.amount - b.advancePaid)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(theme.colors.card)
            .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
            .clickable { isExpanded = !isExpanded }
            .padding(14.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Line 1: Header (Sport Icon + Time Slot + Date & Status Badges) - Always Visible
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(statusColor.copy(0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = when {
                                isSuccess -> Icons.Default.CheckCircle
                                isBooked -> Icons.Default.Bookmark
                                isTimedOut -> Icons.Default.Timer
                                else -> Icons.Default.Cancel
                            },
                            contentDescription = null,
                            tint = statusColor,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = b.slotTime,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textPrimary
                            )
                            if (b.name.isNotBlank()) {
                                Text(
                                    text = "· ${b.name}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.colors.textPrimary.copy(alpha = 0.8f)
                                )
                            }
                        }
                        val dateText = try {
                            val parsed = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).parse(b.date)
                            if (parsed != null) java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale.getDefault()).format(parsed) else b.date
                        } catch (e: Exception) { b.date }
                        Text(
                            text = dateText,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = theme.colors.textDisabled
                        )
                    }
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(statusColor)
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = if (isBooked) "BOOKED" else b.status.value.uppercase().replace("_", " "),
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                            letterSpacing = 0.5.sp
                        )
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(theme.colors.backgroundSecondary)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(8.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = courtName.uppercase(),
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textPrimary
                        )
                    }
                    Icon(
                        imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = "Expand",
                        tint = theme.colors.accent,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            AnimatedVisibility(visible = isExpanded) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 1.dp)

                    // Line 2: User Contact Details (Phone, Email / ID & Direct Call Button)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(theme.colors.backgroundSecondary.copy(alpha = 0.6f))
                            .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Person,
                                    contentDescription = null,
                                    tint = theme.colors.accent,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = if (b.name.isNotBlank()) b.name else "User",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.colors.textPrimary
                                )
                                Text(
                                    text = "ID: ${b.id.take(8).uppercase()}",
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.colors.textDisabled
                                )
                            }
                            if (b.phone.isNotBlank()) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    modifier = Modifier.padding(top = 2.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Phone,
                                        contentDescription = null,
                                        tint = theme.colors.accent,
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Text(
                                        text = b.phone,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = theme.colors.accent
                                    )
                                }
                            }
                        }

                        if (b.phone.isNotBlank()) {
                            Button(
                                onClick = {
                                    try {
                                        val intent = android.content.Intent(android.content.Intent.ACTION_DIAL).apply {
                                            data = android.net.Uri.parse("tel:${b.phone}")
                                        }
                                        context.startActivity(intent)
                                    } catch (e: Exception) { e.printStackTrace() }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Phone,
                                    contentDescription = "Call",
                                    tint = Color.White,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("CALL", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White)
                            }
                        }
                    }

                    // Line 3: Financial Summary & Actions Box (Transaction Page Style)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(theme.colors.backgroundSecondary.copy(alpha = 0.4f))
                            .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("PAID IN TX", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                Text("₹${b.advancePaid.toInt()}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                            }
                            Column {
                                Text("TOTAL", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                Text("₹${b.amount.toInt()}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            }
                            Column {
                                Text("PENDING", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                Text(
                                    "₹${pendingAmount.toInt()}",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (pendingAmount <= 0) Color(0xFF10B981) else Color(0xFFEF4444)
                                )
                            }
                        }

                        if (b.status == BookingStatus.APPROVED || b.status == BookingStatus.BOOKED) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                IconButton(
                                    onClick = { onStatusUpdate(b.id, BookingStatus.CONFIRMED) },
                                    modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(theme.colors.accent)
                                ) {
                                    if (isActionLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                                    else Icon(Icons.Default.CheckCircle, null, tint = Color.White, modifier = Modifier.size(18.dp))
                                }
                                IconButton(
                                    onClick = { onStatusUpdate(b.id, BookingStatus.DECLINED) },
                                    modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(theme.colors.error)
                                ) {
                                    if (isActionLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                                    else Icon(Icons.Default.Cancel, null, tint = Color.White, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LocationsTab(
    locations: List<Location>, role: String?, isProcessing: Boolean, theme: com.boxitt.app.theme.AppTheme,
    onDelete: (String) -> Unit, onUpdate: (String, Map<String, Any?>, List<Map<String, Any?>>?) -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    dbVersion: Int
) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        items(locations) { loc ->
            LocationAdminCard(loc = loc, role = role, isProcessing = isProcessing, theme = theme, onDelete = onDelete, onUpdate = onUpdate, onAlert = onAlert, dbVersion = dbVersion)
        }
    }
}

@Composable
private fun LocationAdminCard(
    loc: Location, role: String?, isProcessing: Boolean, theme: com.boxitt.app.theme.AppTheme,
    onDelete: (String) -> Unit, onUpdate: (String, Map<String, Any?>, List<Map<String, Any?>>?) -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    dbVersion: Int
) {
    // DRAFT STATE: Local edits
    var draft by remember(loc.id, dbVersion) { mutableStateOf(loc) }
    // Baseline state: Matches what is officially in the DB (resets on dbVersion change)
    var persistedLoc by remember(loc.id, dbVersion) { mutableStateOf(loc) }
    
    var selectedCourtIdx by remember { mutableStateOf(0) }
    var isSaving by remember { mutableStateOf(false) }
    var isVerifying by remember { mutableStateOf(false) }
    var isLocating by remember { mutableStateOf(false) }
    
    // Gallery view and delete mode states
    var isDeleteMode by remember { mutableStateOf(false) }
    var viewerConfig by remember { mutableStateOf(Triple(false, emptyList<String>(), 0)) } // Triple(isOpen, images, index)
    
    // NEW: Track files to upload (binaries) and previews
    var pendingGlobalFiles by remember(loc.id, dbVersion) { mutableStateOf<List<Uri>>(emptyList()) }
    var pendingCourtFiles by remember(loc.id, dbVersion) { mutableStateOf<Map<Int, List<Uri>>>(emptyMap()) }
    var pendingDeletions by remember(loc.id, dbVersion) { mutableStateOf<List<String>>(emptyList()) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val globalPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        pendingGlobalFiles = (pendingGlobalFiles + uris).distinct()
    }
    val courtPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        val current = pendingCourtFiles[selectedCourtIdx] ?: emptyList()
        pendingCourtFiles = pendingCourtFiles + (selectedCourtIdx to (current + uris).distinct())
    }
    
    val currentCourt = remember(draft, selectedCourtIdx) {
        draft.courts?.find { it.courtNumber == selectedCourtIdx + 1 }
    }

    val hasChanges = remember(draft, persistedLoc, pendingGlobalFiles, pendingCourtFiles) {
        draft.name != persistedLoc.name ||
        draft.email != persistedLoc.email ||
        draft.latitude != persistedLoc.latitude ||
        draft.longitude != persistedLoc.longitude ||
        draft.numberOfCourts != persistedLoc.numberOfCourts ||
        draft.is_open != persistedLoc.is_open ||
        draft.image_urls != persistedLoc.image_urls ||
        draft.courts?.map { listOf(it.courtNumber, it.image_urls, it.description) } != persistedLoc.courts?.map { listOf(it.courtNumber, it.image_urls, it.description) } ||
        (persistedLoc.courts?.size ?: 0) < draft.numberOfCourts ||
        pendingGlobalFiles.isNotEmpty() ||
        pendingCourtFiles.values.any { it.isNotEmpty() }
    }

    fun handleSave() {
        if (!hasChanges) {
            onAlert?.invoke("The database is up to date!", "info", null)
            return
        }
        
        isSaving = true
        scope.launch {
            try {
                val arenaFolder = "${draft.name.replace(Regex("[^a-zA-Z0-9]"), "_")}_${draft.id.take(8)}"
                
                // 1. Upload Global Binaries
                val newGlobalUrls = pendingGlobalFiles.map { uri ->
                    val stream = context.contentResolver.openInputStream(uri)!!
                    val fileName = "$arenaFolder/Arena_Global/${System.currentTimeMillis()}-${uri.lastPathSegment}"
                    SupabaseStorageService.uploadFile("arenas", fileName, stream, "image/jpeg")
                }

                // 2. Upload Court Binaries & Prepare Updates
                val finalImageUrls = (draft.imageUrls + newGlobalUrls).distinct()
                val courtUpdates = draft.courts?.mapIndexed { idx, court ->
                    val courtFiles = pendingCourtFiles[idx] ?: emptyList()
                    val newCourtUrls = courtFiles.map { uri ->
                        val stream = context.contentResolver.openInputStream(uri)!!
                        val cFolder = court.name?.replace(Regex("[^a-zA-Z0-9]"), "_") ?: "Court_${court.courtNumber}"
                        val fileName = "$arenaFolder/$cFolder/${System.currentTimeMillis()}-${uri.lastPathSegment}"
                        SupabaseStorageService.uploadFile("courts", fileName, stream, "image/jpeg")
                    }
                    
                    mapOf(
                        "id" to court.id,
                        "courtNumber" to court.courtNumber,
                        "image_urls" to ((court.image_urls ?: emptyList()) + newCourtUrls).distinct(),
                        "description" to (court.description ?: "")
                    )
                }
                
                val updates = mapOf(
                    "name" to draft.name,
                    "email" to draft.email,
                    "latitude" to draft.latitude,
                    "longitude" to draft.longitude,
                    "number_of_courts" to draft.numberOfCourts,
                    "is_open" to draft.is_open,
                    "image_urls" to finalImageUrls
                )
                
                onUpdate(loc.id, updates, courtUpdates)

                // 3. Cleanup deletions
                pendingDeletions.forEach { url ->
                    try {
                        val isCourt = url.contains("/courts/")
                        val bucket = if (isCourt) "courts" else "arenas"
                        val path = url.split("/$bucket/").getOrNull(1)
                        if (path != null) SupabaseStorageService.deleteFile(bucket, path)
                    } catch (e: Exception) { e.printStackTrace() }
                }
                
                onAlert?.invoke("All arena and court changes saved successfully!", "success", null)
            } catch (e: Exception) {
                onAlert?.invoke(e.message ?: "Save failed", "error", null)
            } finally {
                isSaving = false
            }
        }
    }

    fun handleRemoveImagePreview(idx: Int, isPending: Boolean, courtIdx: Int?) {
        if (isPending) {
            if (courtIdx != null) {
                val current = pendingCourtFiles[courtIdx] ?: emptyList()
                pendingCourtFiles = pendingCourtFiles + (courtIdx to current.filterIndexed { i, _ -> i != idx })
            } else {
                pendingGlobalFiles = pendingGlobalFiles.filterIndexed { i, _ -> i != idx }
            }
        } else {
            var urlToDelete = ""
            if (courtIdx != null) {
                val court = draft.courts?.find { it.courtNumber == (courtIdx + 1) }
                urlToDelete = court?.image_urls?.getOrNull(idx) ?: ""
                draft = draft.copy(
                    courts = draft.courts?.map { 
                        if (it.courtNumber == (courtIdx + 1)) it.copy(image_urls = it.image_urls?.filterIndexed { i, _ -> i != idx })
                        else it
                    }
                )
            } else {
                urlToDelete = draft.image_urls?.getOrNull(idx) ?: ""
                draft = draft.copy(image_urls = draft.image_urls?.filterIndexed { i, _ -> i != idx })
            }
            if (urlToDelete.isNotEmpty()) {
                pendingDeletions = pendingDeletions + urlToDelete
            }
        }
    }

    fun handleGetCurrentLocation() {
        if (!PermissionsManager.checkAndPrompt(context, PermissionType.LOCATION)) return
        isLocating = true
        val fusedLocationClient = com.google.android.gms.location.LocationServices.getFusedLocationProviderClient(context)
        try {
            fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                if (location != null) {
                    draft = draft.copy(latitude = location.latitude, longitude = location.longitude)
                    onAlert?.invoke("Current location fetched successfully!", "success", null)
                } else {
                    onAlert?.invoke("Unable to retrieve location. Please ensure GPS is enabled.", "error", null)
                }
                isLocating = false
            }.addOnFailureListener {
                isLocating = false
                onAlert?.invoke("Failed to fetch location", "error", null)
            }
        } catch (e: SecurityException) { 
            e.printStackTrace()
            isLocating = false
        }
    }

    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            // Court Management
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("COURT MANAGEMENT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.background(theme.colors.backgroundSecondary, RoundedCornerShape(12.dp)).padding(4.dp)) {
                    IconButton(onClick = { if (draft.numberOfCourts > 1) draft = draft.copy(number_of_courts = draft.numberOfCourts - 1) }, modifier = Modifier.size(32.dp).background(theme.colors.card, RoundedCornerShape(8.dp))) {
                        Icon(Icons.Default.Remove, null, tint = theme.colors.textPrimary, modifier = Modifier.size(16.dp))
                    }
                    Text("${draft.numberOfCourts} COURTS", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                    IconButton(onClick = { 
                        if (draft.numberOfCourts < 10) {
                            val newCount = draft.numberOfCourts + 1
                            val newCourts = (draft.courts ?: emptyList()).toMutableList()
                            
                            // Ensure Court 1 exists if empty
                            if (newCourts.isEmpty() && newCount > 0) {
                                newCourts.add(Court(id = "temp-${loc.id}-1", locationId = loc.id, courtNumber = 1, image_urls = emptyList()))
                            }

                            if (newCourts.none { it.courtNumber == newCount }) {
                                newCourts.add(Court(id = "temp-${loc.id}-$newCount", locationId = loc.id, courtNumber = newCount, image_urls = emptyList()))
                            }
                            draft = draft.copy(number_of_courts = newCount, courts = newCourts)
                        }
                    }, modifier = Modifier.size(32.dp).background(theme.colors.card, RoundedCornerShape(8.dp))) {
                        Icon(Icons.Default.Add, null, tint = theme.colors.textPrimary, modifier = Modifier.size(16.dp))
                    }
                }
            }

            // Court Selector
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(draft.numberOfCourts) { idx ->
                    val selected = selectedCourtIdx == idx
                    val court = draft.courts?.find { it.courtNumber == idx + 1 }
                    Box(
                        modifier = Modifier.clip(RoundedCornerShape(10.dp))
                            .background(if (selected) theme.colors.accent else theme.colors.backgroundSecondary)
                            .clickable { selectedCourtIdx = idx }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(court?.name ?: "Court ${idx + 1}", fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (selected) Color.White else theme.colors.textDisabled)
                    }
                }
            }

            // Global Gallery
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("ARENA GLOBAL GALLERY", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isDeleteMode) theme.colors.error else theme.colors.backgroundSecondary)
                        .border(1.dp, if (isDeleteMode) theme.colors.error else theme.colors.border, RoundedCornerShape(8.dp))
                        .clickable { isDeleteMode = !isDeleteMode }
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(if (isDeleteMode) Icons.Default.Delete else Icons.Default.Settings, null, tint = if (isDeleteMode) Color.White else theme.colors.textSecondary, modifier = Modifier.size(12.dp))
                        Text(if (isDeleteMode) "DELETE MODE" else "VIEW MODE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (isDeleteMode) Color.White else theme.colors.textSecondary)
                    }
                }
            }
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // Existing
                draft.imageUrls.forEachIndexed { idx, url ->
                    Box(modifier = Modifier.size(80.dp).clip(RoundedCornerShape(12.dp)).clickable {
                        if (isDeleteMode) handleRemoveImagePreview(idx, false, null)
                        else viewerConfig = Triple(true, draft.imageUrls, idx)
                    }) {
                        AsyncImage(model = url, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        if (isDeleteMode) {
                            Box(modifier = Modifier.fillMaxSize().background(Color.Red.copy(0.6f)), contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.Delete, null, tint = Color.White, modifier = Modifier.size(20.dp))
                            }
                        } else {
                            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.2f)), contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.Visibility, null, tint = Color.White.copy(alpha = 0.5f), modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
                // Pending
                pendingGlobalFiles.forEachIndexed { idx, uri ->
                    Box(modifier = Modifier.size(80.dp).clip(RoundedCornerShape(12.dp)).border(2.dp, theme.colors.accent, RoundedCornerShape(12.dp))) {
                        AsyncImage(model = uri, contentDescription = null, modifier = Modifier.fillMaxSize().alpha(0.6f), contentScale = ContentScale.Crop)
                        IconButton(onClick = { handleRemoveImagePreview(idx, true, null) }, modifier = Modifier.align(Alignment.TopEnd).size(24.dp).background(Color.Red, CircleShape)) {
                            Icon(Icons.Default.Close, null, tint = Color.White, modifier = Modifier.size(14.dp))
                        }
                        Icon(Icons.Default.Save, null, tint = Color.White, modifier = Modifier.align(Alignment.Center).size(24.dp))
                    }
                }
                Box(modifier = Modifier.size(80.dp).clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary).border(2.dp, theme.colors.border, RoundedCornerShape(12.dp)).clickable { globalPicker.launch("image/*") }, contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Add, null, tint = theme.colors.accent, modifier = Modifier.size(24.dp))
                        Text("ADD PHOTO", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                    }
                }
            }

            // Court Gallery
            if (currentCourt != null) {
                Text("${currentCourt.name ?: "COURT ${currentCourt.courtNumber}"} GALLERY", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Existing
                    currentCourt.imageUrls.forEachIndexed { idx, url ->
                        Box(modifier = Modifier.size(80.dp).clip(RoundedCornerShape(12.dp)).clickable {
                            if (isDeleteMode) handleRemoveImagePreview(idx, false, selectedCourtIdx)
                            else viewerConfig = Triple(true, currentCourt.imageUrls, idx)
                        }) {
                            AsyncImage(model = url, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                            if (isDeleteMode) {
                                Box(modifier = Modifier.fillMaxSize().background(Color.Red.copy(0.6f)), contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.Delete, null, tint = Color.White, modifier = Modifier.size(20.dp))
                                }
                            } else {
                                Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.2f)), contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.Visibility, null, tint = Color.White.copy(alpha = 0.5f), modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                    // Pending
                    (pendingCourtFiles[selectedCourtIdx] ?: emptyList()).forEachIndexed { idx, uri ->
                        Box(modifier = Modifier.size(80.dp).clip(RoundedCornerShape(12.dp)).border(2.dp, theme.colors.accent, RoundedCornerShape(12.dp))) {
                            AsyncImage(model = uri, contentDescription = null, modifier = Modifier.fillMaxSize().alpha(0.6f), contentScale = ContentScale.Crop)
                            IconButton(onClick = { handleRemoveImagePreview(idx, true, selectedCourtIdx) }, modifier = Modifier.align(Alignment.TopEnd).size(24.dp).background(Color.Red, CircleShape)) {
                                Icon(Icons.Default.Close, null, tint = Color.White, modifier = Modifier.size(14.dp))
                            }
                            Icon(Icons.Default.Save, null, tint = Color.White, modifier = Modifier.align(Alignment.Center).size(24.dp))
                        }
                    }
                    Box(modifier = Modifier.size(80.dp).clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary).border(2.dp, theme.colors.border, RoundedCornerShape(12.dp)).clickable { courtPicker.launch("image/*") }, contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.Add, null, tint = theme.colors.accent, modifier = Modifier.size(24.dp))
                            Text("ADD PHOTO", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                        }
                    }
                }
            }

            // Action buttons
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (draft.latitude != null && draft.longitude != null) {
                    Button(onClick = {
                        val uri = Uri.parse("https://www.google.com/maps?q=${draft.latitude},${draft.longitude}")
                        context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, uri))
                    }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A73E8)), shape = RoundedCornerShape(12.dp), modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.Navigation, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("DIRECTIONS", fontSize = 10.sp, fontWeight = FontWeight.Black)
                    }
                }

                Button(
                    onClick = { draft = draft.copy(is_open = !draft.isOpen) },
                    colors = ButtonDefaults.buttonColors(containerColor = (if (draft.isOpen) theme.colors.success else theme.colors.error).copy(alpha = 0.15f), contentColor = if (draft.isOpen) theme.colors.success else theme.colors.error),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, if (draft.isOpen) theme.colors.success else theme.colors.error),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(imageVector = if (draft.isOpen) Icons.Default.CheckCircle else Icons.Default.Cancel, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if (draft.isOpen) "ARENA OPEN" else "ARENA CLOSED", fontSize = 10.sp, fontWeight = FontWeight.Black)
                }
            }

            // Fields
            Column {
                Text("ARENA NAME", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Spacer(Modifier.height(4.dp))
                OutlinedTextField(value = draft.name, onValueChange = { draft = draft.copy(name = it) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
            }
            Column {
                Text("EMAIL", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Spacer(Modifier.height(4.dp))
                OutlinedTextField(value = draft.email, onValueChange = { draft = draft.copy(email = it) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
            }

            Column {
                Text("FULL ADDRESS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Spacer(Modifier.height(4.dp))
                OutlinedTextField(
                    value = draft.address,
                    onValueChange = { draft = draft.copy(address = it) },
                    placeholder = { Text("Arena Physical Address", color = theme.colors.textDisabled) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    trailingIcon = {
                        IconButton(
                            onClick = {
                                if (draft.address.isBlank() || isVerifying) return@IconButton
                                isVerifying = true
                                scope.launch {
                                    try {
                                        val coords = GeocodingService.getCoordinates(draft.address, "")
                                        if (coords != null) {
                                            draft = draft.copy(latitude = coords.latitude, longitude = coords.longitude)
                                            val result = GeocodingService.reverseGeocode(coords.latitude, coords.longitude)
                                            if (result != null) {
                                                draft = draft.copy(address = result.first)
                                            }
                                            onAlert?.invoke("Location verified and updated!", "success", null)
                                        } else {
                                            onAlert?.invoke("No matching location found.", "error", null)
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                        onAlert?.invoke("Search failed. Please try again.", "error", null)
                                    } finally {
                                        isVerifying = false
                                    }
                                }
                            },
                            enabled = !isVerifying && !isSaving
                        ) {
                            if (isVerifying) {
                                CircularProgressIndicator(color = theme.colors.accent, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.Search, null, tint = theme.colors.accent)
                            }
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary)
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("FETCH GPS COORDINATES", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                IconButton(onClick = { handleGetCurrentLocation() }, modifier = Modifier.size(36.dp).clip(CircleShape).background(Color(0xFF1A73E8)), enabled = !isLocating) {
                    if (isLocating) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Default.MyLocation, null, tint = Color.White, modifier = Modifier.size(18.dp))
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("LATITUDE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                    Spacer(Modifier.height(4.dp))
                    OutlinedTextField(value = draft.latitude?.toString() ?: "", onValueChange = { draft = draft.copy(latitude = it.toDoubleOrNull()) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text("LONGITUDE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                    Spacer(Modifier.height(4.dp))
                    OutlinedTextField(value = draft.longitude?.toString() ?: "", onValueChange = { draft = draft.copy(longitude = it.toDoubleOrNull()) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                }
            }

            // Save Button
            LoadingButton(
                onClick = { handleSave() },
                loading = isSaving,
                text = if (hasChanges) "SAVE ARENA CHANGES" else "DATABASE IS UP TO DATE",
                backgroundColor = theme.colors.accent,
                modifier = Modifier.fillMaxWidth().height(54.dp),
                enabled = !isSaving
            )

            if (role == "superadmin") {
                OutlinedButton(onClick = { onDelete(loc.id) }, colors = ButtonDefaults.outlinedButtonColors(contentColor = theme.colors.error), border = BorderStroke(1.dp, theme.colors.error.copy(0.3f)), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) { Text("REMOVE ARENA", fontSize = 10.sp, fontWeight = FontWeight.Black) }
            }
        }
    }

    ImageViewer(
        images = viewerConfig.second,
        initialIndex = viewerConfig.third,
        isOpen = viewerConfig.first,
        onClose = { viewerConfig = viewerConfig.copy(first = false) }
    )
}

@Composable
private fun ReportsTab(
    reportStats: Triple<Double, Double, Int>,
    location: Location,
    theme: com.boxitt.app.theme.AppTheme
) {
    val (totalRevenue, moneyCollected, bookingCount) = reportStats
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                listOf(
                    Triple("TOTAL REVENUE", "₹${String.format("%.0f", totalRevenue)}", theme.colors.success),
                    Triple("ADVANCE COLLECTED", "₹${String.format("%.0f", moneyCollected)}", theme.colors.accent),
                    Triple("TOTAL BOOKINGS", "$bookingCount", Color(0xFFA855F7))
                ).forEach { (label, value, color) ->
                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(20.dp)) {
                        Column {
                            Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(4.dp))
                            Text(value, fontSize = 28.sp, fontWeight = FontWeight.Black, color = color)
                        }
                    }
                }
            }
        }

        item {
            Text("COURT BREAKDOWN", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, modifier = Modifier.padding(horizontal = 4.dp))
        }

        items(location.courts ?: emptyList()) { court ->
            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(16.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(court.name ?: "Court ${court.courtNumber}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                    Divider(color = theme.colors.border, thickness = 0.5.dp)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column {
                            Text("REVENUE", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                            Text("₹-", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.success) // Note: breakdown needs bookings filtering by courtId
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("ADVANCE", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                            Text("₹-", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("BOOKINGS", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                            Text("-", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color(0xFFA855F7))
                        }
                    }
                    Text("Detail breakdown coming in next update", fontSize = 8.sp, color = theme.colors.textDisabled)
                }
            }
        }
    }
}

@Composable
private fun SecurityTab(
    currentPwd: String, newUsername: String, newPassword: String, confirmPwd: String, loading: Boolean,
    theme: com.boxitt.app.theme.AppTheme,
    onCurrentPwdChange: (String) -> Unit, onNewUsernameChange: (String) -> Unit, onNewPwdChange: (String) -> Unit, onConfirmPwdChange: (String) -> Unit, onSubmit: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Box(modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)).background(theme.colors.accent).align(Alignment.CenterHorizontally), contentAlignment = Alignment.Center) { Icon(Icons.Default.Lock, null, tint = Color.White, modifier = Modifier.size(32.dp)) }
        Text("LOGIN SETTINGS", fontSize = 24.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, modifier = Modifier.align(Alignment.CenterHorizontally))
        Text("UPDATE ACCESS CREDENTIALS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(Modifier.height(8.dp))
        listOf("Current Password" to Pair(currentPwd, onCurrentPwdChange), "New Username" to Pair(newUsername, onNewUsernameChange), "New Password" to Pair(newPassword, onNewPwdChange), "Confirm New Password" to Pair(confirmPwd, onConfirmPwdChange)).forEach { (label, pair) ->
            OutlinedTextField(value = pair.first, onValueChange = pair.second, placeholder = { Text(label, color = theme.colors.textDisabled) }, visualTransformation = if (label.contains("Password")) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
        }
        Button(onClick = onSubmit, enabled = !loading, modifier = Modifier.fillMaxWidth().height(54.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary), shape = RoundedCornerShape(16.dp)) {
            if (loading) CircularProgressIndicator(color = theme.colors.background, modifier = Modifier.size(22.dp)) else { Icon(Icons.Default.ShieldMoon, null, tint = theme.colors.background); Spacer(Modifier.width(8.dp)); Text("SAVE SETTINGS", fontSize = 13.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 1.sp) }
        }
    }
}

@Composable
private fun TimingTab(
    openHour: String, closeHour: String, morningStart: String, morningEnd: String, nightStart: String, nightEnd: String,
    isLoading: Boolean, theme: com.boxitt.app.theme.AppTheme,
    onChange: (String, String) -> Unit, onSave: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Box(modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)).background(theme.colors.accent).align(Alignment.CenterHorizontally), contentAlignment = Alignment.Center) { Icon(Icons.Default.AccessTime, null, tint = Color.White, modifier = Modifier.size(32.dp)) }
        Text("ARENA TIMING", fontSize = 24.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, modifier = Modifier.align(Alignment.CenterHorizontally))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            listOf("MORNING START" to Pair(morningStart) { v: String -> onChange("morningStart", v) }, "MORNING END" to Pair(morningEnd) { v: String -> onChange("morningEnd", v) }).forEach { (label, pair) ->
                Column(modifier = Modifier.weight(1f)) {
                    Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                    Spacer(Modifier.height(4.dp))
                    OutlinedTextField(value = pair.first, onValueChange = pair.second, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            listOf("NIGHT START" to Pair(nightStart) { v: String -> onChange("nightStart", v) }, "NIGHT END" to Pair(nightEnd) { v: String -> onChange("nightEnd", v) }).forEach { (label, pair) ->
                Column(modifier = Modifier.weight(1f)) {
                    Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                    Spacer(Modifier.height(4.dp))
                    OutlinedTextField(value = pair.first, onValueChange = pair.second, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                }
            }
        }
        Column { Text("OVERALL OPENING HOUR", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp); Spacer(Modifier.height(4.dp)); OutlinedTextField(value = openHour, onValueChange = { onChange("openHour", it) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary)) }
        Column { Text("OVERALL CLOSING HOUR", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp); Spacer(Modifier.height(4.dp)); OutlinedTextField(value = closeHour, onValueChange = { onChange("closeHour", it) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary)) }
        LoadingButton(
            onClick = onSave,
            loading = isLoading,
            text = "SAVE TIMING",
            loadingText = "Saving...",
            backgroundColor = theme.colors.textPrimary,
            contentColor = theme.colors.background
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PricingTab(
    pricing: List<Pricing>, selectedCourtId: String?, newDuration: String, newPrice: String, newAdvancePrice: String,
    newCategory: String, newRuleType: String, newDayOfWeek: Int, newSpecificDate: String,
    isLoading: Boolean, showDatePicker: Boolean, theme: com.boxitt.app.theme.AppTheme,
    onDurationChange: (String) -> Unit, onPriceChange: (String) -> Unit, onAdvancePriceChange: (String) -> Unit,
    onCategoryChange: (String) -> Unit, onRuleTypeChange: (String) -> Unit, onDayOfWeekChange: (Int) -> Unit, onSpecificDateChange: (String) -> Unit,
    onShowDatePicker: (Boolean) -> Unit, onAddPrice: () -> Unit, onDeletePrice: (String) -> Unit,
    copyDropdown: @Composable () -> Unit
) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Filter controls
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("PRICING RULES", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                
                // Session Filter
                Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("morning", "night").forEach { cat ->
                        Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(if (newCategory == cat) theme.colors.accent else Color.Transparent).clickable { onCategoryChange(cat) }.padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                            Text(cat.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (newCategory == cat) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                        }
                    }
                }
                
                // Rule Type Filter
                Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("default" to "Daily", "day" to "Day", "date" to "Date").forEach { (type, label) ->
                        Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(if (newRuleType == type) theme.colors.accent else Color.Transparent).clickable { onRuleTypeChange(type) }.padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                            Text(label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (newRuleType == type) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                        }
                    }
                }

                if (newRuleType == "day") {
                    Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat").forEachIndexed { index, day ->
                            Box(modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(if (newDayOfWeek == index) theme.colors.accent else theme.colors.backgroundSecondary).clickable { onDayOfWeekChange(index) }.padding(horizontal = 12.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
                                Text(day.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (newDayOfWeek == index) Color.White else theme.colors.textDisabled)
                            }
                        }
                    }
                }

                if (newRuleType == "date") {
                    Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary).clickable { onShowDatePicker(true) }.padding(12.dp)) {
                        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(newSpecificDate, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                            Icon(Icons.Default.CalendarToday, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }

        // Existing rules
        val filtered = pricing.filter { p ->
            p.court_id == selectedCourtId &&
            p.category == newCategory && p.rule_type == newRuleType &&
            (if (newRuleType == "day") p.day_of_week == newDayOfWeek else true) &&
            (if (newRuleType == "date") p.specific_date == newSpecificDate else true)
        }.sortedBy { it.duration_hours }

        items(filtered) { p ->
            Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(16.dp)).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(theme.colors.accent.copy(0.15f)), contentAlignment = Alignment.Center) {
                    Text("${p.duration_hours}h", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("₹${p.price.toInt()}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(theme.colors.accent.copy(0.1f)).padding(horizontal = 6.dp, vertical = 2.dp)) { Text(p.category ?: "morning", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp) }
                        Box(modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(theme.colors.accent.copy(0.1f)).padding(horizontal = 6.dp, vertical = 2.dp)) {
                            Text(when (p.rule_type) { "default" -> "Daily"; "day" -> listOf("Sun","Mon","Tue","Wed","Thu","Fri","Sat").getOrNull(p.day_of_week ?: 0) ?: ""; else -> p.specific_date ?: "" }, fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                        }
                        Text("(Adv: ₹${p.advance_price?.toInt() ?: 0})", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                    }
                }
                IconButton(onClick = { p.id?.let { onDeletePrice(it) } }) { Icon(Icons.Default.Delete, null, tint = theme.colors.error) }
            }
        }

        if (filtered.isEmpty()) {
            item { 
                Box(modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) { 
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("NO PRICING RULES SET FOR THIS COURT", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                    }
                } 
            }
        }

        // Add rule form
        item {
            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp)).padding(20.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("ADD RULE", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                    OutlinedTextField(value = newDuration, onValueChange = onDurationChange, placeholder = { Text("Duration (Hours) e.g. 1.5", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = newPrice, onValueChange = onPriceChange, placeholder = { Text("Total Price (₹)", color = theme.colors.textDisabled) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                        OutlinedTextField(value = newAdvancePrice, onValueChange = onAdvancePriceChange, placeholder = { Text("Advance (₹)", color = theme.colors.textDisabled) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                    }
                    // Add Rule Type Selector for Adding
                    Column {
                        Text("RULE TYPE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        Spacer(Modifier.height(6.dp))
                        Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("default" to "Daily", "day" to "Day", "date" to "Date").forEach { (type, label) ->
                                Box(modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(if (newRuleType == type) theme.colors.accent else Color.Transparent).clickable { onRuleTypeChange(type) }.padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                                    Text(label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (newRuleType == type) Color.White else theme.colors.textDisabled, letterSpacing = 1.sp)
                                }
                            }
                        }
                    }

                    if (newRuleType == "day") {
                        Column {
                            Text("SELECT DAY", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(6.dp))
                            Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat").forEachIndexed { index, day ->
                                    Box(modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(if (newDayOfWeek == index) theme.colors.accent else theme.colors.backgroundSecondary).clickable { onDayOfWeekChange(index) }.padding(horizontal = 12.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
                                        Text(day.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (newDayOfWeek == index) Color.White else theme.colors.textDisabled)
                                    }
                                }
                            }
                        }
                    }

                    if (newRuleType == "date") {
                        Column {
                            Text("SELECT DATE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(6.dp))
                            Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary).clickable { onShowDatePicker(true) }.padding(12.dp)) {
                                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    Text(newSpecificDate, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                                    Icon(Icons.Default.CalendarToday, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }

                    LoadingButton(
                        onClick = onAddPrice,
                        loading = isLoading,
                        text = "SAVE RULE",
                        loadingText = "Saving...",
                        backgroundColor = theme.colors.accent,
                        icon = { Icon(Icons.Default.Add, null, tint = Color.White) }
                    )
                }
            }
        }
    }

    DatePickerModal(isOpen = showDatePicker, onClose = { onShowDatePicker(false) }, selectedDate = newSpecificDate, onSelect = { onSpecificDateChange(it) })
}

@Composable
private fun AboutTab(
    description: String, contact: String, rating: Double, advanceRequired: Boolean, isLoading: Boolean,
    theme: com.boxitt.app.theme.AppTheme,
    onDescriptionChange: (String) -> Unit, onContactChange: (String) -> Unit, onAdvanceChange: (Boolean) -> Unit, onSave: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Box(modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)).background(theme.colors.accent).align(Alignment.CenterHorizontally), contentAlignment = Alignment.Center) { Icon(Icons.Default.Info, null, tint = Color.White, modifier = Modifier.size(32.dp)) }
        Text("ARENA DETAILS", fontSize = 24.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, modifier = Modifier.align(Alignment.CenterHorizontally))
        Text("ABOUT SECTION CONTENT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
        
        Column {
            Text("DESCRIPTION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(value = description, onValueChange = onDescriptionChange, placeholder = { Text("Tell players about your arena...", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(modifier = Modifier.weight(1f)) {
                Text("CONTACT INFO", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = contact, 
                    onValueChange = { onContactChange(it.filter { c -> c.isDigit() }.take(10)) }, 
                    leadingIcon = { Icon(Icons.Default.Phone, null, tint = theme.colors.textDisabled.copy(0.4f)) }, 
                    placeholder = { Text("Phone number", color = theme.colors.textDisabled) }, 
                    modifier = Modifier.fillMaxWidth(), 
                    shape = RoundedCornerShape(12.dp), 
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary)
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text("CURRENT RATING (AUTOMATED)", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                Spacer(Modifier.height(6.dp))
                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary).padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Star, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                        Text(String.format("%.1f", rating), fontSize = 16.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                    }
                }
                Text("Calculated from user reviews", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp, modifier = Modifier.padding(top = 4.dp, start = 4.dp))
            }
        }

        // Advance booking toggle
        Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(14.dp)).padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.ShieldMoon, null, tint = theme.colors.accent, modifier = Modifier.size(18.dp))
                Text("ADVANCE BOOKING REQUIRED", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, letterSpacing = 1.sp)
            }
            Switch(checked = advanceRequired, onCheckedChange = onAdvanceChange, colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = theme.colors.accent))
        }

        Button(onClick = onSave, enabled = !isLoading, modifier = Modifier.fillMaxWidth().height(54.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary), shape = RoundedCornerShape(16.dp)) {
            if (isLoading) CircularProgressIndicator(color = theme.colors.background, modifier = Modifier.size(22.dp)) else Text("SAVE ARENA DETAILS", fontSize = 13.sp, fontWeight = FontWeight.Black, color = theme.colors.background, letterSpacing = 1.sp)
        }
    }
}

@Composable
fun ScheduleTabContent(
    locationId: String,
    theme: com.boxitt.app.theme.AppTheme,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onConfirm: ((String, () -> Unit, (() -> Unit)?, String?, String?, Boolean?) -> Unit)? = null
) {
    val scope = rememberCoroutineScope()
    var schedules by remember { mutableStateOf<List<com.boxitt.app.services.DaySchedule>>(emptyList()) }
    var calendarDate by remember { mutableStateOf(java.util.Calendar.getInstance()) }
    var loading by remember { mutableStateOf(false) }
    var isSaving by remember { mutableStateOf(false) }

    var selectedClosedDate by remember { mutableStateOf<String?>(null) }
    var selectedClosedRange by remember { mutableStateOf<List<String>>(emptyList()) }
    var rangeStart by remember { mutableStateOf<String?>(null) }
    var closedOption by remember { mutableStateOf("one_time") }
    var closureType by remember { mutableStateOf("full") }
    var closedStartTime by remember { mutableStateOf("00:00") }
    var closedEndTime by remember { mutableStateOf("23:59") }
    var closedNote by remember { mutableStateOf("") }

    val year = calendarDate.get(java.util.Calendar.YEAR)
    val month = calendarDate.get(java.util.Calendar.MONTH)

    fun fetchSchedules() {
        if (locationId.isBlank()) return
        scope.launch {
            loading = true
            try {
                schedules = com.boxitt.app.services.ScheduleService.getSchedules(locationId)
            } catch (e: Exception) {
                onAlert?.invoke("Failed to load schedule", "error", null)
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(locationId, month, year) {
        fetchSchedules()
    }

    fun getDatesInRange(d1Str: String, d2Str: String): List<String> {
        val dates = mutableListOf<String>()
        val start = if (d1Str < d2Str) d1Str else d2Str
        val end = if (d1Str < d2Str) d2Str else d1Str

        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        try {
            val startDate = sdf.parse(start) ?: return dates
            val endDate = sdf.parse(end) ?: return dates

            val cal = java.util.Calendar.getInstance()
            cal.time = startDate

            while (!cal.time.after(endDate)) {
                dates.add(sdf.format(cal.time))
                cal.add(java.util.Calendar.DAY_OF_MONTH, 1)
            }
        } catch (e: Exception) {
            // Ignore parse exception
        }
        return dates
    }

    fun handleDateClick(day: Int) {
        val dateStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", year, month + 1, day)

        if (rangeStart != null && rangeStart != dateStr) {
            val rangeDates = getDatesInRange(rangeStart!!, dateStr)
            val todayCal = java.util.Calendar.getInstance()
            val todayStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", todayCal.get(java.util.Calendar.YEAR), todayCal.get(java.util.Calendar.MONTH) + 1, todayCal.get(java.util.Calendar.DAY_OF_MONTH))
            val validRangeDates = rangeDates.filter { it >= todayStr }

            val startSched = schedules.find { it.date == rangeStart }
            val targetStatus = startSched?.status ?: "green"

            val newList = schedules.toMutableList()

            validRangeDates.forEach { rDate ->
                if (targetStatus == "green") {
                    val idx = newList.indexOfFirst { it.date == rDate }
                    val item = com.boxitt.app.services.DaySchedule(location_id = locationId, date = rDate, status = "green")
                    if (idx >= 0) newList[idx] = item else newList.add(item)
                } else if (targetStatus == "red") {
                    val item = com.boxitt.app.services.DaySchedule(
                        location_id = locationId,
                        date = rDate,
                        status = "red",
                        closed_option = startSched?.closed_option ?: "one_time",
                        closure_type = startSched?.closure_type ?: "full",
                        start_time = startSched?.start_time ?: "00:00",
                        end_time = startSched?.end_time ?: "23:59",
                        note = startSched?.note ?: ""
                    )
                    val idx = newList.indexOfFirst { it.date == rDate }
                    if (idx >= 0) newList[idx] = item else newList.add(item)
                } else {
                    newList.removeAll { it.date == rDate }
                }
            }

            schedules = newList
            if (targetStatus == "red") {
                selectedClosedRange = validRangeDates
                selectedClosedDate = validRangeDates.firstOrNull() ?: dateStr
                closedOption = startSched?.closed_option ?: "one_time"
                closureType = startSched?.closure_type ?: "full"
                closedStartTime = startSched?.start_time ?: "00:00"
                closedEndTime = startSched?.end_time ?: "23:59"
                closedNote = startSched?.note ?: ""
            } else {
                selectedClosedDate = null
                selectedClosedRange = emptyList()
            }
            rangeStart = null
            return
        }

        val existing = schedules.find { it.date == dateStr }
        val nextStatus = when (existing?.status) {
            "green" -> "red"
            "red" -> "normal"
            else -> "green"
        }

        val newList = schedules.toMutableList()
        if (nextStatus == "normal") {
            newList.removeAll { it.date == dateStr }
            selectedClosedDate = null
            selectedClosedRange = emptyList()
            rangeStart = null
        } else if (nextStatus == "green") {
            val idx = newList.indexOfFirst { it.date == dateStr }
            val item = com.boxitt.app.services.DaySchedule(location_id = locationId, date = dateStr, status = "green")
            if (idx >= 0) newList[idx] = item else newList.add(item)
            selectedClosedDate = null
            selectedClosedRange = emptyList()
            rangeStart = dateStr
        } else { // "red"
            val item = com.boxitt.app.services.DaySchedule(
                location_id = locationId,
                date = dateStr,
                status = "red",
                closed_option = "one_time",
                closure_type = "full",
                start_time = "00:00",
                end_time = "23:59",
                note = ""
            )
            val idx = newList.indexOfFirst { it.date == dateStr }
            if (idx >= 0) newList[idx] = item else newList.add(item)
            selectedClosedDate = dateStr
            selectedClosedRange = listOf(dateStr)
            closedOption = "one_time"
            closureType = "full"
            closedStartTime = "00:00"
            closedEndTime = "23:59"
            closedNote = ""
            rangeStart = dateStr
        }
        schedules = newList
    }

    fun handleSaveOptions() {
        val dStr = selectedClosedDate ?: return
        val targets = if (selectedClosedRange.isNotEmpty()) selectedClosedRange else listOf(dStr)

        val newList = schedules.toMutableList()
        targets.forEach { targetDate ->
            val payload = com.boxitt.app.services.DaySchedule(
                location_id = locationId,
                date = targetDate,
                status = "red",
                closed_option = closedOption,
                closure_type = closureType,
                start_time = if (closureType == "partial") closedStartTime else null,
                end_time = if (closureType == "partial") closedEndTime else null,
                note = closedNote
            )
            val idx = newList.indexOfFirst { it.date == targetDate }
            if (idx >= 0) newList[idx] = payload else newList.add(payload)
        }
        schedules = newList
        selectedClosedDate = null
        selectedClosedRange = emptyList()
    }

    fun handleSyncCloud() {
        scope.launch {
            isSaving = true
            try {
                val persistable = schedules.filter { it.status == "green" || it.status == "red" }
                com.boxitt.app.services.ScheduleService.saveSchedulesBatch(locationId, persistable)
                onAlert?.invoke("Schedule synchronized to cloud successfully!", "success", null)
                fetchSchedules()
            } catch (e: Exception) {
                onAlert?.invoke("Sync failed: ${e.message}", "error", null)
            } finally {
                isSaving = false
            }
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp)),
        colors = CardDefaults.cardColors(containerColor = theme.colors.card),
        border = BorderStroke(1.dp, theme.colors.border)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "MANAGE BOX SCHEDULE",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary
                    )
                    Text(
                        text = "CONFIGURE OPENING & CLOSURE RULES",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp,
                        color = theme.colors.textDisabled
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(
                        onClick = {
                            val newCal = calendarDate.clone() as java.util.Calendar
                            newCal.add(java.util.Calendar.MONTH, -1)
                            calendarDate = newCal
                        },
                        modifier = Modifier
                            .size(36.dp)
                            .background(theme.colors.backgroundSecondary, RoundedCornerShape(10.dp))
                    ) {
                        Icon(Icons.Default.ChevronLeft, null, tint = theme.colors.textPrimary)
                    }

                    val monthNames = arrayOf("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
                    Text(
                        text = "${monthNames[month]} $year",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary
                    )

                    IconButton(
                        onClick = {
                            val newCal = calendarDate.clone() as java.util.Calendar
                            newCal.add(java.util.Calendar.MONTH, 1)
                            calendarDate = newCal
                        },
                        modifier = Modifier
                            .size(36.dp)
                            .background(theme.colors.backgroundSecondary, RoundedCornerShape(10.dp))
                    ) {
                        Icon(Icons.Default.ChevronRight, null, tint = theme.colors.textPrimary)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            if (rangeStart != null) {
                val startSched = schedules.find { it.date == rangeStart }
                val isRedStart = startSched?.status == "red"
                val bannerBg = if (isRedStart) Color(0x22F43F5E) else Color(0x223B82F6)
                val bannerBorder = if (isRedStart) Color(0xFFF43F5E) else Color(0xFF3B82F6)
                val bannerText = if (isRedStart) Color(0xFFF43F5E) else Color(0xFF2563EB)

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(bannerBg)
                        .border(1.dp, bannerBorder.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val formattedStart = rangeStart?.split("-")?.reversed()?.joinToString("/") ?: ""
                    Text(
                        text = "Window Selection Active (${if (isRedStart) "Closure" else "Opening"}): Start $formattedStart. Click another date to select range.",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = bannerText,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(
                        onClick = { rangeStart = null },
                        modifier = Modifier.padding(start = 8.dp)
                    ) {
                        Text("CANCEL", fontSize = 10.sp, fontWeight = FontWeight.Black, color = bannerText)
                    }
                }
                Spacer(Modifier.height(8.dp))
            }

            // Weekday Header
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                val weekDays = arrayOf("SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT")
                weekDays.forEach { day ->
                    Text(
                        text = day,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.accent,
                        modifier = Modifier.weight(1f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            // Active Rolling Green Window
            val totalGreenConfigured = schedules.count { it.status == "green" || (it.status == "red" && it.closure_type == "partial") }
            val activeGreenDates = remember(schedules) {
                if (totalGreenConfigured == 0) emptySet()
                else {
                    val set = mutableSetOf<String>()
                    val c = java.util.Calendar.getInstance()
                    var iterations = 0
                    while (set.size < totalGreenConfigured && iterations < 60) {
                        val dStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", c.get(java.util.Calendar.YEAR), c.get(java.util.Calendar.MONTH) + 1, c.get(java.util.Calendar.DAY_OF_MONTH))
                        val isFullClosed = schedules.any { it.date == dStr && it.status == "red" && it.closure_type == "full" }
                        if (!isFullClosed) {
                            set.add(dStr)
                        }
                        c.add(java.util.Calendar.DAY_OF_MONTH, 1)
                        iterations++
                    }
                    set
                }
            }

            // Schedule start date (earliest configured schedule rule)
            val scheduleStartDate = remember(schedules) {
                schedules.filter { it.status == "green" || it.status == "red" }.map { it.date }.minOrNull()
            }

            // Days Grid
            val cal = calendarDate.clone() as java.util.Calendar
            cal.set(java.util.Calendar.DAY_OF_WEEK_IN_MONTH, 1)
            cal.set(java.util.Calendar.DAY_OF_MONTH, 1)
            val firstDayOfWeek = cal.get(java.util.Calendar.DAY_OF_WEEK) - 1
            val daysInMonth = cal.getActualMaximum(java.util.Calendar.DAY_OF_MONTH)

            val totalCells = firstDayOfWeek + daysInMonth
            val rows = (totalCells + 6) / 7

            val todayCal = java.util.Calendar.getInstance()
            val todayStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", todayCal.get(java.util.Calendar.YEAR), todayCal.get(java.util.Calendar.MONTH) + 1, todayCal.get(java.util.Calendar.DAY_OF_MONTH))

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (r in 0 until rows) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        for (c in 0 until 7) {
                            val cellIndex = r * 7 + c
                            val dayNumber = cellIndex - firstDayOfWeek + 1
                            if (cellIndex < firstDayOfWeek || dayNumber > daysInMonth) {
                                Spacer(modifier = Modifier.weight(1f).aspectRatio(1f))
                            } else {
                                val dStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", year, month + 1, dayNumber)
                                val sched = schedules.find { it.date == dStr }

                                val isPast = dStr < todayStr
                                val isRed = sched?.status == "red"

                                // Active current window open days (today & future open dates) -> DARK GREEN
                                val isCurrentWindowGreen = !isPast && (sched?.status == "green" || activeGreenDates.contains(dStr)) && !isRed

                                // Completed past open days (only from schedule start date up to today) -> PALE GREEN
                                val isCompletedPastGreen = isPast && scheduleStartDate != null && dStr >= scheduleStartDate && !isRed

                                val isRollingGreen = isCurrentWindowGreen && sched?.status != "green"

                                val isRangeStartTile = rangeStart == dStr
                                val startSched = if (rangeStart != null) schedules.find { it.date == rangeStart } else null
                                val isRedStart = startSched?.status == "red"

                                val bgColor = when {
                                    isRangeStartTile -> if (isRedStart) Color(0xFFF43F5E) else Color(0xFF10B981)
                                    isCurrentWindowGreen -> Color(0xFF10B981)
                                    isCompletedPastGreen -> Color(0x3310B981)
                                    isRed -> Color(0xFFF43F5E)
                                    else -> theme.colors.backgroundSecondary.copy(alpha = 0.4f)
                                }
                                val textColor = when {
                                    isCurrentWindowGreen || isRed || isRangeStartTile -> Color.White
                                    isCompletedPastGreen -> Color(0xFF047857)
                                    else -> theme.colors.textPrimary
                                }

                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .aspectRatio(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(bgColor)
                                        .then(
                                            if (isRangeStartTile)
                                                Modifier.border(2.dp, if (isRedStart) Color(0xFFF43F5E) else Color(0xFF3B82F6), RoundedCornerShape(12.dp))
                                            else Modifier
                                        )
                                        .then(if (isPast) Modifier.alpha(0.5f) else Modifier)
                                        .clickable(enabled = !isPast) { handleDateClick(dayNumber) },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(text = "$dayNumber", fontSize = 12.sp, fontWeight = FontWeight.Black, color = textColor)
                                        when {
                                            isRangeStartTile -> {
                                                Text(
                                                    text = "START",
                                                    fontSize = 7.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = Color.White
                                                )
                                            }
                                            isCurrentWindowGreen -> {
                                                Text(
                                                    text = if (isRollingGreen) "AUTO" else "OPEN",
                                                    fontSize = 7.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = Color.White.copy(alpha = 0.8f)
                                                )
                                            }
                                            isCompletedPastGreen -> {
                                                Text(
                                                    text = "OPEN",
                                                    fontSize = 7.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = Color(0xFF047857)
                                                )
                                            }
                                            isRed -> {
                                                Text(
                                                    text = "CLOSED",
                                                    fontSize = 7.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = Color.White.copy(alpha = 0.8f)
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

            Spacer(Modifier.height(20.dp))

            // Options modal for selected closed date
            if (selectedClosedDate != null) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    colors = CardDefaults.cardColors(containerColor = theme.colors.backgroundSecondary),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            text = if (selectedClosedRange.size > 1) {
                                val firstDate = selectedClosedRange.first().split("-").reversed().joinToString("/")
                                val lastDate = selectedClosedRange.last().split("-").reversed().joinToString("/")
                                "CLOSURE OPTIONS WINDOW ($firstDate TO $lastDate) [${selectedClosedRange.size} DATES]"
                            } else {
                                "CLOSURE OPTIONS ($selectedClosedDate)"
                            },
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textPrimary
                        )

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("one_time" to "One-Time", "weekly" to "Weekly", "monthly" to "Monthly", "yearly" to "Yearly").forEach { (opt, label) ->
                                FilterChip(
                                    selected = closedOption == opt,
                                    onClick = { closedOption = opt },
                                    label = { Text(label, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
                                )
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("full" to "Full Day", "partial" to "Partial Hours").forEach { (type, label) ->
                                FilterChip(
                                    selected = closureType == type,
                                    onClick = { closureType = type },
                                    label = { Text(label, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
                                )
                            }
                        }

                        if (closureType == "partial") {
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                OutlinedTextField(
                                    value = closedStartTime,
                                    onValueChange = { closedStartTime = it },
                                    label = { Text("Start Time (HH:MM)", fontSize = 9.sp) },
                                    modifier = Modifier.weight(1f)
                                )
                                OutlinedTextField(
                                    value = closedEndTime,
                                    onValueChange = { closedEndTime = it },
                                    label = { Text("End Time (HH:MM)", fontSize = 9.sp) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }

                        OutlinedTextField(
                            value = closedNote,
                            onValueChange = { closedNote = it },
                            placeholder = { Text("Closure note / reason...") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )

                        Button(
                            onClick = { handleSaveOptions() },
                            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("SAVE CLOSURE RULE", fontSize = 11.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            LoadingButton(
                onClick = { handleSyncCloud() },
                loading = isSaving,
                text = "SYNC SCHEDULE TO CLOUD",
                loadingText = "SYNCHRONIZING...",
                backgroundColor = theme.colors.accent,
                modifier = Modifier.fillMaxWidth().height(50.dp)
            )
        }
    }
}

@Composable
private fun PlatformOrCourtSelector(
    isGameZone: Boolean,
    location: Location,
    platforms: List<GameZonePlatform>,
    selectedId: String?,
    theme: com.boxitt.app.theme.AppTheme,
    onSelect: (String) -> Unit
) {
    if (isGameZone) {
        if (platforms.isEmpty()) return
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            platforms.forEach { plat ->
                val selected = plat.id == selectedId
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (selected) theme.colors.accent else theme.colors.backgroundSecondary)
                        .clickable { onSelect(plat.id) }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = plat.name,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = if (selected) Color.White else theme.colors.textSecondary,
                        letterSpacing = 1.sp
                    )
                }
            }
        }
    } else {
        CourtSelector(location, selectedId, theme, onSelect)
    }
}

@Composable
private fun GameZoneTab(
    platforms: List<GameZonePlatform>,
    resources: List<GameZoneResource>,
    games: List<GameZoneGame>,
    theme: com.boxitt.app.theme.AppTheme
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Text(
            "GAMING PLATFORMS (${platforms.size})",
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            color = theme.colors.textDisabled,
            letterSpacing = 1.5.sp
        )
        if (platforms.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(theme.colors.backgroundSecondary)
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("No platforms found for this arena.", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.colors.textSecondary)
            }
        } else {
            platforms.forEach { plat ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(theme.colors.card)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(plat.name, fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                        if (!plat.description.isNullOrBlank()) {
                            Text(plat.description ?: "", fontSize = 11.sp, color = theme.colors.textSecondary)
                        }
                        val platResources = resources.filter { it.platformId == plat.id }
                        Text("Stations / Resources: ${platResources.size}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.colors.accent)
                    }
                }
            }
        }

        Text(
            "GAMES CATALOG (${games.size})",
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            color = theme.colors.textDisabled,
            letterSpacing = 1.5.sp
        )
        if (games.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(theme.colors.backgroundSecondary)
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("No games found.", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.colors.textSecondary)
            }
        } else {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(games) { game ->
                    Box(
                        modifier = Modifier
                            .width(160.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(theme.colors.card)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                            .padding(12.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(game.title, fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            if (!game.platform_type.isNullOrBlank()) {
                                Text(game.platform_type, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = theme.colors.accent)
                            }
                        }
                    }
                }
            }
        }
    }
}




