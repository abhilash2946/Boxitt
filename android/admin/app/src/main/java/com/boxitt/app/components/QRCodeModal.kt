package com.boxitt.app.components

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path as AndroidPath
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.core.content.FileProvider
import coil.compose.rememberAsyncImagePainter
import com.boxitt.app.Booking
import com.boxitt.app.BookingStatus
import com.boxitt.app.Location
import com.boxitt.app.contexts.LocalAppTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class TicketItem(
    val id: String,
    val qrNo: String = "QR #1",
    val ticketNumber: Int = 1,
    val groupSize: String = "1 Ticket",
    val slotTime: String = "",
    val date: String = "",
    val holderName: String = "Player",
    val role: String? = null,
    val qrData: String = "",
    val participantCheckedIn: Boolean = false,
    val status: BookingStatus = BookingStatus.BOOKED
)

suspend fun createTicketBitmap(
    context: Context,
    booking: Booking,
    location: Location
): Bitmap = withContext(Dispatchers.IO) {
    val width = 800
    val height = 1200
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    // Background - soft slate background
    val bgPaint = Paint().apply {
        color = AndroidColor.parseColor("#F1F5F9")
        style = Paint.Style.FILL
    }
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

    // Ticket Card dimensions
    val cardMarginX = 60f
    val cardMarginY = 60f
    val cardRect = RectF(cardMarginX, cardMarginY, width - cardMarginX, height - cardMarginY)

    // White Card
    val cardPaint = Paint().apply {
        color = AndroidColor.WHITE
        style = Paint.Style.FILL
        isAntiAlias = true
    }
    val cornerRadius = 40f
    canvas.drawRoundRect(cardRect, cornerRadius, cornerRadius, cardPaint)

    // Fetch QR Code Bitmap
    var qrBitmap: Bitmap? = null
    try {
        val qrTargetData = if (booking.id.isNotBlank()) booking.id else "Ticket"
        val url = URL("https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${Uri.encode(qrTargetData)}")
        val connection = url.openConnection() as HttpURLConnection
        connection.connectTimeout = 5000
        connection.readTimeout = 5000
        connection.doInput = true
        connection.connect()
        val inputStream = connection.inputStream
        qrBitmap = BitmapFactory.decodeStream(inputStream)
        inputStream.close()
    } catch (e: Exception) {
        e.printStackTrace()
    }

    val textPaint = Paint().apply {
        isAntiAlias = true
        textAlign = Paint.Align.CENTER
    }

    // Header Area
    textPaint.color = AndroidColor.parseColor("#2563EB")
    textPaint.textSize = 24f
    textPaint.isFakeBoldText = true
    textPaint.letterSpacing = 0.15f
    canvas.drawText("ARENA TICKET", width / 2f, cardMarginY + 80f, textPaint)

    textPaint.color = AndroidColor.parseColor("#0F172A")
    textPaint.textSize = 48f
    textPaint.isFakeBoldText = true
    textPaint.letterSpacing = 0.05f
    canvas.drawText(location.name.uppercase(), width / 2f, cardMarginY + 145f, textPaint)

    // QR Code Box
    val qrSize = 380f
    val qrLeft = (width - qrSize) / 2f
    val qrTop = cardMarginY + 190f
    val qrBoxRect = RectF(qrLeft, qrTop, qrLeft + qrSize, qrTop + qrSize)

    val qrBoxBgPaint = Paint().apply {
        color = AndroidColor.WHITE
        style = Paint.Style.FILL
        isAntiAlias = true
    }
    val qrBorderPaint = Paint().apply {
        color = AndroidColor.parseColor("#E2E8F0")
        style = Paint.Style.STROKE
        strokeWidth = 3f
        isAntiAlias = true
    }
    canvas.drawRoundRect(qrBoxRect, 32f, 32f, qrBoxBgPaint)
    canvas.drawRoundRect(qrBoxRect, 32f, 32f, qrBorderPaint)

    if (qrBitmap != null) {
        val padding = 24f
        val destRect = RectF(qrLeft + padding, qrTop + padding, qrLeft + qrSize - padding, qrTop + qrSize - padding)
        canvas.drawBitmap(qrBitmap, null, destRect, Paint(Paint.FILTER_BITMAP_FLAG))
    }

    // Time Slot & Date
    val timeY = qrTop + qrSize + 80f
    textPaint.color = AndroidColor.parseColor("#0F172A")
    textPaint.textSize = 42f
    textPaint.isFakeBoldText = true
    textPaint.letterSpacing = 0.02f
    canvas.drawText(booking.slotTime, width / 2f, timeY, textPaint)

    textPaint.color = AndroidColor.parseColor("#2563EB")
    textPaint.textSize = 26f
    textPaint.isFakeBoldText = true
    textPaint.letterSpacing = 0.1f
    canvas.drawText(booking.date, width / 2f, timeY + 45f, textPaint)

    // Cutout Circles & Dashed Perforation Line
    val perfY = timeY + 110f
    val cutoutRadius = 30f
    val cutoutPaint = Paint().apply {
        color = AndroidColor.parseColor("#F1F5F9")
        style = Paint.Style.FILL
        isAntiAlias = true
    }
    canvas.drawCircle(cardMarginX, perfY, cutoutRadius, cutoutPaint)
    canvas.drawCircle(width - cardMarginX, perfY, cutoutRadius, cutoutPaint)

    val dashPaint = Paint().apply {
        color = AndroidColor.parseColor("#CBD5E1")
        style = Paint.Style.STROKE
        strokeWidth = 3f
        pathEffect = DashPathEffect(floatArrayOf(15f, 15f), 0f)
        isAntiAlias = true
    }
    val dashPath = AndroidPath().apply {
        moveTo(cardMarginX + cutoutRadius + 10f, perfY)
        lineTo(width - cardMarginX - cutoutRadius - 10f, perfY)
    }
    canvas.drawPath(dashPath, dashPaint)

    // Status & Booking ID
    val detailsY = perfY + 80f

    // STATUS
    val leftX = cardMarginX + 50f
    textPaint.textAlign = Paint.Align.LEFT
    textPaint.color = AndroidColor.parseColor("#94A3B8")
    textPaint.textSize = 20f
    textPaint.isFakeBoldText = true
    textPaint.letterSpacing = 0.1f
    canvas.drawText("STATUS", leftX, detailsY, textPaint)

    val statusColorStr = when (booking.status) {
        BookingStatus.CONFIRMED -> "#22C55E"
        BookingStatus.TIMED_OUT -> "#EF4444"
        BookingStatus.BOOKED -> "#2563EB"
        else -> "#22C55E"
    }
    val statusTextStr = when (booking.status) {
        BookingStatus.BOOKED -> "BOOKED"
        BookingStatus.CONFIRMED -> "CONFIRMED"
        BookingStatus.TIMED_OUT -> "TIMED OUT"
        else -> booking.status.name
    }
    textPaint.color = AndroidColor.parseColor(statusColorStr)
    textPaint.textSize = 28f
    textPaint.isFakeBoldText = true
    canvas.drawText(statusTextStr, leftX, detailsY + 40f, textPaint)

    // BOOKING ID
    val rightX = width - cardMarginX - 50f
    textPaint.textAlign = Paint.Align.RIGHT
    textPaint.color = AndroidColor.parseColor("#94A3B8")
    textPaint.textSize = 20f
    textPaint.isFakeBoldText = true
    canvas.drawText("BOOKING ID", rightX, detailsY, textPaint)

    textPaint.color = AndroidColor.parseColor("#0F172A")
    textPaint.textSize = 22f
    textPaint.typeface = Typeface.MONOSPACE
    val displayId = if (booking.id.length > 16) booking.id.take(16) + "..." else booking.id
    canvas.drawText(displayId, rightX, detailsY + 40f, textPaint)

    return@withContext bitmap
}

