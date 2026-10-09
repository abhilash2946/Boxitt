package com.boxitt.app.pages

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.boxitt.app.components.LoadingButton
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.core.content.ContextCompat
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.boxitt.app.Location
import com.boxitt.app.services.handleError
import com.boxitt.app.SportType
import com.boxitt.app.User
import com.boxitt.app.components.NotificationBell
import com.boxitt.app.components.PermissionPrompt
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.contexts.PermissionType
import com.boxitt.app.contexts.PermissionsManager
import com.boxitt.app.services.*
import com.boxitt.app.services.GlobalSyncManager
import com.boxitt.app.utils.DistanceUtils
import com.boxitt.app.hooks.UserProfileViewModel
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.UUID

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ImageSlideshow(
    imageUrls: List<String>,
    theme: com.boxitt.app.theme.AppTheme
) {
    if (imageUrls.isEmpty()) {
        val infiniteTransition = rememberInfiniteTransition(label = "pulse")
        val opacity by infiniteTransition.animateFloat(
            initialValue = 0.3f,
            targetValue = 0.7f,
            animationSpec = infiniteRepeatable(
                animation = tween(1000, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "opacity"
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(theme.colors.backgroundSecondary.copy(alpha = opacity))
        )
        return
    }

    val scope = rememberCoroutineScope()
    val pagerState = rememberPagerState(pageCount = { imageUrls.size })

    Box(modifier = Modifier.fillMaxSize()) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            AsyncImage(
                model = imageUrls[page],
                contentDescription = "Location",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        }

        // Navigation Arrows
        if (imageUrls.size > 1) {
            Row(
                modifier = Modifier.fillMaxSize().padding(horizontal = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = {
                        scope.launch {
                            val prevPage = (pagerState.currentPage - 1 + imageUrls.size) % imageUrls.size
                            pagerState.animateScrollToPage(prevPage)
                        }
                    },
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(0.3f))
                ) {
                    Icon(Icons.Default.ChevronLeft, null, tint = Color.White, modifier = Modifier.size(20.dp))
                }

                IconButton(
                    onClick = {
                        scope.launch {
                            val nextPage = (pagerState.currentPage + 1) % imageUrls.size
                            pagerState.animateScrollToPage(nextPage)
                        }
                    },
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(0.3f))
                ) {
                    Icon(Icons.Default.ChevronRight, null, tint = Color.White, modifier = Modifier.size(20.dp))
                }
            }

            // Dot Indicators
            Row(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                repeat(imageUrls.size) { i ->
                    Box(
                        modifier = Modifier
                            .height(6.dp)
                            .width(if (i == pagerState.currentPage) 24.dp else 8.dp)
                            .clip(CircleShape)
                            .background(if (i == pagerState.currentPage) theme.colors.accent else Color.White.copy(0.4f))
                            .clickable {
                                scope.launch { pagerState.animateScrollToPage(i) }
                            }
                    )
                }
            }
        }
    }
}

