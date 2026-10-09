package com.boxitt.app.pages

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.contexts.LocalAppTheme

@Composable
fun AboutAppPage(
    onNavigateBack: () -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    var showTermsDialog by remember { mutableStateOf(false) }
    var showPrivacyDialog by remember { mutableStateOf(false) }
    var showRateDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = theme.colors.background,
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onNavigateBack,
                    modifier = Modifier
                        .size(42.dp)
                        .background(theme.colors.card, CircleShape)
                        .border(1.dp, theme.colors.border, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = theme.colors.textPrimary
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Text(
                    text = "About App",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.colors.textPrimary
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // App Identity Card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color(0xFF04481C)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("boxitt", color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp)
                }

                Text(
                    text = "Boxitt Sports",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.colors.textPrimary
                )

                Text(
                    text = "Version 2.4.1 (Stable)",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = theme.colors.accent
                )

                Text(
                    text = "The premier turf booking and multi-sport scoring companion app.",
                    fontSize = 12.sp,
                    color = theme.colors.textSecondary,
                    textAlign = TextAlign.Center
                )
            }

            // Legal & Review Actions
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showTermsDialog = true }
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Icon(Icons.Default.Description, null, tint = theme.colors.accent)
                        Text("Terms of Service", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                    }
                    Icon(Icons.Default.ChevronRight, null, tint = theme.colors.textSecondary)
                }

                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 0.8.dp)

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showPrivacyDialog = true }
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Icon(Icons.Default.Security, null, tint = Color(0xFF16A34A))
                        Text("Privacy Policy", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                    }
                    Icon(Icons.Default.ChevronRight, null, tint = theme.colors.textSecondary)
                }

                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 0.8.dp)

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showRateDialog = true }
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Icon(Icons.Default.Star, null, tint = Color(0xFFEAB308))
                        Text("Rate Boxitt", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                    }
                    Icon(Icons.Default.ChevronRight, null, tint = theme.colors.textSecondary)
                }
            }

            // Copyright Footer
            Text(
                text = "© 2026 Boxitt Technologies. All rights reserved.",
                fontSize = 11.sp,
                color = theme.colors.textSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp)
            )
        }
    }

    if (showTermsDialog) {
        AlertDialog(
            onDismissRequest = { showTermsDialog = false },
            title = { Text("Terms of Service", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "1. Bookings are subject to arena slot availability.\n\n2. Cancellation policies are set by arena partners.\n\n3. Fair play and player respect are mandatory across all tournaments.",
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                TextButton(onClick = { showTermsDialog = false }) {
                    Text("OK", color = theme.colors.accent)
                }
            },
            containerColor = theme.colors.card
        )
    }

    if (showPrivacyDialog) {
        AlertDialog(
            onDismissRequest = { showPrivacyDialog = false },
            title = { Text("Privacy Policy", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Your personal data (phone, name, booking details) is encrypted and secured. We never share or sell personal player records.",
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                TextButton(onClick = { showPrivacyDialog = false }) {
                    Text("OK", color = theme.colors.accent)
                }
            },
            containerColor = theme.colors.card
        )
    }

    if (showRateDialog) {
        AlertDialog(
            onDismissRequest = { showRateDialog = false },
            title = { Text("Rate Boxitt", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Enjoying Boxitt? Leave a 5-star rating to support future updates and local sports tournaments!",
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    onAlert?.invoke("Thank you for your rating!", "success", null)
                    showRateDialog = false
                }) {
                    Text("5 STARS ★★★★★", color = theme.colors.accent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showRateDialog = false }) {
                    Text("LATER", color = theme.colors.textSecondary)
                }
            },
            containerColor = theme.colors.card
        )
    }
}
