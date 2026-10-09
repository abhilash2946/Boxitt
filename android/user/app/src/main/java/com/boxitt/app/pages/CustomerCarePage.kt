package com.boxitt.app.pages

import android.content.Intent
import android.net.Uri
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.contexts.LocalAppTheme

@Composable
fun CustomerCarePage(
    onNavigateBack: () -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    var subject by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var isSubmitted by remember { mutableStateOf(false) }

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
                    text = "Customer Care",
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
            // Channel 1: Call Support
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))
                    .clickable {
                        val callIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:+919876543210"))
                        context.startActivity(callIntent)
                    }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFDCFCE7)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Call, null, tint = Color(0xFF16A34A), modifier = Modifier.size(24.dp))
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text("Call Support", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = theme.colors.textPrimary)
                    Text("Mon-Sun, 8am - 10pm", fontSize = 12.sp, color = theme.colors.textSecondary)
                }
                Text("+91 98765 43210", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFF16A34A))
            }

            // Channel 2: Email Us
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))
                    .clickable {
                        val emailIntent = Intent(Intent.ACTION_SENDTO).apply {
                            data = Uri.parse("mailto:support@boxitt.app")
                            putExtra(Intent.EXTRA_SUBJECT, "Boxitt Support Inquiry")
                        }
                        context.startActivity(Intent.createChooser(emailIntent, "Send Email"))
                    }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFF3E8FF)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Email, null, tint = Color(0xFF9333EA), modifier = Modifier.size(24.dp))
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text("Email Us", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = theme.colors.textPrimary)
                    Text("support@boxitt.app", fontSize = 12.sp, color = theme.colors.textSecondary)
                }
                Icon(Icons.Default.ChevronRight, null, tint = theme.colors.textSecondary)
            }

            // Support Ticket Form
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Submit a Support Ticket",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.colors.textPrimary
                )

                OutlinedTextField(
                    value = subject,
                    onValueChange = { subject = it },
                    label = { Text("Subject") },
                    placeholder = { Text("e.g. Booking #BK-902 refund") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = theme.colors.accent,
                        unfocusedBorderColor = theme.colors.border
                    )
                )

                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it },
                    label = { Text("Message") },
                    placeholder = { Text("Describe the issue...") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = theme.colors.accent,
                        unfocusedBorderColor = theme.colors.border
                    )
                )

                Button(
                    onClick = {
                        if (subject.isNotBlank() && message.isNotBlank()) {
                            isSubmitted = true
                            onAlert?.invoke("Ticket submitted successfully!", "success", null)
                            subject = ""
                            message = ""
                        } else {
                            onAlert?.invoke("Please fill in both fields", "error", null)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    Text(if (isSubmitted) "TICKET SUBMITTED" else "SEND MESSAGE", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
