package com.boxitt.app.pages

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.draw.shadow
import com.boxitt.app.components.LoadingButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.components.ThemeSelector
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.LocationWithAdmin
import com.boxitt.app.services.LocationService
import kotlinx.coroutines.launch

@Composable
fun SuperAdminDashboard(
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onConfirm: ((message: String, onConfirm: () -> Unit, isDestructive: Boolean, confirmText: String) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var locations by remember { mutableStateOf<List<LocationWithAdmin>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var processingLocId by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }

    fun triggerAlert(msg: String, type: String = "info") { onAlert?.invoke(msg, type, null) }

    fun loadLocations() {
        scope.launch {
            loading = true
            try {
                locations = LocationService.getLocationsWithAdmins()
            } catch (e: Exception) {
                triggerAlert(e.message ?: "Failed to load locations", "error")
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) { loadLocations() }

    fun handleResetPassword(locId: String) {
        if (processingLocId != null) return
        val performReset = {
            scope.launch {
                processingLocId = locId
                try {
                    val result = LocationService.resetAdminPassword(locId)
                    triggerAlert("ID: ${result.first} | Key: ${result.second}", "success")
                    loadLocations()
                } catch (e: Exception) {
                    triggerAlert(e.message ?: "Reset failed", "error")
                } finally {
                    processingLocId = null
                }
            }
            Unit
        }
        if (onConfirm != null) {
            onConfirm("Reset login?", performReset, false, "Reset")
        } else {
            performReset()
        }
    }

    fun handleDelete(id: String) {
        if (processingLocId != null) return
        val performDelete = {
            scope.launch {
                processingLocId = id
                try {
                    LocationService.deleteLocation(id)
                    loadLocations()
                    triggerAlert("Removed", "success")
                } catch (e: Exception) {
                    triggerAlert(e.message ?: "Delete failed", "error")
                } finally {
                    processingLocId = null
                }
            }
            Unit
        }
        if (onConfirm != null) {
            onConfirm("Permanently delete?", performDelete, true, "Delete")
        } else {
            performDelete()
        }
    }

    fun openMaps(lat: Double, lng: Double) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps?q=$lat,$lng"))
        context.startActivity(intent)
    }

    val filteredLocations = locations.filter {
        it.name.contains(searchQuery, ignoreCase = true) || it.address.contains(searchQuery, ignoreCase = true)
    }

    val infiniteTransition = rememberInfiniteTransition(label = "PulseSpin")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "Pulse"
    )
    val spinRotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "Spin"
    )
    val loadingAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "LoadingPulse"
    )

    // Perspective animation for System Control
    var isSystemHovered by remember { mutableStateOf(false) }
    val systemRotationX by animateFloatAsState(if (isSystemHovered) -5f else 0f)
    val systemRotationY by animateFloatAsState(if (isSystemHovered) 5f else 0f)

    Box(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        // Background Decor
        Box(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .offset(x = (-100).dp, y = (-100).dp)
                    .size(500.dp)
                    .blur(120.dp)
                    .alpha(0.15f)
                    .background(theme.colors.accent, CircleShape)
            )
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = 100.dp, y = 100.dp)
                    .size(500.dp)
                    .blur(120.dp)
                    .alpha(0.15f)
                    .background(theme.colors.success, CircleShape)
            )
        }

        LazyColumn(contentPadding = PaddingValues(horizontal = 24.dp, vertical = 60.dp), verticalArrangement = Arrangement.spacedBy(48.dp), modifier = Modifier.fillMaxSize()) {
            // Header
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "Master ", 
                                style = TextStyle(
                                    fontSize = 42.sp, 
                                    fontWeight = FontWeight.Black, 
                                    fontStyle = FontStyle.Italic,
                                    color = theme.colors.textPrimary, 
                                    lineHeight = 44.sp,
                                    letterSpacing = (-2.5).sp,
                                    shadow = Shadow(color = Color.Black.copy(0.3f), offset = Offset(0f, 10f), blurRadius = 20f)
                                )
                            )
                            Text(
                                "Admin", 
                                style = TextStyle(
                                    fontSize = 42.sp, 
                                    fontWeight = FontWeight.Black, 
                                    fontStyle = FontStyle.Italic,
                                    color = theme.colors.accent, 
                                    lineHeight = 44.sp,
                                    letterSpacing = (-2.5).sp,
                                    shadow = Shadow(color = Color.Black.copy(0.3f), offset = Offset(0f, 10f), blurRadius = 20f)
                                )
                            )
                        }
                        Spacer(Modifier.height(16.dp))
                        Row(modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(Color.White.copy(0.05f)).border(1.dp, theme.colors.border.copy(0.25f), RoundedCornerShape(20.dp)).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Icon(
                                Icons.Default.VerifiedUser, 
                                null, 
                                tint = theme.colors.accent, 
                                modifier = Modifier.size(20.dp).graphicsLayer { scaleX = pulseScale; scaleY = pulseScale }
                            )
                            Text("SYSTEM ACCESS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                        }
                    }
                }
            }

            // Stats + Theme bar
            item {
                Box(modifier = Modifier.fillMaxWidth().shadow(30.dp, RoundedCornerShape(32.dp)).clip(RoundedCornerShape(32.dp)).background(theme.colors.card.copy(0.4f)).border(1.dp, theme.colors.border.copy(0.3f), RoundedCornerShape(32.dp)).padding(12.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Row(modifier = Modifier.weight(1f).padding(start = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Icon(Icons.Default.Storage, null, tint = theme.colors.accent, modifier = Modifier.size(22.dp))
                            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("${locations.size}", fontSize = 26.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary)
                                Text("ARENAS", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                            }
                        }
                        Divider(modifier = Modifier.height(32.dp).width(1.dp), color = theme.colors.border.copy(0.12f))
                        ThemeSelector()
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .shadow(10.dp, RoundedCornerShape(16.dp))
                                .clip(RoundedCornerShape(16.dp))
                                .background(theme.colors.accent)
                                .clickable { loadLocations() }
                                .graphicsLayer { if (loading) rotationZ = spinRotation }, 
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Refresh, null, tint = Color.White, modifier = Modifier.size(24.dp))
                        }
                    }
                }
            }

            // Arena Management header + search
            item {
                Box(modifier = Modifier.fillMaxWidth().shadow(30.dp, RoundedCornerShape(32.dp)).clip(RoundedCornerShape(32.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(32.dp))) {
                    Column {
                        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 36.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                Icon(Icons.Default.Dashboard, null, tint = theme.colors.accent, modifier = Modifier.size(26.dp))
                                Text("ARENA MANAGEMENT", fontSize = 26.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, letterSpacing = (-1).sp)
                            }
                        }
                        Divider(color = theme.colors.border.copy(0.12f), thickness = 1.dp)
                        Box(modifier = Modifier.padding(24.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White.copy(0.05f)).border(1.dp, theme.colors.border.copy(0.25f), RoundedCornerShape(16.dp)).padding(horizontal = 24.dp, vertical = 20.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                                Icon(Icons.Default.Search, null, tint = theme.colors.textPrimary.copy(0.4f), modifier = Modifier.size(18.dp))
                                androidx.compose.foundation.text.BasicTextField(
                                    value = searchQuery,
                                    onValueChange = { searchQuery = it },
                                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 15.sp, color = Color.White, fontWeight = FontWeight.Bold),
                                    modifier = Modifier.fillMaxWidth(),
                                    decorationBox = { inner -> if (searchQuery.isEmpty()) Text("Search arenas...", color = Color(0xFF334155), fontSize = 15.sp, fontWeight = FontWeight.Bold); inner() }
                                )
                            }
                        }
                        
                        // Arena list items
                        if (loading && locations.isEmpty()) {
                            Box(modifier = Modifier.fillMaxWidth().height(400.dp), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(modifier = Modifier.size(64.dp).border(4.dp, Color.White.copy(0.1f), CircleShape), contentAlignment = Alignment.Center) {
                                        CircularProgressIndicator(color = theme.colors.accent, strokeWidth = 4.dp, modifier = Modifier.size(64.dp))
                                    }
                                    Spacer(Modifier.height(32.dp))
                                    Text("LOADING...", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 5.sp, modifier = Modifier.alpha(loadingAlpha))
                                }
                            }
                        } else if (filteredLocations.isEmpty()) {
                            Box(modifier = Modifier.fillMaxWidth().padding(vertical = 140.dp), contentAlignment = Alignment.Center) {
                                Text("NO ARENAS FOUND", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                            }
                        } else {
                            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                                filteredLocations.forEachIndexed { idx, loc ->
                                    var isHovered by remember { mutableStateOf(false) }
                                    val hoverOffset by animateDpAsState(if (isHovered) 10.dp else 0.dp)
                                    val hoverBg by animateColorAsState(if (isHovered) Color.White.copy(0.08f) else Color.Transparent, label = "hoverBg")

                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .offset(x = hoverOffset)
                                            .clip(RoundedCornerShape(24.dp))
                                            .background(color = hoverBg)
                                            .clickable { isHovered = !isHovered }
                                            .padding(24.dp)
                                    ) {
                                        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                                            Box(modifier = Modifier.size(64.dp).graphicsLayer { if (isHovered) rotationZ = 6f }.shadow(12.dp, RoundedCornerShape(16.dp)).clip(RoundedCornerShape(16.dp)).background(Color.White.copy(0.05f)).border(1.dp, theme.colors.border, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                                                Icon(Icons.Default.Language, null, tint = theme.colors.accent, modifier = Modifier.size(32.dp))
                                            }
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(loc.name, fontSize = 24.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, lineHeight = 28.sp, letterSpacing = (-0.5).sp)
                                                Row(modifier = Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                    Icon(Icons.Default.Place, null, tint = theme.colors.textDisabled, modifier = Modifier.size(14.dp))
                                                    Text(loc.address, fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                                }
                                            }
                                        }
                                        Spacer(Modifier.height(20.dp))
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                            Row(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(Color.White.copy(0.05f)).border(1.dp, theme.colors.border.copy(0.2f), RoundedCornerShape(12.dp)).padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                                Icon(Icons.Default.Lock, null, tint = theme.colors.textDisabled, modifier = Modifier.size(14.dp))
                                                Text("ADMIN ID:", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                                Text(loc.adminUsername ?: "NOT SET", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF3B82F6))
                                            }
                                            if (loc.latitude != null && loc.longitude != null) {
                                                Row(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(Color.White.copy(0.05f)).border(1.dp, theme.colors.border.copy(0.2f), RoundedCornerShape(12.dp)).padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                                    Icon(Icons.Default.Place, null, tint = theme.colors.textDisabled, modifier = Modifier.size(14.dp))
                                                    Text("COORDS:", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                                    Text("${loc.latitude.toFloat().let { "%.4f".format(it) }}, ${loc.longitude.toFloat().let { "%.4f".format(it) }}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                                                }
                                            }
                                        }
                                        Spacer(Modifier.height(20.dp))
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                            if (loc.latitude != null && loc.longitude != null) {
                                                LoadingButton(
                                                    onClick = { openMaps(loc.latitude, loc.longitude) },
                                                    text = "MAP",
                                                    backgroundColor = Color(0xFF1A73E8),
                                                    icon = { Icon(Icons.Default.Navigation, null, tint = Color.White, modifier = Modifier.size(20.dp)) },
                                                    modifier = Modifier.weight(1f)
                                                )
                                            }
                                            LoadingButton(
                                                onClick = { handleResetPassword(loc.id) },
                                                loading = processingLocId == loc.id,
                                                enabled = processingLocId == null,
                                                text = "RESET",
                                                loadingText = "Resetting...",
                                                backgroundColor = theme.colors.accent.copy(0.1f),
                                                contentColor = theme.colors.accent,
                                                icon = { Icon(Icons.Default.Key, null, tint = theme.colors.accent, modifier = Modifier.size(20.dp)) },
                                                modifier = Modifier.weight(1f).border(1.dp, theme.colors.accent.copy(0.3f), RoundedCornerShape(16.dp))
                                            )
                                            LoadingButton(
                                                onClick = { handleDelete(loc.id) },
                                                loading = false, // handled by processingLocId check if needed, but delete is usually confirmation based
                                                enabled = processingLocId == null,
                                                text = "DELETE",
                                                backgroundColor = Color(0xFFEF4444),
                                                modifier = Modifier.width(100.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // System control panel
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .graphicsLayer {
                            rotationX = systemRotationX
                            rotationY = systemRotationY
                            cameraDistance = 12f * density
                        }
                        .shadow(30.dp, RoundedCornerShape(40.dp))
                        .clip(RoundedCornerShape(40.dp))
                        .background(Brush.linearGradient(colors = theme.colors.buttonGradient))
                        .clickable { isSystemHovered = !isSystemHovered }
                        .padding(48.dp)
                ) {
                    // Carbon fiber texture simulation using overlay
                    Box(modifier = Modifier.matchParentSize().alpha(0.15f).background(Color.Black, RoundedCornerShape(40.dp)))
                    
                    // Floating Decor inside System Control
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .offset(x = 20.dp, y = (-20).dp)
                            .size(150.dp)
                            .blur(30.dp)
                            .alpha(0.1f)
                            .background(Color.White, CircleShape)
                    )

                    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Icon(Icons.Default.Storage, null, tint = Color.White.copy(0.7f), modifier = Modifier.size(36.dp))
                            Text("SYSTEM CONTROL", fontSize = 32.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White, letterSpacing = (-1.5).sp)
                        }
                        Row(modifier = Modifier.padding(top = 48.dp), horizontalArrangement = Arrangement.spacedBy(56.dp)) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("SYSTEM HEALTH", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White.copy(0.7f), letterSpacing = 2.sp)
                                Spacer(Modifier.height(8.dp))
                                Text("100%", fontSize = 38.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("LATENCY", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White.copy(0.7f), letterSpacing = 2.sp)
                                Spacer(Modifier.height(8.dp))
                                Text("12ms", fontSize = 38.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White)
                            }
                        }
                    }
                }
            }
            
            item { Spacer(Modifier.height(40.dp)) }
        }
    }
}
