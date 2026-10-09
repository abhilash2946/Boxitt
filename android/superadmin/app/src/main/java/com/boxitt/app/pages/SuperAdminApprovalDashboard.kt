package com.boxitt.app.pages

import androidx.compose.animation.*
import androidx.compose.animation.core.*
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.hooks.ApprovalsViewModel
import com.boxitt.app.hooks.PendingRequest
import com.boxitt.app.contexts.LocalAppTheme
import kotlinx.coroutines.launch

@Composable
fun SuperAdminApprovalDashboard(onBack: () -> Unit) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()
    val viewModel = remember { ApprovalsViewModel(scope) }
    
    var searchTerm by remember { mutableStateOf("") }
    var feedback by remember { mutableStateOf<Pair<String, String>?>(null) } // message to type

    LaunchedEffect(Unit) {
        viewModel.fetchPendingApprovals()
    }

    val filteredRequests = viewModel.pendingRequests.filter {
        it.username?.contains(searchTerm, ignoreCase = true) == true ||
        it.email.contains(searchTerm, ignoreCase = true)
    }

    Box(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        // Background Decor
        Box(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .offset(x = (-100).dp, y = (-100).dp)
                    .size(400.dp)
                    .background(theme.colors.accent.copy(alpha = 0.08f), CircleShape)
            )
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = 100.dp, y = 100.dp)
                    .size(400.dp)
                    .background(theme.colors.success.copy(alpha = 0.08f), CircleShape)
            )
        }

        Column(modifier = Modifier.fillMaxSize().padding(20.dp).statusBarsPadding()) {
            // Header
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    IconButton(
                        onClick = onBack, 
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(theme.colors.card)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                    ) {
                        Icon(Icons.Default.ChevronLeft, null, tint = theme.colors.textPrimary, modifier = Modifier.size(24.dp))
                    }
                    Column {
                        Text(
                            "ADMIN", 
                            fontSize = 30.sp, 
                            fontWeight = FontWeight.Black, 
                            fontStyle = FontStyle.Italic,
                            color = theme.colors.textPrimary, 
                            lineHeight = 32.sp,
                            letterSpacing = (-1.5).sp
                        )
                        Text(
                            "APPROVALS", 
                            fontSize = 30.sp, 
                            fontWeight = FontWeight.Black, 
                            fontStyle = FontStyle.Italic,
                            color = theme.colors.accent, 
                            lineHeight = 32.sp,
                            letterSpacing = (-1.5).sp
                        )
                        Text(
                            "Review new admin requests",
                            fontSize = 10.sp, 
                            fontWeight = FontWeight.Black, 
                            color = theme.colors.textDisabled, 
                            letterSpacing = 4.sp
                        )
                    }
                }
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(theme.colors.accent)
                        .shadow(theme.elevation.elevated, RoundedCornerShape(16.dp)), 
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Shield, null, tint = Color.White, modifier = Modifier.size(28.dp))
                }
            }

            Spacer(Modifier.height(32.dp))

            // Search
            OutlinedTextField(
                value = searchTerm,
                onValueChange = { searchTerm = it },
                placeholder = { Text("Search pending requests...", color = theme.colors.textDisabled, fontWeight = FontWeight.Bold) },
                leadingIcon = { Icon(Icons.Default.Search, null, tint = theme.colors.textDisabled, modifier = Modifier.size(20.dp)) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .shadow(4.dp, RoundedCornerShape(20.dp), spotColor = Color.Black.copy(0.1f)),
                shape = RoundedCornerShape(20.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color.Transparent,
                    unfocusedBorderColor = Color.Transparent,
                    focusedContainerColor = theme.colors.card,
                    unfocusedContainerColor = theme.colors.card,
                    focusedTextColor = theme.colors.textPrimary,
                    unfocusedTextColor = theme.colors.textPrimary
                )
            )

            Spacer(Modifier.height(24.dp))

            if (viewModel.isLoading) {
                val infiniteTransition = rememberInfiniteTransition(label = "loading")
                val alpha by infiniteTransition.animateFloat(
                    initialValue = 0.4f,
                    targetValue = 1f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(1000, easing = LinearOutSlowInEasing),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "alpha"
                )

                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.graphicsLayer(alpha = alpha)) {
                        CircularProgressIndicator(color = theme.colors.accent, strokeWidth = 3.dp, modifier = Modifier.size(48.dp))
                        Spacer(Modifier.height(16.dp))
                        Text("LOADING REQUESTS...", fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 3.sp)
                    }
                }
            } else if (viewModel.errorMsg != null) {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                        Icon(Icons.Default.Error, null, tint = theme.colors.error, modifier = Modifier.size(48.dp))
                        Spacer(Modifier.height(16.dp))
                        Text(viewModel.errorMsg!!, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = theme.colors.error, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    }
                }
            } else if (filteredRequests.isEmpty()) {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(24.dp))
                            .background(theme.colors.backgroundSecondary.copy(0.3f))
                            .drawBehind {
                                drawRoundRect(
                                    color = theme.colors.border,
                                    style = Stroke(
                                        width = 2.dp.toPx(),
                                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f), 0f)
                                    ),
                                    cornerRadius = CornerRadius(24.dp.toPx())
                                )
                            }
                            .padding(64.dp), 
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            if (searchTerm.isEmpty()) "NO PENDING APPROVALS" else "NO MATCHES FOUND", 
                            fontSize = 12.sp, 
                            fontWeight = FontWeight.Black, 
                            color = theme.colors.textDisabled, 
                            letterSpacing = 2.sp
                        )
                    }
                }
            } else {
                LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(16.dp), contentPadding = PaddingValues(bottom = 32.dp)) {
                    itemsIndexed(filteredRequests) { index, req ->
                        val animatedAlpha = remember { Animatable(0f) }
                        val animatedOffset = remember { Animatable(20f) }

                        LaunchedEffect(Unit) {
                            launch {
                                kotlinx.coroutines.delay(index * 50L)
                                animatedAlpha.animateTo(1f, tween(300))
                            }
                            launch {
                                kotlinx.coroutines.delay(index * 50L)
                                animatedOffset.animateTo(0f, tween(300, easing = FastOutSlowInEasing))
                            }
                        }

                        Box(modifier = Modifier.graphicsLayer(alpha = animatedAlpha.value, translationY = animatedOffset.value)) {
                            ApprovalCard(
                                request = req,
                                onApprove = {
                                    viewModel.handleApprovalAction(req.id, "approved") { success, msg ->
                                        if (success) feedback = (msg ?: "User approved successfully.") to "success"
                                        else feedback = (msg ?: "Error approving user") to "error"
                                    }
                                },
                                onReject = {
                                    viewModel.handleApprovalAction(req.id, "rejected") { success, msg ->
                                        if (success) feedback = (msg ?: "User rejected successfully.") to "success"
                                        else feedback = (msg ?: "Error rejecting user") to "error"
                                    }
                                },
                                theme = theme
                            )
                        }
                    }
                }
            }
        }

        // Feedback toast
        AnimatedVisibility(
            visible = feedback != null,
            enter = fadeIn() + slideInVertically(),
            exit = fadeOut() + slideOutVertically(),
            modifier = Modifier.align(Alignment.TopCenter).padding(top = 24.dp)
        ) {
            feedback?.let { (msg, type) ->
                Box(
                    modifier = Modifier
                        .shadow(theme.elevation.elevated, RoundedCornerShape(12.dp))
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (type == "success") theme.colors.success else theme.colors.error)
                        .clickable { feedback = null }
                        .padding(horizontal = 24.dp, vertical = 16.dp)
                ) {
                    Text(msg, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                }
            }
        }
    }
}

