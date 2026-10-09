package com.boxitt.app.pages

import android.content.Intent
import android.net.Uri
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import com.boxitt.app.Location
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.LocationService
import com.boxitt.app.services.PricingService
import com.boxitt.app.services.RatingService
import com.boxitt.app.theme.vw
import com.boxitt.app.theme.clamp
import androidx.compose.material.icons.automirrored.filled.*
import com.boxitt.app.components.ImageViewer
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.CancellationException
import java.net.URLEncoder
import androidx.compose.ui.window.Dialog

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ArenaDetailsPage(
    locationId: String,
    onBack: () -> Unit,
    onBookNow: ((Location) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current

    var arena by remember { mutableStateOf<Location?>(null) }
    var pricing by remember { mutableStateOf<List<com.boxitt.app.Pricing>>(emptyList()) }
    var avgRating by remember { mutableStateOf(0.0) }
    var ratingCount by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var viewerConfig by remember { mutableStateOf(Triple(false, emptyList<String>(), 0)) }
    var selectedCourtIdx by remember { mutableStateOf(0) }

    LaunchedEffect(locationId) {
        if (locationId.isBlank()) {
            loading = false
            return@LaunchedEffect
        }
        
        try {
            val a = async { LocationService.getLocationById(locationId) }
            val p = async { PricingService.getPricingForLocation(locationId) }
            val r = async { RatingService.getLocationAverageRating(locationId) }
            val rc = async { RatingService.getLocationRatingCount(locationId) }
            
            arena = a.await()
            pricing = p.await()
            avgRating = r.await()
            ratingCount = rc.await()
        } catch (e: Exception) {
            val msg = e.message ?: ""
            if (e is CancellationException || msg.contains("coroutine scope left the composition", ignoreCase = true)) {
                // Normal cancellation, don't show error
            } else {
                e.printStackTrace()
            }
        } finally {
            loading = false
        }
    }

    val basePrice = remember(pricing) {
        if (pricing.isNotEmpty()) pricing.minOf { it.price / (if (it.duration_hours > 0) it.duration_hours else 1.0) } else 0.0
    }
    val displayRating = if (avgRating > 0) avgRating else (arena?.rating ?: 0.0)


    if (loading) {
        Box(modifier = Modifier.fillMaxSize().background(theme.colors.background), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = theme.colors.accent)
                Spacer(Modifier.height(12.dp))
                Text("Loading Arena Details...", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
            }
        }
        return
    }

    val loc = arena
    if (loc == null) {
        Box(modifier = Modifier.fillMaxSize().background(theme.colors.background), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Arena Not Found", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                Spacer(Modifier.height(16.dp))
                Button(onClick = onBack, colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent), shape = RoundedCornerShape(14.dp)) {
                    Text("GO BACK", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                }
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(theme.colors.background),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        // Sticky Header
        item {
            Box(
                modifier = Modifier.fillMaxWidth().background(theme.colors.background.copy(0.8f)).padding(horizontal = 16.dp, vertical = 16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                    ) {
                        Icon(Icons.Default.ChevronLeft, null, tint = theme.colors.textPrimary)
                    }
                    Text(loc.name.uppercase(), fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, modifier = Modifier.weight(1f).padding(horizontal = 16.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)
                    
                    Spacer(Modifier.size(40.dp)) // Spacer to balance header
                }
            }
        }

        // Arena Global Gallery
        item {
            val globalImages = loc.imageUrls
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text("ARENA GLOBAL GALLERY", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                    Text("${globalImages.size} PHOTOS", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                }
                
                if (globalImages.isNotEmpty()) {
                    val columns = 2
                    val rows = (globalImages.size + columns - 1) / columns
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (r in 0 until rows) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                for (c in 0 until columns) {
                                    val index = r * columns + c
                                    if (index < globalImages.size) {
                                        val img = globalImages[index]
                                        Box(
                                            modifier = Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(16.dp)).border(1.dp, theme.colors.border, RoundedCornerShape(16.dp)).clickable { 
                                                viewerConfig = Triple(true, globalImages, index)
                                            }
                                        ) {
                                            AsyncImage(model = img, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                                        }
                                    } else {
                                        Spacer(Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                } else {
                    Box(
                        modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(2.dp, theme.colors.border, RoundedCornerShape(24.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("NO GLOBAL IMAGES AVAILABLE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                    }
                }
            }
        }

        // Court Specific Gallery
        val courts = loc.courts ?: emptyList()
        if (courts.isNotEmpty()) {
            item {
                Box(
                    modifier = Modifier.padding(horizontal = 16.dp).clip(RoundedCornerShape(24.dp)).background(theme.colors.card.copy(0.3f)).border(1.dp, theme.colors.border.copy(0.5f), RoundedCornerShape(24.dp)).padding(16.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        // Court Selector inside the card
                        Column {
                            Text("SELECT COURT", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(12.dp))
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                itemsIndexed(courts) { idx, court ->
                                    val isSelected = selectedCourtIdx == idx
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(if (isSelected) theme.colors.accent else theme.colors.card)
                                            .border(1.dp, if (isSelected) theme.colors.accent else theme.colors.border, RoundedCornerShape(12.dp))
                                            .clickable { selectedCourtIdx = idx }
                                            .padding(horizontal = 12.dp, vertical = 6.dp)
                                    ) {
                                        Text(
                                            (court.name ?: "Court ${court.courtNumber}").uppercase(),
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Black,
                                            color = if (isSelected) Color.White else theme.colors.textSecondary,
                                            letterSpacing = 1.sp
                                        )
                                    }
                                }
                            }
                        }

                        if (selectedCourtIdx < courts.size) {
                            val court = courts[selectedCourtIdx]
                            val courtImages = court.imageUrls
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                    Text("${(court.name ?: "Court ${court.courtNumber}").uppercase()} GALLERY", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    Text("${courtImages.size} PHOTOS", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                                }

                                if (courtImages.isNotEmpty()) {
                                    val columns = 2
                                    val rows = (courtImages.size + columns - 1) / columns
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        for (r in 0 until rows) {
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                for (c in 0 until columns) {
                                                    val index = r * columns + c
                                                    if (index < courtImages.size) {
                                                        val img = courtImages[index]
                                                        Box(
                                                            modifier = Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(16.dp)).border(1.dp, theme.colors.border, RoundedCornerShape(16.dp)).clickable { 
                                                                viewerConfig = Triple(true, courtImages, index)
                                                            }
                                                        ) {
                                                            AsyncImage(model = img, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                                                        }
                                                    } else {
                                                        Spacer(Modifier.weight(1f))
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    Box(
                                        modifier = Modifier.fillMaxWidth().height(100.dp).clip(RoundedCornerShape(16.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(16.dp)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("NO IMAGES FOR THIS COURT", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // About section
        item {
            val hasDescriptions = !loc.description.isNullOrBlank() || loc.courts?.any { !it.description.isNullOrBlank() } == true
            if (hasDescriptions) {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(16.dp).clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(24.dp)
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Info, null, tint = theme.colors.accent, modifier = Modifier.size(20.dp))
                            Text("ABOUT ARENA", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
                        }
                        Spacer(Modifier.height(16.dp))
                        if (!loc.description.isNullOrBlank()) {
                            Text(loc.description, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = theme.colors.textSecondary, lineHeight = 22.sp)
                        }
                        
                        loc.courts?.filter { !it.description.isNullOrBlank() }?.forEach { court ->
                            Spacer(Modifier.height(16.dp))
                            Text(court.name ?: "Court ${court.courtNumber}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, letterSpacing = 1.sp)
                            Spacer(Modifier.height(4.dp))
                            Text(court.description!!, fontSize = 13.sp, color = theme.colors.textSecondary, lineHeight = 18.sp)
                        }
                    }
                }
            }
        }

        // Stats card
        item {
            Box(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(24.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    // Status
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("STATUS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        Row(
                            modifier = Modifier.clip(RoundedCornerShape(50.dp)).background((if (loc.isOpen) theme.colors.success else theme.colors.error).copy(0.1f)).padding(horizontal = 12.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(if (loc.isOpen) Icons.Default.CheckCircle else Icons.Default.Cancel, null, tint = if (loc.isOpen) theme.colors.success else theme.colors.error, modifier = Modifier.size(16.dp))
                            Text(if (loc.isOpen) "OPEN" else "CLOSED", fontSize = 14.sp, fontWeight = FontWeight.Black, color = if (loc.isOpen) theme.colors.success else theme.colors.error)
                        }
                    }

                    HorizontalDivider(color = theme.colors.border)

                    // Rating
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("RATING", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        Column(horizontalAlignment = Alignment.End) {
                            Row(
                                modifier = Modifier.clip(RoundedCornerShape(50.dp)).background(theme.colors.success.copy(0.1f)).padding(horizontal = 12.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(Icons.Default.Star, null, tint = theme.colors.success, modifier = Modifier.size(16.dp))
                                Text(String.format("%.1f", displayRating), fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.success)
                            }
                            if (ratingCount > 0) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 4.dp)) {
                                    Icon(Icons.Default.Group, null, tint = theme.colors.textDisabled, modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp)))
                                    Text("$ratingCount reviews", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                }
                            }
                        }
                    }

                    HorizontalDivider(color = theme.colors.border)

                    // No. of Courts
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("NO. OF COURTS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        Row(
                            modifier = Modifier.clip(RoundedCornerShape(50.dp)).background(theme.colors.accent.copy(0.1f)).padding(horizontal = 12.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(Icons.Default.GridView, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                            Text("${loc.numberOfCourts}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                        }
                    }

                    HorizontalDivider(color = theme.colors.border)

                    // Base price
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("BASE PRICE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Default.CurrencyRupee, null, tint = theme.colors.textPrimary, modifier = Modifier.size(16.dp))
                            Text("${loc.defaultPrice?.toInt() ?: basePrice.toInt()}", fontSize = 22.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            Text("/hr", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled)
                        }
                    }

                    // Advance
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("ADVANCE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            if ((loc.defaultAdvance ?: 0.0) > 0) {
                                Icon(Icons.Default.CurrencyRupee, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                                Text("${loc.defaultAdvance?.toInt()}", fontSize = 22.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                            } else {
                                Text("No prices yet", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                            }
                        }
                    }

                    HorizontalDivider(color = theme.colors.border)

                    // Hours
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(Icons.Default.AccessTime, null, tint = theme.colors.accent, modifier = Modifier.size(20.dp))
                        Text("${loc.open_hour ?: 6}:00 - ${loc.close_hour ?: 23}:00", fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textSecondary, letterSpacing = 1.sp)
                    }

                    // Contact
                    if (!loc.contact.isNullOrBlank()) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Icon(Icons.Default.Phone, null, tint = theme.colors.accent, modifier = Modifier.size(20.dp))
                            Text(loc.contact, fontSize = 12.sp, fontWeight = FontWeight.Black, color = theme.colors.textSecondary, letterSpacing = 1.sp)
                        }
                    }
                }
            }
        }

        // Location section
        item {
            Box(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(24.dp)
            ) {
                Column {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Place, null, tint = theme.colors.accent, modifier = Modifier.size(20.dp))
                            Text("LOCATION", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
                        }
                        val mapsUrl = if (loc.latitude != null && loc.longitude != null)
                            "https://www.google.com/maps?q=${loc.latitude},${loc.longitude}"
                        else
                            "https://www.google.com/maps?q=${URLEncoder.encode(loc.address, "UTF-8")}"
                        
                        Box(
                            modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(12.dp)).clickable {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(mapsUrl)))
                            }.padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("OPEN IN MAPS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textSecondary, letterSpacing = 1.sp)
                                Icon(Icons.Default.OpenInNew, null, tint = theme.colors.textSecondary, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Text(loc.address, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                    Spacer(Modifier.height(16.dp))
                    
                    // Real Maps WebView
                    val mapQuery = if (loc.latitude != null && loc.longitude != null)
                        "${loc.latitude},${loc.longitude}"
                    else
                        URLEncoder.encode(loc.address, "UTF-8")
                        
                    Box(
                        modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(20.dp)).border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))
                    ) {
                        AndroidView(
                            factory = { ctx ->
                                WebView(ctx).apply {
                                    layoutParams = ViewGroup.LayoutParams(
                                        ViewGroup.LayoutParams.MATCH_PARENT,
                                        ViewGroup.LayoutParams.MATCH_PARENT
                                    )
                                    webViewClient = WebViewClient()
                                    settings.javaScriptEnabled = true
                                    loadUrl("https://www.google.com/maps?q=$mapQuery&output=embed")
                                }
                            },
                            update = { webView ->
                                webView.loadUrl("https://www.google.com/maps?q=$mapQuery&output=embed")
                            }
                        )
                    }
                }
            }
        }

        // Booking info card (accent background)
        item {
            Box(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).clip(RoundedCornerShape(24.dp)).background(theme.colors.accent).padding(24.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Verified, null, tint = Color.White, modifier = Modifier.size(20.dp))
                        Text("BOOKING INFO", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 2.sp)
                    }
                    Text(
                        if (!loc.isOpen)
                            "This arena is currently closed for bookings. Please check back later."
                        else if (loc.advance_booking_required == true)
                            "Mandatory advance payment of ₹${loc.min_advance?.toInt() ?: 0} is required to secure your slot."
                        else
                            "Advance payment is optional. You can also choose to pay the full amount at the venue.",
                        fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(0.9f), lineHeight = 20.sp
                    )
                    Button(
                        onClick = { onBookNow?.invoke(loc) },
                        enabled = loc.isOpen,
                        modifier = Modifier.fillMaxWidth().height(56.dp).then(if (!loc.isOpen) Modifier.alpha(0.5f) else Modifier),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                        shape = RoundedCornerShape(16.dp),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp)
                    ) {
                        Text(if (loc.isOpen) "BOOK NOW" else "ARENA CLOSED", fontSize = 14.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp)
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }

    // Full screen image viewer
    ImageViewer(
        images = viewerConfig.second,
        initialIndex = viewerConfig.third,
        isOpen = viewerConfig.first,
        onClose = { viewerConfig = viewerConfig.copy(first = false) }
    )
}



