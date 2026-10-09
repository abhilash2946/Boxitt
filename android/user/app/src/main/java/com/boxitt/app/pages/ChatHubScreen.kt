package com.boxitt.app.pages

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.contexts.LocalAppTheme
import kotlinx.coroutines.launch

data class ComposeRoom(
    val id: String,
    val name: String,
    val lastMessage: String,
    val time: String,
    val isMatch: Boolean,
    val memberCount: Int,
    val capacity: Int,
    val isReadonly: Boolean,
    val avatarUrl: String? = null,
    val unreadCount: Int = 0
)

data class ComposeMessage(
    val id: String,
    val senderUsername: String,
    val text: String,
    val time: String,
    val isMe: Boolean,
    val messageType: String = "text",
    val isSystem: Boolean = false,
    val payloadAmount: Int = 0,
    val payloadText: String = ""
)

data class ComposeUserProfile(
    val username: String,
    val displayName: String,
    val location: String = "Chowder Guda",
    val playerScore: Int = 815,
    val matchesPlayed: Int = 12,
    val winRate: String = "68%",
    val rating: String = "4.8"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatHubScreen(
    currentUserId: String?,
    onBack: (() -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val coroutineScope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    var selectedFilter by remember { mutableStateOf("ALL") }
    var activeRoom by remember { mutableStateOf<ComposeRoom?>(null) }
    var showGroupInfoSheet by remember { mutableStateOf(false) }
    var inspectingUserProfile by remember { mutableStateOf<ComposeUserProfile?>(null) }
    var isConnected by remember { mutableStateOf(false) }
    var isConnectPending by remember { mutableStateOf(false) }

    var showHeaderMenu by remember { mutableStateOf(false) }
    var showQuickMenu by remember { mutableStateOf(false) }
    var pendingActionRoom by remember { mutableStateOf<ComposeRoom?>(null) }
    var pendingActionType by remember { mutableStateOf<String?>(null) }

    var showCreateGroupDialog by remember { mutableStateOf(false) }
    var newGroupNameInput by remember { mutableStateOf("") }

    val sampleRooms = remember {
        mutableStateListOf(
            ComposeRoom("1", "JOINABLE BOX CRICKET MATCH (2026-10-06 3:00 AM - 4:00 AM)", "Group created for joinable match at 2026-10-06 3:00 AM - 4:00 AM", "12:43 AM", true, 2, 10, false, unreadCount = 1),
            ComposeRoom("2", "PERSONAL SQUAD", "You were added by ABHILASH VANGARI", "08:20 PM", false, 3, 10, false, unreadCount = 1),
            ComposeRoom("3", "ABHILASH VANGARI", "Nice enjoy", "5:44 PM", false, 2, 2, false, unreadCount = 0)
        )
    }

    val sampleMessages = remember {
        mutableStateListOf(
            ComposeMessage("m1", "System", "Group created for joinable match at 2026-10-06 3:00 AM - 4:00 AM", "12:43 AM", false, isSystem = true),
            ComposeMessage("m2", "System", "You were added by ABHILASH VANGARI", "12:43 AM", false, isSystem = true),
            ComposeMessage("m3", "SAI CHARAN", "Tap header for group info", "5:52 PM", false),
            ComposeMessage("m4", "You", "Let's meet at Boxitt Turf", "5:54 PM", true)
        )
    }

    // Auto-scroll to bottom whenever messages update
    LaunchedEffect(sampleMessages.size) {
        if (sampleMessages.isNotEmpty()) {
            listState.animateScrollToItem(sampleMessages.size - 1)
        }
    }

    var textInput by remember { mutableStateOf("") }
    val mySentMessageCount = sampleMessages.count { it.isMe && !it.isSystem }
    val isMessageLimitReached = activeRoom?.isMatch == false && !isConnected && mySentMessageCount >= 1

    if (activeRoom == null) {
        // Chat List Screen
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(theme.colors.background)
        ) {
            // Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (onBack != null) {
                        IconButton(onClick = { onBack() }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = theme.colors.textPrimary)
                        }
                    }
                    Text(
                        text = "MESSAGES",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary
                    )
                }

                Button(
                    onClick = { showCreateGroupDialog = true },
                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.GroupAdd, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("+ GROUP", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
            }

            // Filter Tabs
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("ALL", "UNREAD", "MATCHES", "GROUPS").forEach { f ->
                    val isSelected = selectedFilter == f
                    Surface(
                        onClick = { selectedFilter = f },
                        shape = RoundedCornerShape(20.dp),
                        color = if (isSelected) theme.colors.accent else theme.colors.card,
                        modifier = Modifier.padding(2.dp)
                    ) {
                        Text(
                            text = f,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = if (isSelected) Color.White else theme.colors.textSecondary,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }
            }

            // Chat List Items
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(sampleRooms) { room ->
                    var cardMenuExpanded by remember { mutableStateOf(false) }

                    Surface(
                        onClick = { activeRoom = room },
                        shape = RoundedCornerShape(16.dp),
                        color = theme.colors.card,
                        shadowElevation = 2.dp,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(theme.colors.accent.copy(alpha = 0.15f))
                                    .clickable {
                                        inspectingUserProfile = ComposeUserProfile(
                                            username = room.name.lowercase().replace(" ", "_"),
                                            displayName = room.name
                                        )
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = if (room.isMatch) Icons.Default.Group else Icons.Default.Person,
                                    contentDescription = null,
                                    tint = theme.colors.accent
                                )
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = room.name,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.colors.textPrimary,
                                        modifier = Modifier.weight(1f, fill = false)
                                    )
                                    Text(
                                        text = room.time,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = theme.colors.textDisabled
                                    )
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = room.lastMessage,
                                        fontSize = 11.sp,
                                        color = theme.colors.textSecondary,
                                        maxLines = 1,
                                        modifier = Modifier.weight(1f)
                                    )
                                    if (room.unreadCount > 0) {
                                        Surface(
                                            shape = CircleShape,
                                            color = theme.colors.accent,
                                            modifier = Modifier.padding(start = 6.dp)
                                        ) {
                                            Text(
                                                text = room.unreadCount.toString(),
                                                color = Color.White,
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Black,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                            }

                            // 3-Dots Action Menu for Card
                            Box {
                                IconButton(onClick = { cardMenuExpanded = true }) {
                                    Icon(Icons.Default.MoreVert, contentDescription = "More Options", tint = theme.colors.textSecondary)
                                }
                                DropdownMenu(
                                    expanded = cardMenuExpanded,
                                    onDismissRequest = { cardMenuExpanded = false }
                                ) {
                                    DropdownMenuItem(
                                        text = { Text("Clear Messages", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                        onClick = {
                                            pendingActionRoom = room
                                            pendingActionType = "CLEAR"
                                            cardMenuExpanded = false
                                        },
                                        leadingIcon = { Icon(Icons.Default.CleaningServices, contentDescription = null, tint = Color(0xFFF59E0B)) }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Delete Chat", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Red) },
                                        onClick = {
                                            pendingActionRoom = room
                                            pendingActionType = "DELETE"
                                            cardMenuExpanded = false
                                        },
                                        leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null, tint = Color.Red) }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        // Chat Detail Screen
        val room = activeRoom!!

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(theme.colors.background)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header Bar (Fixed at Top)
                Surface(
                    color = theme.colors.card,
                    shadowElevation = 4.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .weight(1f)
                                .clickable { showGroupInfoSheet = true }
                        ) {
                            IconButton(onClick = { activeRoom = null }) {
                                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = theme.colors.textPrimary)
                            }

                            Column {
                                Text(
                                    text = room.name,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.colors.textPrimary
                                )
                                Text(
                                    text = "${room.memberCount} Members • Tap for Group Info / Profile",
                                    fontSize = 10.sp,
                                    color = theme.colors.textDisabled
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            // Header 3-Dots Menu
                            Box {
                                IconButton(onClick = { showHeaderMenu = true }) {
                                    Icon(Icons.Default.MoreVert, contentDescription = "Menu", tint = theme.colors.textPrimary)
                                }
                                DropdownMenu(
                                    expanded = showHeaderMenu,
                                    onDismissRequest = { showHeaderMenu = false }
                                ) {
                                    if (!room.isMatch && isConnected) {
                                        DropdownMenuItem(
                                            text = { Text("Unconnect / Unfriend", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Red) },
                                            onClick = {
                                                pendingActionRoom = activeRoom
                                                pendingActionType = "UNCONNECT"
                                                showHeaderMenu = false
                                            },
                                            leadingIcon = { Icon(Icons.Default.PersonRemove, contentDescription = null, tint = Color.Red) }
                                        )
                                    }
                                    DropdownMenuItem(
                                        text = { Text("Clear Messages", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                        onClick = {
                                            pendingActionRoom = activeRoom
                                            pendingActionType = "CLEAR"
                                            showHeaderMenu = false
                                        },
                                        leadingIcon = { Icon(Icons.Default.CleaningServices, contentDescription = null, tint = Color(0xFFF59E0B)) }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Delete Chat", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Red) },
                                        onClick = {
                                            pendingActionRoom = activeRoom
                                            pendingActionType = "DELETE"
                                            showHeaderMenu = false
                                        },
                                        leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null, tint = Color.Red) }
                                    )
                                }
                            }
                        }
                    }
                }

                // Messages Area (Only this area scrolls)
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(sampleMessages) { msg ->
                        if (msg.isSystem) {
                            val displayMsgText = if (msg.text.contains("Connect request")) {
                                if (msg.isMe) "🤝 Connect request sent to ${room.name}"
                                else "🤝 Connect request received from ${msg.senderUsername}"
                            } else {
                                msg.text
                            }
                            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = theme.colors.card
                                ) {
                                    Text(
                                        text = displayMsgText,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.colors.textSecondary,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        } else if (msg.messageType == "location_card") {
                            // High Contrast Location Card
                            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = if (msg.isMe) Alignment.CenterEnd else Alignment.CenterStart) {
                                Surface(
                                    shape = RoundedCornerShape(20.dp),
                                    color = Color(0xFF0F172A),
                                    shadowElevation = 6.dp,
                                    modifier = Modifier.width(260.dp)
                                ) {
                                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color(0xFF34D399), modifier = Modifier.size(18.dp))
                                            Text("BOXITT ARENA LOCATION", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF34D399))
                                        }
                                        Text("Boxitt Sports Turf, Chowder Guda", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
                                        Text("Ghatkesar Mandal, Hyderabad", fontSize = 10.sp, color = Color(0xFF94A3B8))
                                        Button(
                                            onClick = { },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                            shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Text("OPEN GOOGLE MAPS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White)
                                        }
                                    }
                                }
                            }
                        } else if (msg.messageType == "payment_card") {
                            // High Contrast Fee Split Card
                            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = if (msg.isMe) Alignment.CenterEnd else Alignment.CenterStart) {
                                Surface(
                                    shape = RoundedCornerShape(20.dp),
                                    color = Color(0xFF0F172A),
                                    shadowElevation = 6.dp,
                                    modifier = Modifier.width(260.dp)
                                ) {
                                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Icon(Icons.Default.CreditCard, contentDescription = null, tint = Color(0xFFFBBF24), modifier = Modifier.size(18.dp))
                                            Text("TURF FEE BREAKDOWN", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFFFBBF24))
                                        }
                                        Text(msg.text, fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
                                        Text(msg.payloadText, fontSize = 10.sp, color = Color(0xFFCBD5E1))
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = Color(0xFF020617),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(10.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Text("TOTAL: ₹1000", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                                Text("YOUR SHARE: ₹500", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFFFBBF24))
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalAlignment = if (msg.isMe) Alignment.End else Alignment.Start
                            ) {
                                if (!msg.isMe) {
                                    Text(
                                        text = "@${msg.senderUsername.lowercase().replace(" ", "_")}",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.colors.textDisabled,
                                        modifier = Modifier
                                            .padding(bottom = 2.dp)
                                            .clickable {
                                                inspectingUserProfile = ComposeUserProfile(
                                                    username = msg.senderUsername.lowercase().replace(" ", "_"),
                                                    displayName = msg.senderUsername
                                                )
                                            }
                                    )
                                }
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = if (msg.isMe) theme.colors.accent else theme.colors.card
                                ) {
                                    Text(
                                        text = msg.text,
                                        fontSize = 12.sp,
                                        color = if (msg.isMe) Color.White else theme.colors.textPrimary,
                                        modifier = Modifier.padding(10.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                // Bottom Text Input Bar (Fixed at Very Bottom)
                if (isMessageLimitReached) {
                    Surface(
                        color = theme.colors.accent.copy(alpha = 0.1f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = if (isConnectPending) "🔒 Connect request pending. Waiting to accept." else "🔒 1-Message inquiry limit reached. Connect to send more messages.",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.accent
                            )
                            if (!isConnectPending) {
                                Button(
                                    onClick = {
                                        isConnectPending = true
                                        sampleMessages.add(ComposeMessage("m${System.currentTimeMillis()}", "System", "🤝 Connect request sent to ${room.name}", "Just now", false, isSystem = true))
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                                ) {
                                    Text("🤝 Send Connect Request", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White)
                                }
                            }
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Quick Action Dropdown Button (Zap / ⚡)
                        Box {
                            IconButton(
                                onClick = { showQuickMenu = !showQuickMenu },
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(theme.colors.card)
                            ) {
                                Icon(Icons.Default.Zap, contentDescription = "Quick Messages", tint = theme.colors.accent)
                            }

                            DropdownMenu(
                                expanded = showQuickMenu,
                                onDismissRequest = { showQuickMenu = false }
                            ) {
                                if (!room.isMatch) {
                                    DropdownMenuItem(
                                        text = { Text("👋 Interested in playing a match?", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                        onClick = {
                                            textInput = "👋 Interested in playing a match?"
                                            showQuickMenu = false
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("🏟️ Which box/turf should we book?", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                        onClick = {
                                            textInput = "🏟️ Which box should we book?"
                                            showQuickMenu = false
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("📅 What time works best?", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                        onClick = {
                                            textInput = "📅 What time works best?"
                                            showQuickMenu = false
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("⚡ Want to challenge?", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B)) },
                                        onClick = {
                                            textInput = "⚡ Want to challenge?"
                                            showQuickMenu = false
                                        }
                                    )
                                } else {
                                    DropdownMenuItem(
                                        text = { Text("🟢 I'm In", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                        onClick = {
                                            sampleMessages.add(ComposeMessage("m${System.currentTimeMillis()}", "System", "🟢 I'm In", "Just now", false, isSystem = true))
                                            showQuickMenu = false
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("🔴 Can't Make It", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Red) },
                                        onClick = {
                                            sampleMessages.add(ComposeMessage("m${System.currentTimeMillis()}", "System", "🔴 Can't Make It", "Just now", false, isSystem = true))
                                            showQuickMenu = false
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("⏳ Running 5 Mins Late", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B)) },
                                        onClick = {
                                            sampleMessages.add(ComposeMessage("m${System.currentTimeMillis()}", "System", "⏳ Running 5 Mins Late", "Just now", false, isSystem = true))
                                            showQuickMenu = false
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("📍 Share Booked Box Location", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981)) },
                                        onClick = {
                                            sampleMessages.add(ComposeMessage("m${System.currentTimeMillis()}", "You", room.name, "Just now", true, messageType = "location_card"))
                                            showQuickMenu = false
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("💳 Request Turf Fee Split", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B)) },
                                        onClick = {
                                            sampleMessages.add(ComposeMessage("m${System.currentTimeMillis()}", "You", "💳 50/50 Equal Turf Split: ₹500 each", "Just now", true, messageType = "payment_card", payloadText = "Equal 50/50 turf fee split between Challenger and Challengee."))
                                            showQuickMenu = false
                                        }
                                    )
                                }
                            }
                        }

                        OutlinedTextField(
                            value = textInput,
                            onValueChange = { textInput = it },
                            placeholder = { Text("Type a message...", fontSize = 12.sp) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(16.dp)
                        )

                        IconButton(
                            onClick = {
                                if (textInput.isNotBlank()) {
                                    sampleMessages.add(ComposeMessage("m${System.currentTimeMillis()}", "You", textInput.trim(), "Just now", true))
                                    textInput = ""
                                }
                            },
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(theme.colors.accent)
                        ) {
                            Icon(Icons.Default.Send, contentDescription = "Send", tint = Color.White)
                        }
                    }
                }
            }

            // WhatsApp-Style Floating Scroll to Bottom Button (↓)
            val showScrollBottom by remember {
                derivedStateOf { listState.firstVisibleItemIndex > 2 }
            }

            AnimatedVisibility(
                visible = showScrollBottom,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = 80.dp)
            ) {
                FloatingActionButton(
                    onClick = {
                        coroutineScope.launch {
                            listState.animateScrollToItem(sampleMessages.size - 1)
                        }
                    },
                    containerColor = Color(0xFF0F172A),
                    contentColor = theme.colors.accent,
                    shape = CircleShape,
                    modifier = Modifier.size(44.dp)
                ) {
                    Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Scroll to Bottom", tint = theme.colors.accent)
                }
            }
        }

        // Group Info Bottom Sheet
        if (showGroupInfoSheet) {
            ModalBottomSheet(
                onDismissRequest = { showGroupInfoSheet = false }
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(text = room.name, fontSize = 18.sp, fontWeight = FontWeight.Black)
                    Text(text = "Capacity: ${room.memberCount} / ${room.capacity} Players", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = theme.colors.accent)

                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "MEMBERS (${room.memberCount})",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textDisabled
                        )

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(theme.colors.card)
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = room.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)

                            if (!room.isMatch) {
                                if (isConnected) {
                                    IconButton(
                                        onClick = {
                                            showGroupInfoSheet = false
                                            pendingActionRoom = activeRoom
                                            pendingActionType = "UNCONNECT"
                                        }
                                    ) {
                                        Icon(Icons.Default.PersonRemove, contentDescription = "Unconnect", tint = Color.Red)
                                    }
                                } else if (isConnectPending) {
                                    Text("⏳ Pending", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                                } else {
                                    IconButton(
                                        onClick = {
                                            isConnectPending = true
                                            sampleMessages.add(ComposeMessage("m${System.currentTimeMillis()}", "System", "🤝 Connect request sent to ${room.name}", "Just now", false, isSystem = true))
                                        }
                                    ) {
                                        Icon(Icons.Default.PersonAdd, contentDescription = "Connect", tint = Color(0xFF10B981))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Player Profile View Modal Sheet
        if (inspectingUserProfile != null) {
            val prof = inspectingUserProfile!!
            ModalBottomSheet(
                onDismissRequest = { inspectingUserProfile = null }
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(theme.colors.accent.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = prof.displayName.take(2).uppercase(),
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.accent
                        )
                    }

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = prof.displayName.uppercase(), fontSize = 18.sp, fontWeight = FontWeight.Black)
                        Text(text = "@${prof.username} • ${prof.location}", fontSize = 12.sp, color = theme.colors.textDisabled)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = theme.colors.card,
                            modifier = Modifier.weight(1f).padding(4.dp)
                        ) {
                            Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${prof.playerScore}", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.accent)
                                Text("PLAYER SCORE", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                            }
                        }
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = theme.colors.card,
                            modifier = Modifier.weight(1f).padding(4.dp)
                        ) {
                            Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(prof.winRate, fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFF34D399))
                                Text("WIN RATE", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = theme.colors.textDisabled)
                            }
                        }
                    }
                }
            }
        }
    }

    // Custom Confirmation Dialog for Delete / Clear / Unconnect
    if (pendingActionType != null && pendingActionRoom != null) {
        val targetRoom = pendingActionRoom!!
        val isDelete = pendingActionType == "DELETE"
        val isUnconnect = pendingActionType == "UNCONNECT"

        AlertDialog(
            onDismissRequest = {
                pendingActionType = null
                pendingActionRoom = null
            },
            icon = {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(if (isDelete || isUnconnect) Color(0x1FEF4444) else Color(0x1FF59E0B)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isDelete) Icons.Default.Delete else if (isUnconnect) Icons.Default.PersonRemove else Icons.Default.CleaningServices,
                        contentDescription = null,
                        tint = if (isDelete || isUnconnect) Color(0xFFEF4444) else Color(0xFFF59E0B),
                        modifier = Modifier.size(28.dp)
                    )
                }
            },
            title = {
                Text(
                    text = if (isDelete) "DELETE CHAT ROOM" else if (isUnconnect) "UNCONNECT DIRECT CHAT" else "CLEAR MESSAGES",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textPrimary
                )
            },
            text = {
                Text(
                    text = if (isDelete)
                        "Are you sure you want to delete this chat room permanently from the database? All messages and chat records will be deleted completely."
                    else if (isUnconnect)
                        "Are you sure you want to unconnect with ${targetRoom.name}? This will unfriend them and restore the 1-message inquiry limit."
                    else
                        "Are you sure you want to clear all messages in this chat? All message history in this chat room will be erased.",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = theme.colors.textSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (isDelete) {
                            sampleRooms.remove(targetRoom)
                            if (activeRoom?.id == targetRoom.id) {
                                activeRoom = null
                            }
                        } else if (isUnconnect) {
                            isConnected = false
                            isConnectPending = false
                            sampleMessages.add(ComposeMessage("m${System.currentTimeMillis()}", "System", "🔴 You and ${targetRoom.name} are no longer connected.", "Just now", false, isSystem = true))
                        } else {
                            sampleMessages.clear()
                        }
                        pendingActionType = null
                        pendingActionRoom = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isDelete || isUnconnect) Color(0xFFEF4444) else theme.colors.accent
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        if (isDelete) {
                            Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                        } else if (isUnconnect) {
                            Icon(Icons.Default.PersonRemove, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                        Text(
                            text = if (isDelete) "Delete Chat" else if (isUnconnect) "Unconnect" else "Clear Messages",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White
                        )
                    }
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = {
                        pendingActionType = null
                        pendingActionRoom = null
                    },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "Cancel",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.colors.textPrimary
                    )
                }
            },
            containerColor = theme.colors.card,
            shape = RoundedCornerShape(24.dp)
        )
    }

    if (showCreateGroupDialog) {
        AlertDialog(
            onDismissRequest = { showCreateGroupDialog = false },
            title = {
                Text(
                    text = "CREATE PERSONAL GROUP",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textPrimary
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "Group Name",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.colors.textSecondary
                    )
                    OutlinedTextField(
                        value = newGroupNameInput,
                        onValueChange = { newGroupNameInput = it },
                        placeholder = { Text("e.g. Weekend Squad", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newGroupNameInput.isNotBlank()) {
                            val createdRoom = ComposeRoom(
                                id = System.currentTimeMillis().toString(),
                                name = newGroupNameInput.uppercase(),
                                lastMessage = "Group \"${newGroupNameInput}\" created by You",
                                time = "Just now",
                                isMatch = false,
                                memberCount = 1,
                                capacity = 10,
                                isReadonly = false,
                                unreadCount = 0
                            )
                            sampleRooms.add(0, createdRoom)
                            showCreateGroupDialog = false
                            newGroupNameInput = ""
                            activeRoom = createdRoom
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("CREATE", fontSize = 12.sp, fontWeight = FontWeight.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = { showCreateGroupDialog = false }) {
                    Text("CANCEL", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = theme.colors.textSecondary)
                }
            },
            containerColor = theme.colors.card,
            shape = RoundedCornerShape(20.dp)
        )
    }
}
