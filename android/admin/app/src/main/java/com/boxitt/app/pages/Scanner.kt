package com.boxitt.app.pages

import android.Manifest
import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import com.boxitt.app.components.PermissionPrompt
import com.boxitt.app.contexts.PermissionType
import com.boxitt.app.contexts.PermissionsManager
import com.boxitt.app.contexts.LocalPermissionsState
import androidx.compose.animation.core.*
import androidx.compose.ui.graphics.StrokeCap
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.theme.vw
import com.boxitt.app.theme.clamp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.boxitt.app.Booking
import com.boxitt.app.BookingStatus
import com.boxitt.app.services.BookingService
import com.boxitt.app.services.ChallengeDetails
import com.boxitt.app.services.Storage
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

enum class ScannerState { IDLE, SCANNING, RESULT }

@Serializable
data class ScannerPageState(
    val bookingInfo: Booking? = null,
    val challengeInfo: ChallengeDetails? = null
)

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun Scanner(
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    val PAGE_ID = "scanner"

    var scannerState by remember { mutableStateOf(ScannerState.IDLE) }
    var loading by remember { mutableStateOf(false) }
    var bookingInfo by remember { mutableStateOf<Booking?>(null) }
    var challengeInfo by remember { mutableStateOf<ChallengeDetails?>(null) }
    var hasJustConfirmed by remember { mutableStateOf(false) }
    var hasCameraPermission by remember { mutableStateOf(false) }
    var cameraProviderInstance by remember { mutableStateOf<ProcessCameraProvider?>(null) }

    // Restore state
    LaunchedEffect(Unit) {
        val saved = Storage.getPageState<ScannerPageState>(PAGE_ID)
        if (saved != null) {
            bookingInfo = saved.bookingInfo
            challengeInfo = saved.challengeInfo
            if (bookingInfo != null || challengeInfo != null) {
                scannerState = ScannerState.RESULT
            }
        }
    }

    LaunchedEffect(bookingInfo, challengeInfo) {
        Storage.setPageState(PAGE_ID, ScannerPageState(bookingInfo, challengeInfo))
    }

    val permissionsState = LocalPermissionsState.current

    // Sync hasCameraPermission with system state
    LaunchedEffect(permissionsState) {
        hasCameraPermission = PermissionsManager.hasSystemPermission(context, PermissionType.CAMERA)
    }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasCameraPermission = granted
        if (granted) {
            PermissionsManager.handleChoice(PermissionType.CAMERA, "allow")
            scannerState = ScannerState.SCANNING
        } else {
            PermissionsManager.handleChoice(PermissionType.CAMERA, "later")
            onAlert?.invoke("Camera permission denied", "error", null)
        }
    }

    val imagePickerLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            scope.launch {
                try {
                    val stream = context.contentResolver.openInputStream(uri)
                    val bitmap = BitmapFactory.decodeStream(stream)
                    val image = InputImage.fromBitmap(bitmap, 0)
                    val scanner = BarcodeScanning.getClient()
                    scanner.process(image)
                        .addOnSuccessListener { barcodes ->
                            val code = barcodes.firstOrNull { it.valueType == Barcode.TYPE_TEXT || it.rawValue != null }
                            if (code?.rawValue != null) {
                                val id = extractId(code.rawValue!!)
                                scope.launch { 
                                    loading = true
                                    scannerState = ScannerState.IDLE
                                    hasJustConfirmed = false
                                    handleScanResult(id, onAlert) { b, c -> 
                                        bookingInfo = b; 
                                        challengeInfo = c; 
                                        scannerState = ScannerState.RESULT 
                                    } 
                                    loading = false
                                }
                            } else {
                                onAlert?.invoke("No QR code found", "error", null)
                            }
                        }
                        .addOnFailureListener { onAlert?.invoke("Error reading QR", "error", null) }
                } catch (e: Exception) {
                    onAlert?.invoke(e.message ?: "Error reading file", "error", null)
                }
            }
        }
    }

    val isValidStatus = (bookingInfo != null && (bookingInfo?.status == BookingStatus.APPROVED || bookingInfo?.status == BookingStatus.COMPLETED)) ||
                        (challengeInfo != null && (challengeInfo?.status == "confirmed" || challengeInfo?.status == "completed"))

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        // Background Decor
        Canvas(modifier = Modifier.fillMaxSize().blur(120.dp).offset(x = (-50).dp, y = (-50).dp)) {
            drawCircle(
                color = theme.colors.accent.copy(alpha = 0.2f),
                radius = size.minDimension * 0.35f,
                center = androidx.compose.ui.geometry.Offset(0f, 0f)
            )
        }
        Canvas(modifier = Modifier.fillMaxSize().blur(120.dp).offset(x = 50.dp, y = 50.dp)) {
            drawCircle(
                color = theme.colors.success.copy(alpha = 0.2f),
                radius = size.minDimension * 0.35f,
                center = androidx.compose.ui.geometry.Offset(size.width, size.height)
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Scanner card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(40.dp))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(40.dp))
            ) {
                Column {
                    // Header
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                buildAnnotatedString {
                                    append("Ticket ")
                                    withStyle(style = SpanStyle(color = theme.colors.accent)) {
                                        append("Scanner")
                                    }
                                },
                                fontSize = 32.sp,
                                fontWeight = FontWeight.Black,
                                fontStyle = FontStyle.Italic,
                                color = theme.colors.textPrimary,
                                letterSpacing = (-1).sp
                            )
                            Spacer(Modifier.height(8.dp))
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(Color.White.copy(0.05f))
                                    .border(1.dp, Color.White.copy(0.05f), RoundedCornerShape(20.dp))
                                    .padding(horizontal = 16.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.FlashOn, null, tint = theme.colors.accent, modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp)))
                                Text("VERIFICATION", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 4.sp)
                            }
                        }
                    }

                    Divider(color = theme.colors.border.copy(0.4f))

                    // Body
                    Box(modifier = Modifier.padding(24.dp)) {
                        AnimatedContent(targetState = scannerState, transitionSpec = { fadeIn() with fadeOut() }) { state ->
                            when (state) {
                                ScannerState.IDLE -> {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        // QR preview placeholder
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .aspectRatio(1f)
                                                .clip(RoundedCornerShape(32.dp))
                                                .background(Color.White.copy(0.05f))
                                                .border(1.dp, theme.colors.border, RoundedCornerShape(32.dp))
                                                .clickable {
                                                    if (hasCameraPermission) scannerState = ScannerState.SCANNING
                                                    else permissionLauncher.launch(Manifest.permission.CAMERA)
                                                }
                                                .padding(24.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(96.dp)
                                                        .clip(RoundedCornerShape(24.dp))
                                                        .background(theme.colors.accent),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(Icons.Default.QrCode, null, tint = Color.White, modifier = Modifier.size(48.dp))
                                                }
                                                Spacer(Modifier.height(16.dp))
                                                Text("SCANNER READY", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                                            }
                                        }

                                        Spacer(Modifier.height(20.dp))

                                        Button(
                                            onClick = {
                                                if (hasCameraPermission) {
                                                    scannerState = ScannerState.SCANNING
                                                } else {
                                                    val canPrompt = PermissionsManager.checkAndPrompt(context, PermissionType.CAMERA, force = true)
                                                    if (!canPrompt) {
                                                        // Show custom prompt or wait for user to click "Allow" in our prompt
                                                    } else {
                                                        permissionLauncher.launch(Manifest.permission.CAMERA)
                                                    }
                                                }
                                            },
                                            modifier = Modifier.fillMaxWidth().height(64.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                                            shape = RoundedCornerShape(24.dp)
                                        ) {
                                            Icon(Icons.Default.CameraAlt, null, modifier = Modifier.size(18.dp))
                                            Spacer(Modifier.width(8.dp))
                                            Text("START SCANNING", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                        }

                                        Spacer(Modifier.height(12.dp))

                                        OutlinedButton(
                                            onClick = { imagePickerLauncher.launch("image/*") },
                                            modifier = Modifier.fillMaxWidth().height(56.dp),
                                            shape = RoundedCornerShape(24.dp),
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = theme.colors.textSecondary),
                                            border = ButtonDefaults.outlinedButtonBorder.copy(brush = Brush.linearGradient(listOf(theme.colors.border, theme.colors.border.copy(0.5f))))
                                        ) {
                                            Icon(Icons.Default.Upload, null, modifier = Modifier.size(18.dp))
                                            Spacer(Modifier.width(8.dp))
                                            Text("UPLOAD TICKET", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                        }
                                    }
                                }

                                ScannerState.SCANNING -> {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .aspectRatio(1f)
                                                .clip(RoundedCornerShape(32.dp))
                                                .background(Color.Black)
                                                .border(1.dp, theme.colors.border, RoundedCornerShape(32.dp))
                                        ) {
                                            // Camera preview
                                            AndroidView(
                                                factory = { ctx ->
                                                    val previewView = PreviewView(ctx)
                                                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                                                    cameraProviderFuture.addListener({
                                                        val provider = cameraProviderFuture.get()
                                                        cameraProviderInstance = provider
                                                        val preview = Preview.Builder().build().also {
                                                            it.setSurfaceProvider(previewView.surfaceProvider)
                                                        }
                                                        val barcodeScanner = BarcodeScanning.getClient()
                                                        val analysis = ImageAnalysis.Builder()
                                                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                                            .build()
                                                        analysis.setAnalyzer(ContextCompat.getMainExecutor(ctx)) { imageProxy ->
                                                            val mediaImage = imageProxy.image
                                                            if (mediaImage != null) {
                                                                val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                                                                barcodeScanner.process(inputImage)
                                                                    .addOnSuccessListener { barcodes ->
                                                                        val code = barcodes.firstOrNull { it.rawValue != null }
                                                                        if (code?.rawValue != null) {
                                                                            provider.unbindAll()
                                                                            val id = extractId(code.rawValue!!)
                                                                            scope.launch {
                                                                                loading = true
                                                                                hasJustConfirmed = false
                                                                                scannerState = ScannerState.IDLE
                                                                                handleScanResult(id, onAlert) { b, c ->
                                                                                    bookingInfo = b
                                                                                    challengeInfo = c
                                                                                    scannerState = ScannerState.RESULT
                                                                                }
                                                                                loading = false
                                                                            }
                                                                        }
                                                                    }
                                                                    .addOnCompleteListener { imageProxy.close() }
                                                            } else {
                                                                imageProxy.close()
                                                            }
                                                        }
                                                        provider.unbindAll()
                                                        provider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
                                                    }, ContextCompat.getMainExecutor(ctx))
                                                    previewView
                                                },
                                                modifier = Modifier.fillMaxSize()
                                            )

                                            // Corner guides
                                            val cornerColor = theme.colors.accent
                                            Box(modifier = Modifier.fillMaxSize().padding(32.dp)) {
                                                // Top-left
                                                Box(modifier = Modifier.size(40.dp).align(Alignment.TopStart).border(width = 4.dp, color = cornerColor, shape = RoundedCornerShape(topStart = 16.dp)))
                                                // Top-right
                                                Box(modifier = Modifier.size(40.dp).align(Alignment.TopEnd).border(width = 4.dp, color = cornerColor, shape = RoundedCornerShape(topEnd = 16.dp)))
                                                // Bottom-left
                                                Box(modifier = Modifier.size(40.dp).align(Alignment.BottomStart).border(width = 4.dp, color = cornerColor, shape = RoundedCornerShape(bottomStart = 16.dp)))
                                                // Bottom-right
                                                Box(modifier = Modifier.size(40.dp).align(Alignment.BottomEnd).border(width = 4.dp, color = cornerColor, shape = RoundedCornerShape(bottomEnd = 16.dp)))

                                                // Moving scan line
                                                val infiniteTransition = rememberInfiniteTransition()
                                                val scanPosition by infiniteTransition.animateFloat(
                                                    initialValue = 0.25f,
                                                    targetValue = 0.75f,
                                                    animationSpec = infiniteRepeatable(
                                                        animation = tween(2500, easing = LinearEasing),
                                                        repeatMode = RepeatMode.Reverse
                                                    )
                                                )

                                                Canvas(modifier = Modifier.fillMaxSize().padding(12.dp)) {
                                                    val y = size.height * scanPosition
                                                    drawLine(
                                                        color = cornerColor,
                                                        start = androidx.compose.ui.geometry.Offset(x = 12.dp.toPx(), y = y),
                                                        end = androidx.compose.ui.geometry.Offset(x = size.width - 12.dp.toPx(), y = y),
                                                        strokeWidth = 2.dp.toPx(),
                                                        cap = StrokeCap.Round
                                                    )
                                                }
                                            }

                                            // Status chip
                                            Box(
                                                modifier = Modifier
                                                    .align(Alignment.BottomCenter)
                                                    .padding(bottom = 24.dp)
                                                    .clip(RoundedCornerShape(12.dp))
                                                    .background(theme.colors.accent)
                                                    .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                                                    .padding(horizontal = 24.dp, vertical = 10.dp)
                                            ) {
                                                Text("ALIGN QR CODE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 2.sp)
                                            }
                                        }

                                        Spacer(Modifier.height(24.dp))

                                        OutlinedButton(
                                            onClick = {
                                                cameraProviderInstance?.unbindAll()
                                                scannerState = ScannerState.IDLE
                                            },
                                            shape = RoundedCornerShape(20.dp),
                                            colors = ButtonDefaults.outlinedButtonColors(
                                                containerColor = Color.Red.copy(alpha = 0.1f),
                                                contentColor = Color.Red
                                            ),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, Color.Red.copy(alpha = 0.2f)),
                                            modifier = Modifier.padding(horizontal = 32.dp, vertical = 8.dp)
                                        ) {
                                            Text("CANCEL SCAN", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                                        }
                                    }
                                }

                                ScannerState.RESULT -> {
                                    val bi = bookingInfo
                                    val ci = challengeInfo
                                    
                                    val playerName = bi?.name ?: ci?.challenger?.let { it.username ?: it.display_name } ?: "Player"
                                    val opponentName = ci?.acceptor?.let { it.username ?: it.display_name }
                                    val slotTime = bi?.slotTime ?: ci?.slotTime ?: ""
                                    
                                    val isValid = (bi != null && (bi.status == BookingStatus.BOOKED || bi.status == BookingStatus.APPROVED)) ||
                                                  (ci != null && ci.status == "confirmed")
                                    
                                    val showSuccessUI = hasJustConfirmed
                                    val isError = !isValid && !showSuccessUI && (bi?.status == BookingStatus.CONFIRMED || bi?.status == BookingStatus.TIMED_OUT || ci?.status == "completed")

                                    val statusText = when {
                                        showSuccessUI -> "GRANTED"
                                        bi != null && bi.status == BookingStatus.CONFIRMED -> "CONFIRMED"
                                        bi != null && bi.status == BookingStatus.TIMED_OUT -> "TIMED OUT"
                                        bi != null && bi.status == BookingStatus.DECLINED -> "DECLINED"
                                        bi != null && bi.status == BookingStatus.BOOKED -> "BOOKED"
                                        bi != null && bi.status == BookingStatus.APPROVED -> "APPROVED"
                                        ci != null -> ci.status.uppercase()
                                        else -> "INVALID"
                                    }

                                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        // Status card
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(32.dp))
                                                .background(if (showSuccessUI || isValid) theme.colors.success.copy(0.1f) else theme.colors.error.copy(0.1f))
                                                .border(1.dp, if (showSuccessUI || isValid) theme.colors.success.copy(0.3f) else theme.colors.error.copy(0.3f), RoundedCornerShape(32.dp))
                                                .padding(32.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(80.dp)
                                                        .clip(RoundedCornerShape(24.dp))
                                                        .background(if (showSuccessUI || isValid) theme.colors.success else if (bi?.status == BookingStatus.CONFIRMED || bi?.status == BookingStatus.TIMED_OUT || bi?.status == BookingStatus.DECLINED) theme.colors.warning else theme.colors.error),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(
                                                        if (showSuccessUI || isValid) Icons.Default.CheckCircle else Icons.Default.ErrorOutline,
                                                        null, tint = Color.White, modifier = Modifier.size(40.dp)
                                                    )
                                                }
                                                Spacer(Modifier.height(16.dp))
                                                Text(statusText, fontSize = 36.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary)
                                            }
                                        }

                                        if (isError && bi != null) {
                                            Text(
                                                "Cannot be accepted: Ticket is ${if (bi.status == BookingStatus.CONFIRMED) "Already Scanned" else if (bi.status == BookingStatus.DECLINED) "Declined" else "Timed Out"}",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Black,
                                                color = Color.Red,
                                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).background(Color.Red.copy(0.1f), RoundedCornerShape(8.dp)).padding(8.dp)
                                            )
                                        }

                                        // Details card
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(24.dp))
                                                .background(theme.colors.backgroundSecondary.copy(0.4f))
                                                .border(1.dp, theme.colors.border.copy(0.2f), RoundedCornerShape(24.dp))
                                                .padding(24.dp)
                                        ) {
                                            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                                DetailRow("PLAYER", playerName, theme.colors.textPrimary, theme.colors.textDisabled)
                                                if (opponentName != null) {
                                                    DetailRow("OPPONENT", opponentName, theme.colors.textPrimary, theme.colors.textDisabled)
                                                }
                                                DetailRow("SLOT", slotTime, theme.colors.accent, theme.colors.textDisabled)
                                            }
                                        }

                                        // Action button
                                        if (isValid) {
                                            Button(
                                                onClick = {
                                                    scope.launch {
                                                        loading = true
                                                        try {
                                                            if (bi != null) {
                                                                BookingService.updateBooking(bi.id, status = BookingStatus.CONFIRMED, checkedIn = true)
                                                                bookingInfo = bi.copy(checkedIn = true, status = BookingStatus.CONFIRMED)
                                                                hasJustConfirmed = true
                                                                Storage.clearPageState(PAGE_ID)
                                                                onAlert?.invoke("Entry Approved!", "success", null)
                                                            } else if (ci != null) {
                                                                BookingService.updateChallenge(ci.id, mapOf("status" to "confirmed"))
                                                                challengeInfo = ci.copy(status = "confirmed")
                                                                hasJustConfirmed = true
                                                                Storage.clearPageState(PAGE_ID)
                                                                onAlert?.invoke("Entry Approved!", "success", null)
                                                            }
                                                        } catch (e: Exception) {
                                                            onAlert?.invoke(e.message ?: "Error", "error", null)
                                                        } finally {
                                                            loading = false
                                                        }
                                                    }
                                                },
                                                modifier = Modifier.fillMaxWidth().height(64.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.success),
                                                shape = RoundedCornerShape(24.dp)
                                            ) {
                                                Text("CONFIRM ENTRY", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                                            }
                                        } else {
                                            Button(
                                                onClick = { 
                                                    bookingInfo = null; 
                                                    challengeInfo = null; 
                                                    scannerState = ScannerState.IDLE 
                                                    Storage.clearPageState(PAGE_ID)
                                                },
                                                modifier = Modifier.fillMaxWidth().height(64.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                                                shape = RoundedCornerShape(24.dp)
                                            ) {
                                                Text("SCAN ANOTHER", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF1A1A2E), letterSpacing = 2.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (loading) {
                            Box(modifier = Modifier.fillMaxWidth().aspectRatio(1f), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    CircularProgressIndicator(color = theme.colors.accent, strokeWidth = 4.dp)
                                    Spacer(Modifier.height(16.dp))
                                    Text("LOADING...", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 2.sp, modifier = Modifier.animateContentSize())
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Global PermissionsProvider handles the prompt
}

@Composable
private fun DetailRow(label: String, value: String, valueColor: androidx.compose.ui.graphics.Color, labelColor: androidx.compose.ui.graphics.Color) {
    Column {
        Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = labelColor, letterSpacing = 2.sp)
        Text(value, fontSize = 20.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = valueColor)
    }
}

private fun extractId(data: String): String {
    return when {
        data.contains("id=") -> data.split("id=")[1].split("&")[0]
        data.contains("/") -> data.split("/").last()
        else -> data.trim()
    }
}

private suspend fun handleScanResult(
    id: String,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)?,
    onResult: (bookingInfo: Booking?, challengeInfo: ChallengeDetails?) -> Unit
) {
    try {
        var booking = BookingService.getBookingById(id)
        if (booking != null) {
            // Logic for auto-timeout if not scanned in time
            booking = BookingService.checkAndApplyTimeout(booking)
            onResult(booking, null)
        } else {
            val challenge = BookingService.getChallengeById(id)
            if (challenge != null) {
                onResult(null, challenge)
            } else {
                onAlert?.invoke("Invalid Ticket ID: ${id.take(10)}...", "error", null)
            }
        }
    } catch (e: Exception) {
        onAlert?.invoke(e.message ?: "Error", "error", null)
    }
}




