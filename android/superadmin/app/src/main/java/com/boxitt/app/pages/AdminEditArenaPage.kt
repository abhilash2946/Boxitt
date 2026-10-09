package com.boxitt.app.pages

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import com.boxitt.app.Location
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.GeocodingService
import com.boxitt.app.services.LocationService
import com.boxitt.app.theme.vw
import com.boxitt.app.theme.clamp
import kotlinx.coroutines.launch

@Composable
fun AdminEditArenaPage(
    arenaId: String,
    onBack: () -> Unit,
    onSaved: ((String) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()

    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var isVerifying by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    // Form fields
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var contact by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var rating by remember { mutableStateOf("") }
    var minAdvance by remember { mutableStateOf("") }
    var numberOfCourts by remember { mutableStateOf("1") }
    var advanceRequired by remember { mutableStateOf(false) }

    var latitude by remember { mutableStateOf<Double?>(null) }
    var longitude by remember { mutableStateOf<Double?>(null) }

    // Auto-geocode address changes
    LaunchedEffect(address) {
        if (address.isBlank()) return@LaunchedEffect
        kotlinx.coroutines.delay(1500) // Debounce
        
        // Only auto-geocode if coordinates are missing or if we want to force refresh on address change
        if (latitude == null || latitude == 0.0) {
            try {
                val coords = GeocodingService.getCoordinates(address, "")
                if (coords != null) {
                    latitude = coords.latitude
                    longitude = coords.longitude
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    LaunchedEffect(arenaId) {
        loading = true
        try {
            val loc = LocationService.getLocationById(arenaId)
            if (loc != null) {
                name = loc.name
                description = loc.description ?: ""
                address = loc.address
                contact = loc.contact ?: ""
                email = loc.email ?: ""
                rating = if (loc.rating == 0.0) "" else loc.rating?.toString() ?: ""
                minAdvance = if (loc.minAdvance == 0.0) "" else loc.minAdvance?.toString() ?: ""
                numberOfCourts = loc.numberOfCourts.toString()
                advanceRequired = loc.advanceBookingRequired ?: false
                latitude = loc.latitude
                longitude = loc.longitude
            }
        } catch (e: Exception) {
            errorMsg = e.message
        } finally {
            loading = false
        }
    }

    fun handleSubmit() {
        if (name.isBlank()) {
            errorMsg = "Arena Name is required"
            return
        }
        if (address.isBlank()) {
            errorMsg = "Address is required"
            return
        }

        saving = true
        scope.launch {
            try {
                LocationService.updateLocation(arenaId, mapOf(
                    "name" to name,
                    "description" to description,
                    "address" to address,
                    "contact" to contact,
                    "email" to email,
                    "rating" to (rating.toDoubleOrNull() ?: 0.0).coerceIn(0.0, 5.0),
                    "minAdvance" to (minAdvance.toDoubleOrNull() ?: 0.0),
                    "numberOfCourts" to (numberOfCourts.toIntOrNull() ?: 1).coerceIn(1, 10),
                    "advanceBookingRequired" to advanceRequired,
                    "latitude" to (latitude ?: 0.0),
                    "longitude" to (longitude ?: 0.0)
                ))
                onSaved?.invoke(arenaId)
            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to save changes"
            } finally {
                saving = false
            }
        }
    }

    if (loading) {
        Box(modifier = Modifier.fillMaxSize().background(theme.colors.background), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = theme.colors.accent)
                Spacer(Modifier.height(12.dp))
                Text("LOADING EDITOR...", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textSecondary, letterSpacing = 3.sp)
            }
        }
        return
    }

    Column(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        // Sticky top bar
        Box(modifier = Modifier.fillMaxWidth().background(theme.colors.background.copy(0.8f)).padding(horizontal = 16.dp, vertical = 12.dp)) {
            // Bottom border line
            Box(modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(1.dp).background(theme.colors.border))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack, modifier = Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(14.dp))) {
                    Icon(Icons.Default.ChevronLeft, null, tint = theme.colors.textPrimary)
                }
                Text("EDIT ARENA DETAILS", fontSize = 18.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic, letterSpacing = (-0.5).sp)
                Box(modifier = Modifier.size(44.dp)) // Spacer
            }
        }

        Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(32.dp)) {

            // === Section: Basic Info ===
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.Info, null, tint = theme.colors.textDisabled, modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp)))
                    Text("BASIC INFO", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                }
                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(20.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Column {
                            Text("ARENA NAME", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(6.dp))
                            OutlinedTextField(value = name, onValueChange = { name = it }, placeholder = { Text("e.g. Lords Cricket Box", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                        }
                        Column {
                            Text("DESCRIPTION", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(6.dp))
                            OutlinedTextField(value = description, onValueChange = { description = it }, placeholder = { Text("Tell players about your arena...", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                        }
                    }
                }
            }

            // === Section: Location & Contact ===
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.LocationOn, null, tint = theme.colors.textDisabled, modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp)))
                    Text("LOCATION & CONTACT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                }
                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(20.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Column {
                            Text("ADDRESS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(6.dp))
                            OutlinedTextField(
                                value = address,
                                onValueChange = { address = it },
                                placeholder = { Text("Full physical address", color = theme.colors.textDisabled) },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                trailingIcon = {
                                    IconButton(
                                        onClick = {
                                            if (address.isBlank() || isVerifying) return@IconButton
                                            isVerifying = true
                                            scope.launch {
                                                try {
                                                    val coords = GeocodingService.getCoordinates(address, "")
                                                    if (coords != null) {
                                                        latitude = coords.latitude
                                                        longitude = coords.longitude
                                                        val result = GeocodingService.reverseGeocode(coords.latitude, coords.longitude)
                                                        if (result != null) {
                                                            address = result.first
                                                        }
                                                    }
                                                } catch (e: Exception) { e.printStackTrace() } finally {
                                                    isVerifying = false
                                                }
                                            }
                                        },
                                        enabled = !isVerifying && !saving
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
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("CONTACT NUMBER", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                Spacer(Modifier.height(6.dp))
                                OutlinedTextField(value = contact, onValueChange = { contact = it }, placeholder = { Text("Mobile number", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("EMAIL ADDRESS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                Spacer(Modifier.height(6.dp))
                                OutlinedTextField(value = email, onValueChange = { email = it }, placeholder = { Text("Support email", color = theme.colors.textDisabled) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary))
                            }
                        }
                    }
                }
            }

            // === Section: GPS Coordinates ===
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Default.Place, null, tint = theme.colors.textDisabled, modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp)))
                        Text("GPS COORDINATES", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                    }
                    TextButton(onClick = { 
                        // Force geocode now
                        scope.launch {
                            val coords = GeocodingService.getCoordinates(address, "")
                            if (coords != null) {
                                latitude = coords.latitude
                                longitude = coords.longitude
                            }
                        }
                    }) {
                        Text("FETCH FROM ADDRESS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                    }
                }
                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(20.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("LATITUDE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(6.dp))
                            OutlinedTextField(value = latitude?.toString() ?: "", onValueChange = { latitude = it.toDoubleOrNull() }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text("LONGITUDE", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                            Spacer(Modifier.height(6.dp))
                            OutlinedTextField(value = longitude?.toString() ?: "", onValueChange = { longitude = it.toDoubleOrNull() }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                        }
                    }
                }
            }

            // === Section: Operation & Pricing ===
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.Schedule, null, tint = theme.colors.textDisabled, modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp)))
                    Text("OPERATION & PRICING", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                }
                Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(20.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("DISPLAY RATING (0-5)", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                Spacer(Modifier.height(6.dp))
                                OutlinedTextField(value = rating, onValueChange = { rating = it }, leadingIcon = { Icon(Icons.Default.Star, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp)) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("BASE PRICE (₹)", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                Spacer(Modifier.height(6.dp))
                                OutlinedTextField(value = minAdvance, onValueChange = { minAdvance = it }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            }
                        }
                        
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("NUMBER OF COURTS", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                Spacer(Modifier.height(6.dp))
                                OutlinedTextField(value = numberOfCourts, onValueChange = { numberOfCourts = it }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = theme.colors.accent, unfocusedBorderColor = Color.Transparent, unfocusedContainerColor = theme.colors.backgroundSecondary, focusedContainerColor = theme.colors.backgroundSecondary, focusedTextColor = theme.colors.textPrimary, unfocusedTextColor = theme.colors.textPrimary), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            }
                            Spacer(Modifier.weight(1f))
                        }
                        // Advance booking toggle
                        Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(theme.colors.backgroundSecondary).border(1.dp, theme.colors.border, RoundedCornerShape(16.dp)).padding(16.dp)) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Icon(Icons.Default.Shield, null, tint = theme.colors.accent, modifier = Modifier.size(18.dp))
                                        Text("ADVANCE BOOKING REQUIRED", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, letterSpacing = 1.sp)
                                    }
                                    Switch(checked = advanceRequired, onCheckedChange = { advanceRequired = it }, colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = theme.colors.accent))
                                }
                                Text("WHEN ENABLED, USERS MUST PAY THE ADVANCE AMOUNT TO CONFIRM THEIR BOOKING ONLINE.", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                            }
                        }
                    }
                }
            }

            // Save button
            Button(
                onClick = { handleSubmit() },
                enabled = !saving && !isVerifying,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                shape = RoundedCornerShape(18.dp)
            ) {
                if (saving) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
                else {
                    Icon(Icons.Default.Save, null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("SAVE CHANGES", fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                }
            }
        }
    }

    // Error dialog
    if (errorMsg != null) {
        Dialog(onDismissRequest = { errorMsg = null }) {
            Box(modifier = Modifier.clip(RoundedCornerShape(24.dp)).background(theme.colors.card).border(1.dp, theme.colors.border, RoundedCornerShape(24.dp)).padding(28.dp)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)).background(theme.colors.error).padding(14.dp), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Cancel, null, tint = Color.White, modifier = Modifier.size(36.dp))
                    }
                    Spacer(Modifier.height(16.dp))
                    Text("ERROR", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic, letterSpacing = (-0.5).sp)
                    Spacer(Modifier.height(12.dp))
                    Text(errorMsg ?: "", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = theme.colors.textSecondary, lineHeight = 18.sp)
                    Spacer(Modifier.height(20.dp))
                    Button(onClick = { errorMsg = null }, modifier = Modifier.fillMaxWidth().height(48.dp), colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent), shape = RoundedCornerShape(14.dp)) {
                        Text("CONFIRM", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                    }
                }
            }
        }
    }
}



