package com.boxitt.app.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.contexts.LocalAppTheme
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun PaymentPage(
    amount: Double,
    bookingId: String,
    locationName: String,
    courtName: String? = null,
    date: String? = null,
    slotTime: String? = null,
    totalFee: Int? = null,
    onBack: () -> Unit,
    onPay: () -> Unit,
    isLoading: Boolean = false
) {
    val theme = LocalAppTheme.current
    val scrollState = rememberScrollState()
    val sdfInput = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val sdfOutput = SimpleDateFormat("dd MMM, yyyy", Locale.getDefault())

    val formattedDate = try {
        date?.let { sdfOutput.format(sdfInput.parse(it)!!) }
    } catch (e: Exception) {
        date
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(theme.colors.background)
                    .padding(horizontal = 8.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.Default.ChevronLeft,
                        contentDescription = "Back",
                        tint = theme.colors.textPrimary,
                        modifier = Modifier.size(32.dp)
                    )
                }
                Text(
                    text = "Payment",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.colors.textPrimary
                )
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(scrollState)
                    .padding(horizontal = 24.dp)
            ) {
                Spacer(modifier = Modifier.height(8.dp))

                // Amount Card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(40.dp))
                        .background(Color(0xFFDCEDC8)) // Fixed color from web
                        .padding(32.dp)
                ) {
                    // Decorative elements (simplified)
                    Box(
                        modifier = Modifier
                            .size(128.dp)
                            .offset(x = 64.dp, y = (-64).dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(alpha = 0.05f))
                            .align(Alignment.TopEnd)
                    )

                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = "AMOUNT PAYABLE",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.Black.copy(alpha = 0.6f),
                            letterSpacing = 1.sp
                        )
                        Text(
                            text = "₹${String.format("%,.2f", amount)}",
                            fontSize = 36.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.Black,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                        Text(
                            text = "Booking ID: #$bookingId",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.Black.copy(alpha = 0.8f)
                        )
                        Text(
                            text = "$locationName${if (courtName != null) ", $courtName" else ""}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.Black.copy(alpha = 0.8f)
                        )

                        Divider(
                            color = Color.Black.copy(alpha = 0.05f),
                            modifier = Modifier.padding(vertical = 24.dp)
                        )

                        Row(modifier = Modifier.fillMaxWidth()) {
                            if (formattedDate != null) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "DATE",
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.Black.copy(alpha = 0.5f)
                                    )
                                    Text(
                                        formattedDate,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.Black
                                    )
                                }
                            }
                            if (slotTime != null) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "TIME SLOT",
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.Black.copy(alpha = 0.5f)
                                    )
                                    Text(
                                        slotTime,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.Black
                                    )
                                }
                            }
                        }
                        if (totalFee != null) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                "TOTAL ARENA FEE",
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.Black.copy(alpha = 0.5f)
                            )
                            Text(
                                "₹${String.format("%,d", totalFee)}",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.Black
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Preferred Payments
                Text(
                    text = "PREFERRED PAYMENTS",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textPrimary.copy(alpha = 0.6f),
                    letterSpacing = 2.sp
                )
                Spacer(modifier = Modifier.height(16.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(32.dp))
                        .background(Color.White)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(32.dp))
                ) {
                    val preferred = listOf(
                        Triple("phonepe", "PhonePe", Icons.Default.AccountBalanceWallet),
                        Triple("gpay", "Google Pay", Icons.Default.Smartphone),
                        Triple("paytm", "Paytm", Icons.Default.Payments)
                    )
                    preferred.forEachIndexed { index, opt ->
                        PaymentOptionRow(
                            name = opt.second,
                            icon = opt.third,
                            isLast = index == preferred.size - 1,
                            onClick = { /* Handle preferred */ }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Other Options
                Text(
                    text = "OTHER PAYMENT OPTIONS",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textPrimary.copy(alpha = 0.6f),
                    letterSpacing = 2.sp
                )
                Spacer(modifier = Modifier.height(16.dp))
                val others = listOf(
                    Triple("Pay by any UPI App", "GPay, PhonePe, WhatsApp & more", Icons.Default.QrCode),
                    Triple("Debit / Credit Card", "Visa, Mastercard, RuPay & more", Icons.Default.CreditCard),
                    Triple("Net Banking", "All Indian Banks", Icons.Default.AccountBalance)
                )
                others.forEach { opt ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color.White)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
                            .clickable { /* Handle other */ }
                            .padding(20.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(theme.colors.backgroundSecondary),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = opt.third,
                                    contentDescription = null,
                                    tint = theme.colors.accent,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(16.dp))
                            Column {
                                Text(
                                    text = opt.first,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.colors.textPrimary
                                )
                                Text(
                                    text = opt.second,
                                    fontSize = 10.sp,
                                    color = theme.colors.textPrimary.copy(alpha = 0.6f),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                // Security Footer
                Spacer(modifier = Modifier.height(24.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(40.dp))
                        .background(Color.White)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(40.dp))
                        .padding(24.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.VerifiedUser,
                                contentDescription = null,
                                tint = theme.colors.textPrimary.copy(alpha = 0.6f),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "100% SECURE PAYMENTS",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textPrimary.copy(alpha = 0.6f),
                                letterSpacing = 1.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = onPay,
                            enabled = !isLoading,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(64.dp),
                            shape = RoundedCornerShape(24.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Brush.horizontalGradient(theme.colors.buttonGradient)),
                                contentAlignment = Alignment.Center
                            ) {
                                if (isLoading) {
                                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                                } else {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            "Pay Now ₹${String.format("%,d", amount.toInt())}",
                                            fontSize = 18.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Color.White
                                        )
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Icon(
                                            Icons.Default.ArrowForward,
                                            null,
                                            tint = Color.White,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(120.dp))
            }
        }
    }
}

@Composable
fun PaymentOptionRow(
    name: String,
    icon: ImageVector,
    isLast: Boolean,
    onClick: () -> Unit
) {
    val theme = LocalAppTheme.current
    Column(modifier = Modifier.fillMaxWidth().clickable { onClick() }) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(theme.colors.backgroundSecondary),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = theme.colors.accent,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = name,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.colors.textPrimary
                )
            }
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = theme.colors.textPrimary.copy(alpha = 0.4f),
                modifier = Modifier.size(16.dp)
            )
        }
        if (!isLast) {
            Divider(color = theme.colors.border, modifier = Modifier.padding(horizontal = 20.dp))
        }
    }
}