fun downloadJpgToLocal(
    context: Context,
    bitmap: Bitmap,
    bookingId: String,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)?
) {
    try {
        val fileName = "Boxitt-Ticket-${bookingId.take(8)}.jpg"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
            if (uri != null) {
                resolver.openOutputStream(uri)?.use { stream ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream)
                }
                onAlert?.invoke("Ticket downloaded to Downloads folder", "success", null)
            } else {
                onAlert?.invoke("Failed to save ticket", "error", null)
            }
        } else {
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsDir.exists()) downloadsDir.mkdirs()
            val file = File(downloadsDir, fileName)
            FileOutputStream(file).use { stream ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream)
            }
            val intent = Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE)
            intent.data = Uri.fromFile(file)
            context.sendBroadcast(intent)
            onAlert?.invoke("Ticket downloaded to Downloads folder", "success", null)
        }
    } catch (e: Exception) {
        e.printStackTrace()
        onAlert?.invoke("Failed to download ticket", "error", null)
    }
}

fun shareJpg(
    context: Context,
    bitmap: Bitmap,
    bookingId: String,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)?
) {
    try {
        val file = File(context.cacheDir, "Boxitt-Ticket-${bookingId.take(8)}.jpg")
        FileOutputStream(file).use { stream ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream)
        }
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/jpeg"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share Ticket"))
    } catch (e: Exception) {
        e.printStackTrace()
        onAlert?.invoke("Failed to share ticket", "error", null)
    }
}