@Composable
private fun ApprovalCard(
    request: PendingRequest,
    onApprove: () -> Unit,
    onReject: () -> Unit,
    theme: com.boxitt.app.theme.AppTheme
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(theme.elevation.card, RoundedCornerShape(24.dp))
            .clip(RoundedCornerShape(24.dp))
            .background(theme.colors.card)
            .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
            .padding(24.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(theme.colors.backgroundSecondary)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp)), 
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Person, null, tint = theme.colors.accent, modifier = Modifier.size(28.dp))
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        request.username ?: "Anonymous", 
                        fontSize = 20.sp, 
                        fontWeight = FontWeight.Black, 
                        color = theme.colors.textPrimary, 
                        style = TextStyle(fontStyle = FontStyle.Italic)
                    )
                    Text(
                        request.email, 
                        fontSize = 11.sp, 
                        fontWeight = FontWeight.Black, 
                        color = theme.colors.textDisabled, 
                        letterSpacing = 1.sp,
                        modifier = Modifier.graphicsLayer(alpha = 0.6f)
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(theme.colors.accent.copy(0.1f))
                                .border(1.dp, theme.colors.accent.copy(0.2f), CircleShape)
                                .padding(horizontal = 12.dp, vertical = 4.dp)
                        ) {
                            Text(
                                request.role.uppercase(), 
                                fontSize = 8.sp, 
                                fontWeight = FontWeight.Black, 
                                color = theme.colors.accent, 
                                letterSpacing = 1.sp
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Default.AccessTime, null, tint = theme.colors.textDisabled, modifier = Modifier.size(14.dp))
                            val formattedDate = remember(request.created_at) {
                                try {
                                    val input = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault())
                                    val output = java.text.SimpleDateFormat("dd/MM/yyyy, hh:mm a", java.util.Locale.getDefault())
                                    val date = input.parse(request.created_at)
                                    if (date != null) output.format(date) else request.created_at
                                } catch (e: Exception) { request.created_at }
                            }
                            Text(
                                formattedDate, 
                                fontSize = 9.sp, 
                                fontWeight = FontWeight.Black, 
                                color = theme.colors.textDisabled, 
                                letterSpacing = 1.sp
                            )
                        }
                    }
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = onApprove,
                    modifier = Modifier.weight(1f).height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.success),
                    shape = RoundedCornerShape(12.dp),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp, pressedElevation = 0.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.CheckCircle, null, modifier = Modifier.size(18.dp))
                        Text("APPROVE", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                    }
                }
                Button(
                    onClick = onReject,
                    modifier = Modifier.weight(1f).height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.error),
                    shape = RoundedCornerShape(12.dp),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp, pressedElevation = 0.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Cancel, null, modifier = Modifier.size(18.dp))
                        Text("REJECT", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                    }
                }
            }
        }
    }
}
