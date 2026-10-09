package com.boxitt.app.components

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.rememberAsyncImagePainter
import com.boxitt.app.UserProfile
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.GeocodingService
import com.boxitt.app.theme.vw
import com.boxitt.app.theme.clamp
import androidx.compose.ui.text.font.FontWeight
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(
    profile: UserProfile,
    onBack: () -> Unit,
    onSave: (UserProfile) -> Unit,
    onSkip: (() -> Unit)? = null,
    onChange: ((UserProfile) -> Unit)? = null,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    isSaving: Boolean = false,
    scope: CoroutineScope = rememberCoroutineScope()
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current

    // Helper to map profile to form state, matching web's mapProfileToForm
    fun mapProfileToForm(incoming: UserProfile): UserProfile {
        fun safeValue(vararg values: String?): String {
            for (v in values) {
                if (!v.isNullOrBlank() && v != "null" && v != "undefined") return v
            }
            return ""
        }

        val today = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE)

        return incoming.copy(
            username = safeValue(incoming.username, incoming.display_name),
            phone = safeValue(incoming.phone, incoming.phone_number),
            dob = safeValue(incoming.dob, incoming.date_of_birth),
            address = incoming.address ?: "",
            location = incoming.location ?: "",
            gender = incoming.gender ?: "",
            role = incoming.role ?: "user",
            profileImage = safeValue(incoming.profileImage, incoming.avatar_url),
            joinedDate = safeValue(incoming.joinedDate, incoming.joined_date).ifEmpty { today }
        )
    }

    // Local form state
    var form by remember(profile.id) {
        mutableStateOf(mapProfileToForm(profile))
    }

    // Sync form with profile prop when it changes (equivalent to web's useEffect)
    LaunchedEffect(profile) {
        val incoming = mapProfileToForm(profile)
        
        fun countFilled(p: UserProfile): Int {
            return listOf(p.username, p.phone, p.address, p.location, p.dob, p.gender, p.profileImage)
                .count { !it.isNullOrBlank() }
        }

        // If incoming profile has more data than current form, merge it
        if (countFilled(incoming) > countFilled(form)) {
            form = incoming
        }
    }

    var showOptions by remember { mutableStateOf(false) }
    var showCamera by remember { mutableStateOf(false) }
    var showDatePicker by remember { mutableStateOf(false) }
    var locating by remember { mutableStateOf(false) }
    var isVerifying by remember { mutableStateOf(false) }
    var uploading by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            // Trigger location fetch again if needed or just let user click again
        } else {
            onAlert?.invoke("Location permission denied", "error", null)
        }
    }

    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            // Check file size (2MB limit as per web)
            val size = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                cursor.moveToFirst()
                cursor.getLong(sizeIndex)
            } ?: 0L

            if (size > 2 * 1024 * 1024) {
                onAlert?.invoke("Image ${uri.lastPathSegment ?: "file"} too large (Max 2MB).", "error", null)
                return@rememberLauncherForActivityResult
            }

            val updated = form.copy(profileImage = uri.toString())
            form = updated
            onChange?.invoke(updated)
            showOptions = false
        }
    }

    // Exact web logic for isFormComplete (doesn't check location)
    val isFormComplete = listOf(
        form.email,
        form.username ?: "",
        form.phone ?: "",
        form.dob ?: "",
        form.gender ?: "",
        form.role ?: "",
        form.address ?: ""
    ).all { it.trim().isNotEmpty() } && (form.phone ?: "").trim().length == 10

    val scrollState = rememberScrollState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        // Background Decor
        Box(
            modifier = Modifier
                .offset(x = (-50).dp, y = (-50).dp)
                .size(300.dp)
                .blur(100.dp)
                .background(theme.colors.accent.copy(alpha = 0.2f), CircleShape)
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = 50.dp, y = 50.dp)
                .size(300.dp)
                .blur(100.dp)
                .background(theme.colors.success.copy(alpha = 0.2f), CircleShape)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(24.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier
                        .size(48.dp)
                        .background(theme.colors.backgroundSecondary, RoundedCornerShape(12.dp))
                        .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                ) {
                    Icon(imageVector = Icons.Default.ChevronLeft, contentDescription = null, tint = theme.colors.textPrimary)
                }
                Row {
                    Text(
                        text = "EDIT ",
                        style = TextStyle(
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black,
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            color = theme.colors.textPrimary
                        )
                    )
                    Text(
                        text = "PROFILE",
                        style = TextStyle(
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black,
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            color = theme.colors.accent
                        )
                    )
                }
                Box(modifier = Modifier.size(48.dp))
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Profile Image Section
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(modifier = Modifier.padding(8.dp)) {
                    Box(
                        modifier = Modifier
                            .size(140.dp)
                            .rotate(3f)
                            .clip(RoundedCornerShape(24.dp))
                            .background(theme.colors.backgroundSecondary)
                            .border(4.dp, theme.colors.border, RoundedCornerShape(24.dp))
                            .clickable { showOptions = true },
                        contentAlignment = Alignment.Center
                    ) {
                        if (uploading) {
                            CircularProgressIndicator(color = theme.colors.accent, modifier = Modifier.size(32.dp))
                        } else if (!form.profileImage.isNullOrEmpty()) {
                            Image(
                                painter = rememberAsyncImagePainter(form.profileImage),
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = theme.colors.textDisabled,
                                modifier = Modifier.size(64.dp)
                            )
                        }
                    }

                    IconButton(
                        onClick = { showOptions = true },
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .offset(x = 8.dp, y = 8.dp)
                            .size(40.dp)
                            .background(theme.colors.accent, RoundedCornerShape(12.dp))
                            .border(2.dp, theme.colors.card, RoundedCornerShape(12.dp))
                    ) {
                        Icon(imageVector = Icons.Default.CameraAlt, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                    }

                    if (!form.profileImage.isNullOrEmpty()) {
                        IconButton(
                            onClick = {
                                val updated = form.copy(profileImage = "")
                                form = updated
                                onChange?.invoke(updated)
                            },
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .offset(x = (-8).dp, y = 8.dp)
                                .size(40.dp)
                                .background(theme.colors.error, RoundedCornerShape(12.dp))
                                .border(2.dp, theme.colors.card, RoundedCornerShape(12.dp))
                        ) {
                            Icon(imageVector = Icons.Default.Delete, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "UPDATE PROFILE PICTURE",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp,
                    color = theme.colors.accent,
                    modifier = Modifier.clickable { showOptions = true }
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Form Fields
            Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                // Email (Editable as per web)
                FormField(label = "EMAIL ADDRESS") {
                    CustomTextField(
                        value = form.email,
                        onValueChange = {
                            val updated = form.copy(email = it)
                            form = updated
                            onChange?.invoke(updated)
                        },
                        icon = Icons.Default.Mail,
                        keyboardType = androidx.compose.ui.text.input.KeyboardType.Email
                    )
                }

                // Username
                FormField(label = "USERNAME") {
                    CustomTextField(
                        value = form.username ?: "",
                        onValueChange = {
                            val updated = form.copy(username = it)
                            form = updated
                            onChange?.invoke(updated)
                        },
                        icon = Icons.Default.Person
                    )
                }

                // Phone
                FormField(label = "PHONE NUMBER") {
                    CustomTextField(
                        value = form.phone ?: "",
                        onValueChange = {
                            val filtered = it.replace(Regex("\\D"), "").take(10)
                            val updated = form.copy(phone = filtered)
                            form = updated
                            onChange?.invoke(updated)
                        },
                        icon = Icons.Default.Phone,
                        keyboardType = androidx.compose.ui.text.input.KeyboardType.Phone
                    )
                }

                // DOB
                FormField(label = "DATE OF BIRTH") {
                    ClickableField(
                        value = form.dob?.ifEmpty { "Select Date" } ?: "Select Date",
                        onClick = { showDatePicker = true },
                        icon = Icons.Default.CalendarToday
                    )
                }

                // Gender & Role
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    FormField(label = "GENDER", modifier = Modifier.weight(1f)) {
                        GenderDropdown(
                            selected = form.gender ?: "",
                            onSelected = {
                                val updated = form.copy(gender = it)
                                form = updated
                                onChange?.invoke(updated)
                            }
                        )
                    }
                    FormField(label = "ACCOUNT ROLE", modifier = Modifier.weight(1f)) {
                        RoleDropdown(
                            selected = form.role ?: "user",
                            onSelected = {
                                val updated = form.copy(role = it)
                                form = updated
                                onChange?.invoke(updated)
                            }
                        )
                    }
                }

                // Address
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("CURRENT ADDRESS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                        Row(
                            modifier = Modifier.clickable(enabled = !locating) {
                                if (androidx.core.app.ActivityCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                                    permissionLauncher.launch(android.Manifest.permission.ACCESS_FINE_LOCATION)
                                    return@clickable
                                }
                                locating = true
                                try {
                                    val fusedLocationClient = com.google.android.gms.location.LocationServices.getFusedLocationProviderClient(context)
                                    fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token).addOnSuccessListener { loc ->
                                        if (loc != null) {
                                            scope.launch {
                                                val result = GeocodingService.reverseGeocode(loc.latitude, loc.longitude)
                                                if (result != null) {
                                                    val updated = form.copy(address = result.first, location = result.second)
                                                    form = updated
                                                    onChange?.invoke(updated)
                                                }
                                                locating = false
                                            }
                                        } else {
                                            // Fallback to lastLocation if getCurrentLocation is null (rare but possible)
                                            fusedLocationClient.lastLocation.addOnSuccessListener { lastLoc ->
                                                if (lastLoc != null) {
                                                    scope.launch {
                                                        val result = GeocodingService.reverseGeocode(lastLoc.latitude, lastLoc.longitude)
                                                        if (result != null) {
                                                            val updated = form.copy(address = result.first, location = result.second)
                                                            form = updated
                                                            onChange?.invoke(updated)
                                                        }
                                                        locating = false
                                                    }
                                                } else {
                                                    locating = false
                                                    onAlert?.invoke("Could not get current location. Please check if GPS is enabled in settings.", "error", null)
                                                }
                                            }
                                        }
                                    }.addOnFailureListener {
                                        locating = false
                                        onAlert?.invoke("Failed to get location. Ensure GPS is active.", "error", null)
                                    }
                                } catch (e: Exception) {
                                    locating = false
                                }
                            },
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            if (locating) {
                                CircularProgressIndicator(color = theme.colors.accent, modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp)), strokeWidth = 2.dp)
                            } else {
                                Icon(imageVector = Icons.Default.Place, contentDescription = null, tint = theme.colors.accent, modifier = Modifier.size(14.dp))
                            }
                            Text(
                                text = if (locating) "GPS..." else "USE CURRENT LOCATION",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.accent,
                                letterSpacing = 1.sp
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = form.address ?: "",
                        onValueChange = {
                            val updated = form.copy(address = it)
                            form = updated
                            onChange?.invoke(updated)
                        },
                        modifier = Modifier.fillMaxWidth().height(120.dp),
                        shape = RoundedCornerShape(20.dp),
                        trailingIcon = {
                            IconButton(
                                onClick = {
                                    scope.launch {
                                        if (form.address.isNullOrBlank() || isVerifying) return@launch
                                        isVerifying = true
                                        try {
                                            val coords = GeocodingService.getCoordinates(form.address!!, form.location ?: "")
                                            if (coords != null) {
                                                val result = GeocodingService.reverseGeocode(coords.latitude, coords.longitude)
                                                if (result != null) {
                                                    val updated = form.copy(address = result.first, location = result.second)
                                                    form = updated
                                                    onChange?.invoke(updated)
                                                    onAlert?.invoke("Location verified!", "success", null)
                                                }
                                            } else {
                                                onAlert?.invoke("No matching location found.", "error", null)
                                            }
                                        } catch (e: Exception) {
                                            onAlert?.invoke("Search failed.", "error", null)
                                        } finally {
                                            isVerifying = false
                                        }
                                    }
                                },
                                enabled = !isVerifying && !locating
                            ) {
                                if (isVerifying) {
                                    CircularProgressIndicator(color = theme.colors.accent, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                                } else {
                                    Icon(Icons.Default.Search, null, tint = theme.colors.accent)
                                }
                            }
                        },
                        colors = TextFieldDefaults.outlinedTextFieldColors(
                            containerColor = theme.colors.backgroundSecondary,
                            focusedBorderColor = Color.Transparent,
                            unfocusedBorderColor = Color.Transparent
                        ),
                        placeholder = { Text("Address...", color = theme.colors.textDisabled, fontSize = 14.sp) },
                        textStyle = TextStyle(fontWeight = FontWeight.Bold, fontSize = 15.sp, color = theme.colors.textPrimary)
                    )
                }
            }

            Spacer(modifier = Modifier.height(40.dp))

            // Save Button
            LoadingButton(
                onClick = {
                    if (!isFormComplete) {
                        onAlert?.invoke("Fill all the fields", "error", null)
                        return@LoadingButton
                    }
                    onSave(form)
                },
                loading = isSaving,
                text = "SAVE CHANGES",
                loadingText = "Saving...",
                gradient = listOf(theme.colors.buttonGradient[0], theme.colors.buttonGradient[1]),
                icon = { Icon(Icons.Default.CheckCircle, null, tint = Color.White) }
            )

            if (onSkip != null) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "SKIP",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textDisabled,
                    letterSpacing = 1.sp,
                    modifier = Modifier
                        .clickable { onSkip() }
                        .align(Alignment.CenterHorizontally)
                        .padding(vertical = 8.dp)
                )
            }

            Spacer(modifier = Modifier.height(40.dp))
        }

        // Image Selection Dialog
        if (showOptions) {
            AlertDialog(
                onDismissRequest = { showOptions = false },
                modifier = Modifier
                    .background(theme.colors.card, RoundedCornerShape(32.dp))
                    .border(1.dp, theme.colors.border, RoundedCornerShape(32.dp)),
                properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
            ) {
                Column(
                    modifier = Modifier.padding(32.dp).fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "SELECT SOURCE",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                        color = theme.colors.textPrimary
                    )
                    Spacer(modifier = Modifier.height(32.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        SourceOption(
                            icon = Icons.Default.CameraAlt,
                            label = "CAMERA",
                            color = theme.colors.accent,
                            onClick = {
                                showOptions = false
                                showCamera = true
                            },
                            modifier = Modifier.weight(1f)
                        )
                        SourceOption(
                            icon = Icons.Default.Image,
                            label = "GALLERY",
                            color = theme.colors.success,
                            onClick = { galleryLauncher.launch("image/*") },
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                    TextButton(onClick = { showOptions = false }) {
                        Text("CANCEL", fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                    }
                }
            }
        }

        // Camera Modal
        if (showCamera) {
            CameraCaptureModal(
                onCapture = { uri ->
                    val updated = form.copy(profileImage = uri.toString())
                    form = updated
                    onChange?.invoke(updated)
                    showCamera = false
                },
                onClose = { showCamera = false }
            )
        }

        // Date Picker Modal
        DatePickerModal(
            isOpen = showDatePicker,
            onClose = { showDatePicker = false },
            selectedDate = form.dob ?: "",
            onSelect = {
                val updated = form.copy(dob = it)
                form = updated
                onChange?.invoke(updated)
            },
            maxDate = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE)
        )
    }
}