@Composable
fun LocationSelector(
    onSelect: (Location) -> Unit,
    user: User?,
    sport: SportType,
    onBack: () -> Unit,
    onLogout: () -> Unit,
    onProfile: (() -> Unit)? = null,
    onSuperAdmin: (() -> Unit)? = null,
    onReview: (String) -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onConfirm: ((String, () -> Unit, (() -> Unit)?, String?, String?, Boolean?) -> Unit)? = null,
    onNavigate: ((String) -> Unit)? = null,
    onOpenDetails: ((String) -> Unit)? = null,
    triggerShowLogin: Boolean = false,
    triggerShowAdd: Boolean = false,
    triggerShowReset: Boolean = false,
    isAdminModeExternal: Boolean = false,
    onAdminModeChange: ((Boolean) -> Unit)? = null,
    onTriggerHandled: (() -> Unit)? = null,
    initialSearchQuery: String? = null
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    val userProfileViewModel = remember { UserProfileViewModel(scope) }
    LaunchedEffect(Unit) {
        userProfileViewModel.fetchCurrentUserProfile()
    }
    val userProfile = userProfileViewModel.currentUserProfile
    
    val userLat = userProfile?.latitude
    val userLon = userProfile?.longitude

    val globalLocations by GlobalSyncManager.locations.collectAsState()
    val isInitialSyncComplete by GlobalSyncManager.isInitialSyncComplete.collectAsState()

    var locations by remember { mutableStateOf<List<Location>>(globalLocations) }
    var isLoading by remember { mutableStateOf(globalLocations.isEmpty()) }
    
    LaunchedEffect(globalLocations) {
        locations = globalLocations
        if (locations.isNotEmpty()) isLoading = false
    }

    LaunchedEffect(isInitialSyncComplete) {
        if (isInitialSyncComplete) isLoading = false
    }

    var searchQuery by remember { mutableStateOf(initialSearchQuery ?: "") }
    var isAdminMode by remember { mutableStateOf(Storage.isSuperAdminSession()) }
    
    LaunchedEffect(isAdminModeExternal) {
        isAdminMode = isAdminModeExternal
    }

    var dropdownOpenId by remember { mutableStateOf<String?>(null) }

    var favorites by remember { mutableStateOf(Storage.getFavorites()) }

    fun handleToggleFavorite(id: String) {
        favorites = Storage.toggleFavorite(id)
    }

    // Modals
    var showLoginModal by remember { mutableStateOf(false) }
    var showAddModal by remember { mutableStateOf(false) }
    var showManualReset by remember { mutableStateOf(false) }
    var showSuperResetModal by remember { mutableStateOf(false) }

    LaunchedEffect(triggerShowLogin, triggerShowAdd, triggerShowReset) {
        if (triggerShowLogin) { showLoginModal = true; onTriggerHandled?.invoke() }
        if (triggerShowAdd) { showAddModal = true; onTriggerHandled?.invoke() }
        if (triggerShowReset) { showSuperResetModal = true; onTriggerHandled?.invoke() }
    }

    // Super admin login
    var password by remember { mutableStateOf("") }
    var isVerifying by remember { mutableStateOf(false) }

    // Super reset
    var currentSuperPassword by remember { mutableStateOf("") }
    var newSuperPassword by remember { mutableStateOf("") }
    var confirmSuperPassword by remember { mutableStateOf("") }
    var isUpdatingSuper by remember { mutableStateOf(false) }

    // Manual reset for location admin
    var resetLocId by remember { mutableStateOf<String?>(null) }
    var manualUsername by remember { mutableStateOf("") }
    var manualPassword by remember { mutableStateOf("") }
    var isResetting by remember { mutableStateOf(false) }

    // Add arena form
    var newLocName by remember { mutableStateOf("") }
    var newLocAddress by remember { mutableStateOf("") }
    var newLocEmail by remember { mutableStateOf("") }
    var newLocMinAdvance by remember { mutableStateOf("0") }
    var newLocImageUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var newLocLat by remember { mutableStateOf<Double?>(null) }
    var newLocLng by remember { mutableStateOf<Double?>(null) }
    var isAdding by remember { mutableStateOf(false) }
    var locating by remember { mutableStateOf(false) }

    val imagePickerLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        val validUris = uris.filter { uri ->
            val size = context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: 0
            if (size > 2 * 1024 * 1024) {
                onAlert?.invoke("Image too large (Max 2MB)", "error", null)
                false
            } else true
        }
        newLocImageUris = newLocImageUris + validUris
    }

    // Load locations on launch if not already synced
    LaunchedEffect(Unit) {
        if (!isInitialSyncComplete) {
            try {
                GlobalSyncManager.syncAllData(user?.id)
            } catch (e: Exception) {
                onAlert?.invoke(handleError(e).message, "error", null)
            } finally {
                isLoading = false
            }
        } else {
            isLoading = false
        }
    }

    // Filter + sort by sport and search query
    val sortedAndFiltered = remember(locations, searchQuery, sport, user?.location) {
        val bySupport = locations.filter { loc -> loc.supportedSports.any { it.name == sport.name } }
        
        fun getScore(text: String, query: String): Int {
            val t = text.lowercase()
            val q = query.lowercase().trim()
            if (t == q) return 10
            if (t.startsWith(q)) return 8
            val words = t.split(Regex("[\\s,]+"))
            if (words.any { it.startsWith(q) }) {
                if (words.any { it == q }) return 6
                return 4
            }
            if (t.contains(q)) return 2
            return 0
        }

        if (searchQuery.isBlank()) {
            bySupport.sortedWith(Comparator { a, b ->
                val userLoc = user?.location?.lowercase()?.trim() ?: ""
                val aIsUser = a.address.lowercase().trim() == userLoc
                val bIsUser = b.address.lowercase().trim() == userLoc
                if (aIsUser && !bIsUser) return@Comparator -1
                if (!aIsUser && bIsUser) return@Comparator 1
                val addr = a.address.compareTo(b.address)
                if (addr != 0) addr else a.name.compareTo(b.name)
            })
        } else {
            bySupport
                .map { loc -> 
                    val score = maxOf(getScore(loc.name, searchQuery), getScore(loc.address, searchQuery))
                    loc to score
                }
                .filter { it.second > 0 }
                .sortedWith(compareByDescending<Pair<Location, Int>> { it.second }
                    .then { a, b ->
                        val userLoc = user?.location?.lowercase()?.trim() ?: ""
                        val aIsUser = a.first.address.lowercase().trim() == userLoc
                        val bIsUser = b.first.address.lowercase().trim() == userLoc
                        if (aIsUser && !bIsUser) -1
                        else if (!aIsUser && bIsUser) 1
                        else {
                            val addrComp = a.first.address.compareTo(b.first.address)
                            if (addrComp != 0) addrComp else a.first.name.compareTo(b.first.name)
                        }
                    })
                .map { it.first }
        }
    }

    val favoriteArenas = remember(sortedAndFiltered, favorites) {
        sortedAndFiltered.filter { favorites.contains(it.id) }
    }

    val otherArenas = remember(sortedAndFiltered, favorites) {
        sortedAndFiltered.filter { !favorites.contains(it.id) }
    }

    // Group by address for non-favorites
    val groupedOther = remember(otherArenas) {
        otherArenas.groupBy { it.address }
    }

    fun handleAdminVerify() {
        if (password.isBlank()) return
        isVerifying = true
        scope.launch {
            try {
                val admin = AuthService.verifySuperPassword(password)
                if (admin != null) {
                    Storage.setSuperAdminSession(true)
                    isAdminMode = true
                    onAdminModeChange?.invoke(true)
                    showLoginModal = false
                    password = ""
                } else {
                    onAlert?.invoke("Invalid Super Admin Password", "error", null)
                }
            } catch (e: Exception) {
                onAlert?.invoke(handleError(e).message, "error", null)
            } finally {
                isVerifying = false
            }
        }
    }

    fun handleSuperReset() {
        if (currentSuperPassword.isBlank() || newSuperPassword.isBlank() || confirmSuperPassword.isBlank()) return
        if (newSuperPassword != confirmSuperPassword) {
            onAlert?.invoke("New passwords do not match", "error", null)
            return
        }
        isUpdatingSuper = true
        scope.launch {
            try {
                val isValid = AuthService.verifySuperPassword(currentSuperPassword) != null
                if (!isValid) {
                    onAlert?.invoke("Incorrect current password", "error", null)
                    return@launch
                }
                val success = AuthService.updateSuperAdminPassword(currentSuperPassword, newSuperPassword)
                if (success.isSuccess) {
                    onAlert?.invoke("Password updated successfully!", "success", null)
                    showSuperResetModal = false
                    currentSuperPassword = ""; newSuperPassword = ""; confirmSuperPassword = ""
                } else {
                    onAlert?.invoke("Failed to update password", "error", null)
                }
            } catch (e: Exception) {
                onAlert?.invoke(handleError(e).message, "error", null)
            } finally {
                isUpdatingSuper = false
            }
        }
    }

    fun handleAddLocation() {
        if (newLocName.isBlank() || newLocAddress.isBlank() || newLocEmail.isBlank() || newLocImageUris.isEmpty()) {
            onAlert?.invoke("Please fill all fields", "error", null)
            return
        }
        isAdding = true
        scope.launch {
            try {
                val uploadedUrls = mutableListOf<String>()
                val newId = UUID.randomUUID().toString()
                val arenaFolder = "${newLocName.replace(Regex("[^a-zA-Z0-9]"), "_")}_${newId.take(8)}"
                
                for (uri in newLocImageUris) {
                    val stream = context.contentResolver.openInputStream(uri)!!
                    val fileName = "$arenaFolder/Arena_Global/${System.currentTimeMillis()}-${(1000..9999).random()}"
                    val url = SupabaseStorageService.uploadFile("arenas", fileName, stream, context.contentResolver.getType(uri) ?: "image/jpeg")
                    uploadedUrls.add(url)
                }
                
                val loc = LocationService.addLocation(
                    Location(
                        id = newId,
                        name = newLocName,
                        address = newLocAddress,
                        email = newLocEmail,
                        min_advance = newLocMinAdvance.toDoubleOrNull() ?: 0.0,
                        image_urls = uploadedUrls,
                        supported_sports = listOf(sport.name),
                        latitude = newLocLat,
                        longitude = newLocLng
                    )
                )
                GlobalSyncManager.syncAllData(user?.id)
                showAddModal = false
                newLocName = ""; newLocAddress = ""; newLocEmail = ""; newLocImageUris = emptyList()
                newLocLat = null; newLocLng = null
                onAlert?.invoke("Arena added successfully!", "success", null)
            } catch (e: Exception) {
                onAlert?.invoke(e.message ?: "Error adding arena", "error", null)
            } finally {
                isAdding = false
            }
        }
    }

    fun handleDeleteLocation(id: String) {
        val locToDelete = locations.find { it.id == id }
        fun doDelete() {
            scope.launch {
                try {
                    // Delete images from storage first
                    locToDelete?.image_urls?.forEach { url ->
                        if (url.contains("/arenas/")) {
                            val path = url.split("/arenas/").last()
                            try {
                                SupabaseStorageService.deleteFile("arenas", path)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }
                    LocationService.deleteLocation(id)
                    locations = locations.filter { it.id != id }
                    GlobalSyncManager.syncAllData(user?.id)
                } catch (e: Exception) {
                    onAlert?.invoke(e.message ?: "Error", "error", null)
                }
            }
        }
        if (onConfirm != null) {
            onConfirm("Are you sure you want to delete this arena?", { doDelete() }, null, "Delete", "Cancel", true)
        } else doDelete()
    }

    fun openMaps(loc: Location) {
        if (loc.latitude != null && loc.longitude != null) {
            val uri = Uri.parse("https://www.google.com/maps?q=${loc.latitude},${loc.longitude}")
            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
        } else {
            onAlert?.invoke("No coordinates set for this arena", "info", null)
        }
    }

    fun handleSelect(loc: Location) {
        onSelect(loc)
        user?.let {
            val updatedUser = it.copy(selectedLocationId = loc.id)
            Storage.setUser(updatedUser)
        }
    }

    fun getCurrentLocation() {
        // Implementation of location fetching...
    }

    Box(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        // 3D Background Decorative Elements
        Box(
            modifier = Modifier
                .offset(x = (-80).dp, y = (-80).dp)
                .fillMaxWidth(0.8f)
                .aspectRatio(1f)
                .clip(CircleShape)
                .blur(120.dp)
                .background(theme.colors.accent.copy(alpha = 0.15f))
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = 100.dp, y = 100.dp)
                .fillMaxWidth(0.6f)
                .aspectRatio(1f)
                .clip(CircleShape)
                .blur(120.dp)
                .background(theme.colors.success.copy(alpha = 0.2f))
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(top = 24.dp, bottom = 80.dp, start = 16.dp, end = 16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Header
            item {
                Column {
                    Spacer(Modifier.height(1.dp))
                    Column {
                        Text(
                            buildAnnotatedString {
                                withStyle(
                                    SpanStyle(
                                        shadow = Shadow(
                                            color = Color.Black.copy(alpha = 0.3f),
                                            offset = Offset(0f, 4f),
                                            blurRadius = 8f
                                        )
                                    )
                                ) {
                                    append("SELECT ")
                                    withStyle(SpanStyle(color = theme.colors.accent)) {
                                        append("ARENA")
                                    }
                                }
                            },
                            fontSize = 36.sp,
                            fontWeight = FontWeight.Black,
                            fontStyle = FontStyle.Italic,
                            color = theme.colors.textPrimary
                        )
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(theme.colors.accent))
                            Text("${sport.name} MODE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
                        }
                    }
                }
            }

            // Search bar
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search arenas...", color = theme.colors.textDisabled, fontWeight = FontWeight.Bold) },
                    leadingIcon = { Icon(Icons.Default.Search, null, tint = theme.colors.textDisabled) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = theme.colors.accent,
                        unfocusedBorderColor = theme.colors.border,
                        focusedTextColor = theme.colors.textPrimary,
                        unfocusedTextColor = theme.colors.textPrimary,
                        focusedContainerColor = theme.colors.card,
                        unfocusedContainerColor = theme.colors.card
                    )
                )
            }

            if (isLoading) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = theme.colors.accent)
                            Spacer(Modifier.height(12.dp))
                            Text("LOADING ARENAS...", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        }
                    }
                }
            } else if (favoriteArenas.isEmpty() && groupedOther.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp).clip(RoundedCornerShape(24.dp)).background(theme.colors.backgroundSecondary).border(2.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("NO ARENAS FOUND IN THIS AREA", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                    }
                }
            } else {
                // Favorite Arenas Section
                if (favoriteArenas.isNotEmpty()) {
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(start = 4.dp)) {
                            Icon(Icons.Default.Favorite, null, tint = theme.colors.error, modifier = Modifier.size(16.dp))
                            Text("FAVORITE ARENAS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        }
                    }

                    items(favoriteArenas) { loc ->
                        LocationCard(
                            loc = loc,
                            theme = theme,
                            isAdminMode = isAdminMode,
                            isSuperAdmin = user?.role == "superadmin",
                            userLat = userLat,
                            userLon = userLon,
                            onSelect = { handleSelect(loc) },
                            onDelete = { handleDeleteLocation(loc.id) },
                            onReview = { onReview(loc.id) },
                            onOpenMaps = { openMaps(loc) },
                            onManualReset = {
                                resetLocId = loc.id
                                manualUsername = ""
                                manualPassword = ""
                                showManualReset = true
                            },
                            onToggleFavorite = { handleToggleFavorite(loc.id) },
                            isFavorite = true,
                            onOpenDetails = onOpenDetails,
                            dropdownOpenId = dropdownOpenId,
                            onDropdownToggle = { id -> dropdownOpenId = if (dropdownOpenId == id) null else id },
                            onDropdownDismiss = { dropdownOpenId = null }
                        )
                    }

                    if (groupedOther.isNotEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 16.dp)
                                    .height(1.dp)
                                    .background(
                                        Brush.horizontalGradient(
                                            listOf(
                                                Color.Transparent,
                                                theme.colors.border.copy(0.5f),
                                                Color.Transparent
                                            )
                                        )
                                    )
                            )
                        }
                    }
                }

                // Other Arenas Sections
                groupedOther.forEach { (address, arenas) ->
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(start = 4.dp)) {
                            Icon(Icons.Default.Place, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                            Text(address.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        }
                    }

                    items(arenas) { loc ->
                        LocationCard(
                            loc = loc,
                            theme = theme,
                            isAdminMode = isAdminMode,
                            isSuperAdmin = user?.role == "superadmin",
                            userLat = userLat,
                            userLon = userLon,
                            onSelect = { handleSelect(loc) },
                            onDelete = { handleDeleteLocation(loc.id) },
                            onReview = { onReview(loc.id) },
                            onOpenMaps = { openMaps(loc) },
                            onManualReset = {
                                resetLocId = loc.id
                                manualUsername = ""
                                manualPassword = ""
                                showManualReset = true
                            },
                            onToggleFavorite = { handleToggleFavorite(loc.id) },
                            isFavorite = favorites.contains(loc.id),
                            onOpenDetails = onOpenDetails,
                            dropdownOpenId = dropdownOpenId,
                            onDropdownToggle = { id -> dropdownOpenId = if (dropdownOpenId == id) null else id },
                            onDropdownDismiss = { dropdownOpenId = null }
                        )
                    }
                }
            }

            item { Spacer(Modifier.height(80.dp)) }
        }

        // Modals
        if (showLoginModal) {
            Dialog(onDismissRequest = { showLoginModal = false }) {
                Surface(
                    modifier = Modifier.fillMaxWidth(0.9f).clip(RoundedCornerShape(28.dp)),
                    color = theme.colors.card,
                    border = BorderStroke(1.dp, theme.colors.border)
                ) {
                    Column(
                        modifier = Modifier.padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        IconButton(onClick = { showLoginModal = false }, modifier = Modifier.align(Alignment.End)) {
                            Icon(Icons.Default.Close, null, tint = theme.colors.textDisabled)
                        }
                        Box(
                            modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)).background(theme.colors.accent.copy(alpha = 0.15f)).border(1.dp, theme.colors.accent.copy(0.3f), RoundedCornerShape(16.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Shield, null, tint = theme.colors.accent, modifier = Modifier.size(32.dp))
                        }
                        Spacer(Modifier.height(24.dp))
                        Text("SECURITY CHECK", fontSize = 28.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, textAlign = TextAlign.Center, letterSpacing = (-1).sp)
                        Spacer(Modifier.height(32.dp))
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            placeholder = { Text("Enter Access Code", color = theme.colors.textDisabled) },
                            visualTransformation = PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            textStyle = TextStyle(textAlign = TextAlign.Center, fontWeight = FontWeight.Bold, fontSize = 18.sp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = theme.colors.accent,
                                unfocusedBorderColor = theme.colors.border,
                                focusedContainerColor = theme.colors.background,
                                unfocusedContainerColor = theme.colors.background
                            )
                        )
                        Spacer(Modifier.height(32.dp))
                        LoadingButton(
                            onClick = { handleAdminVerify() },
                            loading = isVerifying,
                            text = "VERIFY ACCESS",
                            loadingText = "Verifying...",
                            backgroundColor = theme.colors.accent,
                            modifier = Modifier.fillMaxWidth()
                        )
                        TextButton(onClick = { showLoginModal = false }, modifier = Modifier.padding(top = 16.dp)) {
                            Text("CANCEL", color = theme.colors.textDisabled, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                        }
                    }
                }
            }
        }

        if (showAddModal) {
            Dialog(onDismissRequest = { showAddModal = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = theme.colors.background
                ) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Header
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(24.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("ADD ARENA", fontSize = 24.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary)
                            IconButton(onClick = { showAddModal = false }) {
                                Icon(Icons.Default.Close, null, tint = theme.colors.textDisabled)
                            }
                        }

                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .verticalScroll(rememberScrollState())
                                .padding(horizontal = 24.dp),
                            verticalArrangement = Arrangement.spacedBy(24.dp)
                        ) {
                            // Image Picker
                            Column {
                                Text("ARENA IMAGES", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Spacer(Modifier.height(12.dp))
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(160.dp)
                                        .clip(RoundedCornerShape(20.dp))
                                        .background(theme.colors.card)
                                        .border(2.dp, theme.colors.border, RoundedCornerShape(20.dp))
                                        .clickable { imagePickerLauncher.launch("image/*") },
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (newLocImageUris.isEmpty()) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Icon(Icons.Default.AddAPhoto, null, tint = theme.colors.accent, modifier = Modifier.size(32.dp))
                                            Text("UPLOAD PHOTOS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                                        }
                                    } else {
                                        Row(
                                            modifier = Modifier.fillMaxSize().padding(12.dp),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            newLocImageUris.forEach { uri ->
                                                AsyncImage(
                                                    model = uri,
                                                    contentDescription = null,
                                                    modifier = Modifier.size(136.dp).clip(RoundedCornerShape(12.dp)),
                                                    contentScale = ContentScale.Crop
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            // Form Fields
                            data class FormField(val label: String, val icon: ImageVector, val value: String, val setter: (String) -> Unit)
                            listOf(
                                FormField("ARENA NAME", Icons.Default.SportsScore, newLocName) { v: String -> newLocName = v },
                                FormField("ADMIN EMAIL", Icons.Default.Email, newLocEmail) { v: String -> newLocEmail = v }
                            ).forEach { (label, icon, value, setter) ->
                                Column {
                                    Text(
                                        label,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.colors.textDisabled,
                                        letterSpacing = 1.sp
                                    )
                                    Spacer(Modifier.height(8.dp))
                                    OutlinedTextField(
                                        value = value,
                                        onValueChange = setter,
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(16.dp),
                                        leadingIcon = {
                                            Icon(
                                                icon,
                                                null,
                                                tint = theme.colors.accent,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        },
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = theme.colors.accent,
                                            unfocusedBorderColor = theme.colors.border,
                                            focusedTextColor = theme.colors.textPrimary,
                                            unfocusedTextColor = theme.colors.textPrimary,
                                            unfocusedContainerColor = theme.colors.card,
                                            focusedContainerColor = theme.colors.card
                                        )
                                    )
                                }
                            }

                            // Location Field
                            Column {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "LOCATION (CITY/AREA)",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.colors.textDisabled,
                                        letterSpacing = 1.sp
                                    )
                                }
                                Spacer(Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = newLocAddress,
                                    onValueChange = { newLocAddress = it },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(16.dp),
                                    leadingIcon = {
                                        Icon(
                                            Icons.Default.Place,
                                            null,
                                            tint = theme.colors.accent,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    },
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = theme.colors.accent,
                                        unfocusedBorderColor = theme.colors.border,
                                        focusedTextColor = theme.colors.textPrimary,
                                        unfocusedTextColor = theme.colors.textPrimary,
                                        unfocusedContainerColor = theme.colors.card,
                                        focusedContainerColor = theme.colors.card
                                    )
                                )
                            }



                            Spacer(Modifier.height(24.dp))
                        }

                        // Footer
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = theme.colors.card,
                            shadowElevation = 16.dp
                        ) {
                            Row(
                                modifier = Modifier
                                    .padding(20.dp)
                                    .navigationBarsPadding(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                OutlinedButton(
                                    onClick = { showAddModal = false },
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(56.dp),
                                    shape = RoundedCornerShape(16.dp),
                                    border = BorderStroke(1.dp, theme.colors.border)
                                ) {
                                    Text(
                                        "CANCEL",
                                        color = theme.colors.textPrimary,
                                        fontWeight = FontWeight.Black,
                                        fontSize = 12.sp
                                    )
                                }
                                LoadingButton(
                                    onClick = { handleAddLocation() },
                                    loading = isAdding,
                                    text = "CREATE ARENA",
                                    loadingText = "Creating...",
                                    backgroundColor = theme.colors.accent,
                                    modifier = Modifier.weight(2f)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun LocationCard(
    loc: Location,
    theme: com.boxitt.app.theme.AppTheme,
    isAdminMode: Boolean,
    isSuperAdmin: Boolean = false,
    userLat: Double? = null,
    userLon: Double? = null,
    onSelect: () -> Unit,
    onDelete: () -> Unit,
    onReview: () -> Unit,
    onOpenMaps: () -> Unit,
    onManualReset: () -> Unit,
    onToggleFavorite: () -> Unit,
    isFavorite: Boolean,
    onOpenDetails: ((String) -> Unit)?,
    dropdownOpenId: String?,
    onDropdownToggle: (String) -> Unit,
    onDropdownDismiss: () -> Unit
) {
    val distance = remember(loc, userLat, userLon) {
        if (userLat != null && userLon != null && loc.latitude != null && loc.longitude != null) {
            DistanceUtils.calculateDistance(userLat, userLon, loc.latitude, loc.longitude)
        } else null
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(28.dp))
            .background(theme.colors.card)
            .border(1.dp, theme.colors.border, RoundedCornerShape(28.dp))
            .clickable(enabled = !isAdminMode) { onSelect() }
    ) {
        Column {
            // Image slideshow
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 10f)
                    .padding(20.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .shadow(8.dp, RoundedCornerShape(16.dp))
            ) {
                ImageSlideshow(imageUrls = loc.imageUrls, theme = theme)

                // Status Badge
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(20.dp)
                        .background(
                            if (loc.isOpen) Color(0xE622C55E) else Color(0xE6EF4444),
                            RoundedCornerShape(8.dp)
                        )
                        .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Text(
                        text = if (loc.isOpen) "OPEN" else "CLOSED",
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp
                    )
                }

                // Gradient overlay
                Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(0.8f)))))

                // Name overlay
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(start = 24.dp, bottom = 20.dp, end = 24.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = loc.name,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black,
                            fontStyle = FontStyle.Italic,
                            color = Color.White,
                            lineHeight = 36.sp,
                            style = TextStyle(
                                shadow = Shadow(
                                    color = Color.Black.copy(alpha = 0.5f),
                                    offset = Offset(0f, 4f),
                                    blurRadius = 8f
                                )
                            ),
                            modifier = Modifier.weight(1f, fill = false)
                        )

                        if (distance != null) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(theme.colors.accent.copy(0.9f))
                                    .border(1.dp, Color.White.copy(0.2f), RoundedCornerShape(12.dp))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        Icons.AutoMirrored.Filled.Send,
                                        null,
                                        tint = Color.White,
                                        modifier = Modifier.size(10.dp)
                                    )
                                    Text(
                                        DistanceUtils.formatDistance(distance),
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black
                                    )
                                }
                            }
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                        Icon(Icons.Default.Place, null, tint = Color.White.copy(0.8f), modifier = Modifier.size(14.dp))
                        val displayAddress = remember(loc.address) {
                            val parts = loc.address.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                            if (parts.size > 3) parts.take(3).joinToString(", ") else loc.address
                        }
                        Text(displayAddress.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White.copy(0.8f), letterSpacing = 1.sp)
                    }
                }

                // More options button
                Row(
                    modifier = Modifier.align(Alignment.TopEnd).padding(20.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (isAdminMode) {
                        IconButton(
                            onClick = onToggleFavorite,
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.Black.copy(0.4f))
                        ) {
                            Icon(
                                if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                null,
                                tint = if (isFavorite) Color.Red else Color.White
                            )
                        }
                        IconButton(
                            onClick = onDelete,
                            modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(Color.Red)
                        ) {
                            Icon(Icons.Default.Delete, null, tint = Color.White)
                        }
                    }

                    // Three-dot menu visible to everyone
                    Box {
                        IconButton(
                            onClick = { onDropdownToggle(loc.id) },
                            modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(Color.Black.copy(0.4f))
                        ) {
                            Icon(Icons.Default.MoreVert, null, tint = Color.White)
                        }
                        DropdownMenu(
                            expanded = dropdownOpenId == loc.id,
                            onDismissRequest = onDropdownDismiss,
                            modifier = Modifier.background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                        ) {
                            DropdownMenuItem(
                                text = { Text("More details", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary) },
                                onClick = { onDropdownDismiss(); onOpenDetails?.invoke(loc.id) }
                            )
                        }
                    }
                }
            }

            // Price + actions row
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 32.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("FULL PRICE", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                            Text(if ((loc.defaultPrice ?: 0.0) > 0) "₹${loc.defaultPrice?.toInt()}" else "No prices yet", fontSize = if ((loc.defaultPrice ?: 0.0) > 0) 22.sp else 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                        }
                        Box(modifier = Modifier.width(1.dp).height(24.dp).background(theme.colors.border))
                        Column {
                            Text("ADVANCE", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                            Text(if ((loc.defaultAdvance ?: 0.0) > 0) "₹${loc.defaultAdvance?.toInt()}" else "No prices yet", fontSize = if ((loc.defaultAdvance ?: 0.0) > 0) 22.sp else 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = onSelect,
                            modifier = Modifier.weight(1f).height(56.dp).shadow(8.dp, RoundedCornerShape(14.dp)),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Box(
                                modifier = Modifier.fillMaxSize().background(
                                    if (loc.isOpen) Brush.horizontalGradient(theme.colors.buttonGradient)
                                    else Brush.horizontalGradient(listOf(Color(0xFF94A3B8), Color(0xFF64748B)))
                                ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(if (loc.isOpen) "ENTER ARENA" else "ARENA CLOSED", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 2.sp)
                            }
                        }

                        if (loc.latitude != null && loc.longitude != null) {
                            IconButton(
                                onClick = onOpenMaps,
                                modifier = Modifier.size(56.dp).shadow(8.dp, RoundedCornerShape(14.dp)).clip(RoundedCornerShape(14.dp)).background(Color(0xFF1A73E8))
                            ) {
                                Icon(Icons.Default.Navigation, null, tint = Color.White)
                            }
                        }
                    }
                }

                Spacer(Modifier.width(16.dp))

                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (!isAdminMode) {
                        IconButton(
                            onClick = onToggleFavorite,
                            modifier = Modifier
                                .size(56.dp)
                                .shadow(8.dp, RoundedCornerShape(14.dp))
                                .clip(RoundedCornerShape(14.dp))
                                .background(if (isFavorite) theme.colors.error.copy(alpha = 0.15f) else theme.colors.backgroundSecondary)
                                .border(1.dp, theme.colors.border, RoundedCornerShape(14.dp))
                        ) {
                            Icon(
                                if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                null,
                                tint = if (isFavorite) theme.colors.error else theme.colors.textDisabled
                            )
                        }
                    }
                    if (isAdminMode) {
                        IconButton(
                            onClick = onManualReset,
                            modifier = Modifier
                                .size(56.dp)
                                .shadow(8.dp, RoundedCornerShape(14.dp))
                                .clip(RoundedCornerShape(14.dp))
                                .background(theme.colors.card)
                                .border(1.dp, theme.colors.border, RoundedCornerShape(14.dp))
                        ) {
                            Icon(
                                Icons.Default.VpnKey,
                                contentDescription = "Reset Admin Credentials",
                                tint = theme.colors.accent
                            )
                        }
                    }
                    IconButton(
                        onClick = onReview,
                        modifier = Modifier.size(56.dp).shadow(8.dp, RoundedCornerShape(14.dp)).clip(RoundedCornerShape(14.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(14.dp))
                    ) {
                        Icon(Icons.Default.Star, null, tint = theme.colors.textDisabled)
                    }
                }
            }
        }
    }
}