@Composable
fun QRCodeModal(
    booking: Booking?,
    location: Location,
    tickets: List<TicketItem> = emptyList(),
    initialIndex: Int = 0,
    onClose: () -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null
) {
    if (booking == null && tickets.isEmpty()) return
    val context = LocalContext.current
    val theme = LocalAppTheme.current
    val coroutineScope = rememberCoroutineScope()
    var isProcessing by remember { mutableStateOf(false) }

    val ticketList = remember(booking, tickets) {
        if (tickets.isNotEmpty()) tickets
        else if (booking != null) listOf(
            TicketItem(
                id = booking.id,
                qrNo = "QR #1",
                ticketNumber = 1,
                groupSize = "1 Ticket",
                slotTime = booking.slotTime,
                date = booking.date,
                holderName = booking.name,
                qrData = booking.id,
                participantCheckedIn = booking.checkedIn,
                status = booking.status
            )
        )
        else emptyList()
    }

    var currentIndex by remember(booking, initialIndex) {
        mutableIntStateOf(initialIndex.coerceIn(0, (ticketList.size - 1).coerceAtLeast(0)))
    }

    if (ticketList.isEmpty()) return
    val activeTicket = ticketList[currentIndex.coerceIn(0, ticketList.size - 1)]

    val qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${Uri.encode(activeTicket.qrData.ifBlank { activeTicket.id })}"

    // Modern Ticket Shape with semi-circle cutouts at 2/3 height
    val ticketShape = remember {
        GenericShape { size, _ ->
            val cutOutRadius = 32f
            val cutOutY = size.height * 0.7f
            
            moveTo(0f, 0f)
            lineTo(size.width, 0f)
            lineTo(size.width, cutOutY - cutOutRadius)
            arcTo(
                rect = Rect(size.width - cutOutRadius, cutOutY - cutOutRadius, size.width + cutOutRadius, cutOutY + cutOutRadius),
                startAngleDegrees = 270f,
                sweepAngleDegrees = -180f,
                forceMoveTo = false
            )
            lineTo(size.width, size.height)
            lineTo(0f, size.height)
            lineTo(0f, cutOutY + cutOutRadius)
            arcTo(
                rect = Rect(-cutOutRadius, cutOutY - cutOutRadius, cutOutRadius, cutOutY + cutOutRadius),
                startAngleDegrees = 90f,
                sweepAngleDegrees = -180f,
                forceMoveTo = false
            )
            close()
        }
    }

    Dialog(onDismissRequest = onClose) {
        Column(
            modifier = Modifier.fillMaxWidth(0.95f),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Slider Controls Bar if multiple tickets
            if (ticketList.size > 1) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(theme.colors.card)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = { if (currentIndex > 0) currentIndex-- },
                        enabled = currentIndex > 0
                    ) {
                        Icon(
                            imageVector = Icons.Default.ChevronLeft,
                            contentDescription = "Previous QR",
                            tint = if (currentIndex > 0) theme.colors.accent else theme.colors.textDisabled
                        )
                    }

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "${activeTicket.qrNo} (${currentIndex + 1}/${ticketList.size})",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textPrimary
                        )
                        Text(
                            text = activeTicket.groupSize,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = theme.colors.textDisabled
                        )
                    }

                    IconButton(
                        onClick = { if (currentIndex < ticketList.size - 1) currentIndex++ },
                        enabled = currentIndex < ticketList.size - 1
                    ) {
                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = "Next QR",
                            tint = if (currentIndex < ticketList.size - 1) theme.colors.accent else theme.colors.textDisabled
                        )
                    }
                }
            }

            // Ticket Card View
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(theme.elevation.elevated, ticketShape)
                    .clip(ticketShape)
                    .background(theme.colors.card)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Header Area
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = "ARENA TICKET",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.colors.accent,
                                    letterSpacing = 3.sp
                                )
                                if (ticketList.size > 1) {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(theme.colors.accent)
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(activeTicket.qrNo, fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.White)
                                    }
                                }
                            }
                            Text(
                                text = location.name.uppercase(),
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black,
                                fontStyle = FontStyle.Italic,
                                color = theme.colors.textPrimary,
                                letterSpacing = (-1).sp
                            )
                        }
                        IconButton(
                            onClick = onClose,
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(theme.colors.backgroundSecondary)
                        ) {
                            Icon(Icons.Default.Close, null, tint = theme.colors.textDisabled, modifier = Modifier.size(18.dp))
                        }
                    }

                    // Main Content
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // QR Code
                        Box(
                            modifier = Modifier
                                .size(200.dp)
                                .clip(RoundedCornerShape(32.dp))
                                .background(Color.White)
                                .border(1.dp, theme.colors.border.copy(0.3f), RoundedCornerShape(32.dp))
                                .padding(16.dp)
                        ) {
                            Image(
                                painter = rememberAsyncImagePainter(qrUrl),
                                contentDescription = "QR Code",
                                modifier = Modifier.fillMaxSize()
                            )
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        // Large Time Slot
                        Text(
                            text = activeTicket.slotTime.ifBlank { booking?.slotTime ?: "N/A" },
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textPrimary,
                            textAlign = TextAlign.Center,
                            fontStyle = FontStyle.Italic,
                            letterSpacing = (-0.5).sp
                        )
                        Text(
                            text = activeTicket.date.ifBlank { booking?.date ?: "" },
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.accent,
                            letterSpacing = 2.sp
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // Holder & Role
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("TICKET HOLDER", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text("${activeTicket.holderName} • ${activeTicket.groupSize}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            }
                            if (!activeTicket.role.isNullOrBlank()) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(theme.colors.accent.copy(0.1f))
                                        .border(1.dp, theme.colors.accent.copy(0.2f), RoundedCornerShape(12.dp))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(activeTicket.role.uppercase(), fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Dashed Perforation Line
                        Canvas(modifier = Modifier.fillMaxWidth().height(1.dp)) {
                            val path = Path()
                            val dashWidth = 10f
                            val dashGap = 10f
                            var x = 0f
                            while (x < size.width) {
                                path.moveTo(x, 0f)
                                path.lineTo(x + dashWidth, 0f)
                                x += dashWidth + dashGap
                            }
                            drawPath(path, color = theme.colors.border.copy(0.5f))
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        // Booking Details
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(bottom = 20.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("STATUS", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                val isConfirmed = activeTicket.participantCheckedIn || activeTicket.status == BookingStatus.CONFIRMED
                                val statusColor = if (isConfirmed) theme.colors.success else if (activeTicket.status == BookingStatus.TIMED_OUT) theme.colors.error else theme.colors.accent
                                val statusText = if (isConfirmed) "CONFIRMED" else if (activeTicket.status == BookingStatus.TIMED_OUT) "TIMED OUT" else "BOOKED"
                                Text(statusText, fontSize = 12.sp, fontWeight = FontWeight.Black, color = statusColor)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("TICKET / BOOKING ID", fontSize = 8.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 1.sp)
                                Text(activeTicket.id.take(12) + "...", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = theme.colors.textPrimary)
                            }
                        }
                    }
                }
            }

            // Dot Indicators if multiple tickets
            if (ticketList.size > 1) {
                Row(
                    modifier = Modifier.padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ticketList.indices.forEach { idx ->
                        Box(
                            modifier = Modifier
                                .height(6.dp)
                                .width(if (idx == currentIndex) 20.dp else 6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(if (idx == currentIndex) theme.colors.accent else theme.colors.textDisabled.copy(0.4f))
                                .clickable { currentIndex = idx }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Footer Buttons: Left button is Download, Right button is Share
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                ShareActionItem(
                    icon = Icons.Default.Download,
                    label = "DOWNLOAD",
                    theme = theme,
                    onClick = {
                        if (isProcessing) return@ShareActionItem
                        isProcessing = true
                        coroutineScope.launch {
                            try {
                                val dummyBooking = (booking ?: Booking(
                                    id = activeTicket.id, name = activeTicket.holderName, phone = "", date = activeTicket.date,
                                    locationId = location.id, slotId = "", slotTime = activeTicket.slotTime, startHour = 0.0,
                                    endHour = 0.0, duration = "1", amount = 0.0, advancePaid = 0.0, status = activeTicket.status,
                                    paymentMethod = "", paymentType = "", checkedIn = activeTicket.participantCheckedIn,
                                    createdAt = "", bookedBy = "", sport = ""
                                )).copy(id = activeTicket.qrData.ifBlank { activeTicket.id }, slotTime = activeTicket.slotTime, date = activeTicket.date)
                                val bitmap = createTicketBitmap(context, dummyBooking, location)
                                downloadJpgToLocal(context, bitmap, activeTicket.id, onAlert)
                            } catch (e: Exception) {
                                onAlert?.invoke("Failed to download ticket", "error", null)
                            } finally {
                                isProcessing = false
                            }
                        }
                    },
                    modifier = Modifier.weight(1f)
                )
                ShareActionItem(
                    icon = Icons.Default.Share,
                    label = "SHARE TICKET",
                    theme = theme,
                    onClick = {
                        if (isProcessing) return@ShareActionItem
                        isProcessing = true
                        coroutineScope.launch {
                            try {
                                val dummyBooking = (booking ?: Booking(
                                    id = activeTicket.id, name = activeTicket.holderName, phone = "", date = activeTicket.date,
                                    locationId = location.id, slotId = "", slotTime = activeTicket.slotTime, startHour = 0.0,
                                    endHour = 0.0, duration = "1", amount = 0.0, advancePaid = 0.0, status = activeTicket.status,
                                    paymentMethod = "", paymentType = "", checkedIn = activeTicket.participantCheckedIn,
                                    createdAt = "", bookedBy = "", sport = ""
                                )).copy(id = activeTicket.qrData.ifBlank { activeTicket.id }, slotTime = activeTicket.slotTime, date = activeTicket.date)
                                val bitmap = createTicketBitmap(context, dummyBooking, location)
                                shareJpg(context, bitmap, activeTicket.id, onAlert)
                            } catch (e: Exception) {
                                onAlert?.invoke("Failed to share ticket", "error", null)
                            } finally {
                                isProcessing = false
                            }
                        }
                    },
                    modifier = Modifier.weight(1f)
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Button(
                onClick = onClose,
                colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.15f)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(0.5f).height(44.dp)
            ) {
                Text("DISMISS", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 2.sp)
            }
        }
    }
}

@Composable
fun ShareActionItem(
    icon: ImageVector,
    label: String,
    theme: com.boxitt.app.theme.AppTheme,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(52.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, theme.colors.accent.copy(0.2f), RoundedCornerShape(16.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(icon, null, tint = theme.colors.accent, modifier = Modifier.size(18.dp))
            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 1.sp)
        }
    }
}

@Composable
fun InfoRow(label: String, value: String, theme: com.boxitt.app.theme.AppTheme) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            color = theme.colors.textDisabled,
            letterSpacing = 1.sp
        )
        Text(
            text = value,
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            color = theme.colors.textPrimary,
            fontStyle = FontStyle.Italic
        )
    }
}

@Composable
fun ShareButton(
    text: String,
    icon: ImageVector,
    modifier: Modifier,
    theme: com.boxitt.app.theme.AppTheme,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .height(52.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(theme.colors.card)
            .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(icon, null, tint = theme.colors.textPrimary, modifier = Modifier.size(16.dp))
            Text(
                text = text,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                color = theme.colors.textPrimary,
                letterSpacing = 1.sp
            )
        }
    }
}