@Composable
fun FormField(label: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val theme = LocalAppTheme.current
    Column(modifier = modifier) {
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp, modifier = Modifier.padding(start = 4.dp))
        Spacer(modifier = Modifier.height(8.dp))
        content()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomTextField(
    value: String,
    onValueChange: (String) -> Unit,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    keyboardType: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text
) {
    val theme = LocalAppTheme.current
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        leadingIcon = { Icon(icon, null, tint = theme.colors.textPrimary, modifier = Modifier.size(20.dp).alpha(0.3f)) },
        colors = TextFieldDefaults.outlinedTextFieldColors(
            containerColor = theme.colors.backgroundSecondary,
            focusedBorderColor = Color.Transparent,
            unfocusedBorderColor = Color.Transparent
        ),
        textStyle = TextStyle(fontWeight = FontWeight.Bold, fontSize = 15.sp, color = theme.colors.textPrimary),
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
        singleLine = true
    )
}

@Composable
fun ClickableField(value: String, onClick: () -> Unit, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    val theme = LocalAppTheme.current
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .background(theme.colors.backgroundSecondary, RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = theme.colors.textPrimary, modifier = Modifier.size(20.dp).alpha(0.3f))
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                value, 
                color = theme.colors.textPrimary, 
                fontWeight = FontWeight.Bold, 
                fontSize = if (value.length > 25) 13.sp else 15.sp,
                lineHeight = 18.sp
            )
        }
    }
}

