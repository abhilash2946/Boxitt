package com.boxitt.app.components

import android.webkit.WebView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.mfa.FactorType
import io.github.jan.supabase.gotrue.user.UserMfaFactor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

enum class TwoFactorStep {
    LOADING, ENROLL, VERIFY, SUCCESS
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TwoFactorAuthModal(
    onClose: () -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    scope: CoroutineScope = rememberCoroutineScope()
) {
    val theme = LocalAppTheme.current
    var step by remember { mutableStateOf(TwoFactorStep.LOADING) }
    var factorId by remember { mutableStateOf("") }
    var qrCodeSvg by remember { mutableStateOf("") }
    var secret by remember { mutableStateOf("") }
    var verificationCode by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    val clipboardManager = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            val factors = Supabase.client.auth.mfa.retrieveFactorsForCurrentUser()
            if (factors.any { it.factorType == "totp" && it.isVerified }) {
                onAlert?.invoke("2FA already enabled.", "success", null)
                onClose()
                return@LaunchedEffect
            }
            val unverifiedFactors = factors.filter { it.factorType == "totp" && !it.isVerified }
            unverifiedFactors.forEach { factor ->
                Supabase.client.auth.mfa.unenroll(factor.id)
            }
            val enrollResponse = Supabase.client.auth.mfa.enroll(FactorType.TOTP)
            factorId = enrollResponse.id
            qrCodeSvg = enrollResponse.data.qrCode
            secret = enrollResponse.data.secret
            step = TwoFactorStep.ENROLL
        } catch (e: Exception) {
            onAlert?.invoke("Setup failed", "error", null)
            onClose()
        }
    }

    Dialog(onDismissRequest = onClose) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .clip(RoundedCornerShape(theme.radius.large))
                .background(theme.colors.card)
                .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(theme.colors.backgroundSecondary.copy(alpha = 0.2f))
                        .border(1.dp, theme.colors.border.copy(alpha = 0.4f))
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(theme.colors.accent.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = theme.colors.accent
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "TWO-FACTOR",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textPrimary
                        )
                    }
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = theme.colors.textDisabled,
                        modifier = Modifier.clickable { onClose() }
                    )
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    when (step) {
                        TwoFactorStep.LOADING -> {
                            CircularProgressIndicator(color = theme.colors.accent)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Initializing...", fontSize = 12.sp, color = theme.colors.textDisabled)
                        }
                        TwoFactorStep.ENROLL -> {
                            Text(
                                text = "Scan QR code with your authenticator app",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.colors.textSecondary,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(16.dp))

                            AndroidView(
                                factory = { context ->
                                    WebView(context).apply {
                                        loadDataWithBaseURL(null, qrCodeSvg, "image/svg+xml", "utf-8", null)
                                    }
                                },
                                modifier = Modifier
                                    .size(160.dp)
                                    .clip(RoundedCornerShape(24.dp))
                                    .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
                            )

                            Spacer(modifier = Modifier.height(16.dp))

                            Text("Manual Entry Key", fontSize = 10.sp, color = theme.colors.textDisabled)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(theme.colors.backgroundSecondary, RoundedCornerShape(16.dp))
                                    .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                                    .clickable {
                                        clipboardManager.setText(AnnotatedString(secret))
                                        copied = true
                                    }
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = secret,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.colors.textPrimary
                                )
                                if (copied) {
                                    Icon(imageVector = Icons.Default.Check, contentDescription = null, tint = theme.colors.success)
                                } else {
                                    Icon(imageVector = Icons.Default.Share, contentDescription = null, tint = theme.colors.textDisabled)
                                }
                            }

                            Spacer(modifier = Modifier.height(24.dp))

                            Button(
                                onClick = { step = TwoFactorStep.VERIFY },
                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("I HAVE SCANNED IT", color = Color.White, fontWeight = FontWeight.Black)
                            }
                        }
                        TwoFactorStep.VERIFY -> {
                            Text(
                                text = "Enter 6-digit verification code",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.colors.textSecondary,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            OutlinedTextField(
                                value = verificationCode,
                                onValueChange = { verificationCode = it.take(6) },
                                shape = RoundedCornerShape(16.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = theme.colors.backgroundSecondary,
                                    unfocusedContainerColor = theme.colors.backgroundSecondary,
                                    focusedBorderColor = Color.Transparent,
                                    unfocusedBorderColor = Color.Transparent
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                            Button(
                                onClick = {
                                    isSubmitting = true
                                    scope.launch {
                                        try {
                                            Supabase.client.auth.mfa.createChallengeAndVerify(
                                                factorId = factorId,
                                                code = verificationCode
                                            )
                                            step = TwoFactorStep.SUCCESS
                                            onAlert?.invoke("2FA Enabled!", "success", null)
                                        } catch (e: Exception) {
                                            onAlert?.invoke("Wrong code", "error", null)
                                        } finally {
                                            isSubmitting = false
                                        }
                                    }
                                },
                                enabled = verificationCode.length == 6 && !isSubmitting,
                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("COMPLETE SETUP", color = Color.White, fontWeight = FontWeight.Black)
                            }
                        }
                        TwoFactorStep.SUCCESS -> {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = null,
                                tint = theme.colors.success,
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Secure!", fontSize = 22.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                            Text("Two-Factor Auth is active.", fontSize = 14.sp, color = theme.colors.textDisabled)
                            Spacer(modifier = Modifier.height(24.dp))
                            Button(
                                onClick = onClose,
                                colors = ButtonDefaults.buttonColors(containerColor = theme.colors.textPrimary),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Close", color = theme.colors.background)
                            }
                        }
                    }
                }
            }
        }
    }
}