@Composable
fun GenderDropdown(selected: String, onSelected: (String) -> Unit) {
    val theme = LocalAppTheme.current
    var expanded by remember { mutableStateOf(false) }
    Box {
        ClickableField(value = selected.ifEmpty { "Select" }, onClick = { expanded = true }, icon = Icons.Default.Transgender)
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.background(theme.colors.card)) {
            listOf("Male", "Female", "Other").forEach {
                DropdownMenuItem(
                    text = { Text(it, fontWeight = FontWeight.Bold) },
                    onClick = {
                        onSelected(it)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
fun RoleDropdown(selected: String, onSelected: (String) -> Unit) {
    val theme = LocalAppTheme.current
    var expanded by remember { mutableStateOf(false) }
    Box {
        ClickableField(value = selected.uppercase(), onClick = { expanded = true }, icon = Icons.Default.Shield)
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.background(theme.colors.card)) {
            listOf("user", "admin", "superadmin").forEach {
                DropdownMenuItem(
                    text = { Text(it.uppercase(), fontWeight = FontWeight.Bold) },
                    onClick = {
                        onSelected(it)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
fun SourceOption(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, color: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val theme = LocalAppTheme.current
    Column(
        modifier = modifier
            .background(theme.colors.backgroundSecondary, RoundedCornerShape(24.dp))
            .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
            .clickable { onClick() }
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(32.dp))
        Spacer(modifier = Modifier.height(12.dp))
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
    }
}
