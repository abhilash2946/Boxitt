package com.boxitt.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Notifications
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
import androidx.hilt.navigation.compose.hiltViewModel
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.contexts.PermissionsManager
import com.boxitt.app.contexts.PermissionType
import com.boxitt.app.hooks.NotificationsViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun NotificationBell(
    userId: String?,
    modifier: Modifier = Modifier,
    onSeeAll: (() -> Unit)? = null,
    onNavigate: ((String) -> Unit)? = null
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val theme = LocalAppTheme.current

    val viewModel: NotificationsViewModel = hiltViewModel()
    var isOpen by remember { mutableStateOf(false) }

    LaunchedEffect(userId) {
        if (userId != null) {
            viewModel.startSync(userId)
        } else {
            viewModel.stopSync()
        }
    }

    val unreadCount = viewModel.unreadCount
    val notifications = viewModel.notificationsList

    Box(modifier = modifier.wrapContentSize()) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(theme.radius.small))
                .background(theme.colors.backgroundSecondary)
                .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.small))
                .clickable {
                    if (PermissionsManager.permissionsState.notifications != "allow") {
                        PermissionsManager.checkAndPrompt(context, PermissionType.NOTIFICATIONS, false)
                    }
                    isOpen = !isOpen
                },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Notifications,
                contentDescription = "Notifications",
                tint = theme.colors.textDisabled,
                modifier = Modifier.size(24.dp)
            )
        }

        if (unreadCount > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 4.dp, y = (-4).dp)
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(theme.colors.error)
                    .border(2.dp, theme.colors.card, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = unreadCount.toString(),
                    color = Color.White,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.padding(bottom = 1.dp) // Slight adjustment for some fonts to look centered
                )
            }
        }

        DropdownMenu(
            expanded = isOpen,
            onDismissRequest = { isOpen = false },
            modifier = Modifier
                .width(320.dp)
                .heightIn(max = 480.dp)
                .background(theme.colors.background)
                .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "NOTIFICATIONS",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary,
                        letterSpacing = 1.sp
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (onSeeAll != null) {
                            Text(
                                text = "SEE ALL",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.accent,
                                modifier = Modifier
                                    .clickable {
                                        isOpen = false
                                        onSeeAll()
                                    }
                                    .padding(end = 8.dp)
                            )
                        }
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                            contentDescription = "Open",
                            tint = theme.colors.textPrimary,
                            modifier = Modifier
                                .size(18.dp)
                                .clickable {
                                    isOpen = false
                                    onNavigate?.invoke("notifications")
                                }
                        )
                    }
                }

                HorizontalDivider(color = theme.colors.border)

                if (notifications.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "NONE",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = theme.colors.textDisabled
                        )
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f, fill = false)
                            .verticalScroll(rememberScrollState())
                    ) {
                        notifications.forEach { notif ->
                            val timeStr = try {
                                val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                                val date = parser.parse(notif.created_at) ?: Date()
                                SimpleDateFormat("hh:mm a", Locale.getDefault()).format(date)
                            } catch (e: Exception) {
                                ""
                            }

                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        val isMatchmaking = notif.title.lowercase().contains("challenge") ||
                                                notif.title.lowercase().contains("joinable") ||
                                                notif.data?.contains("challenge") == true ||
                                                notif.data?.contains("joinable") == true

                                        if (isMatchmaking) {
                                            onNavigate?.invoke("challenges")
                                        }
                                        isOpen = false
                                    }
                                    .padding(16.dp)
                            ) {
                                Text(
                                    text = notif.title,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.colors.textPrimary
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = notif.message,
                                    fontSize = 11.sp,
                                    color = theme.colors.textSecondary
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = timeStr,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.colors.textDisabled
                                    )
                                    val isChallenge = notif.title.lowercase().contains("challenge") || notif.data?.contains("challenge") == true
                                    val isJoinable = notif.title.lowercase().contains("joinable") || notif.data?.contains("joinable") == true

                                    if (isChallenge || isJoinable) {
                                        Box(
                                            modifier = Modifier
                                                .background(theme.colors.accent.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                                                .border(1.dp, theme.colors.accent.copy(alpha = 0.2f), RoundedCornerShape(10.dp))
                                                .padding(horizontal = 8.dp, vertical = 2.dp)
                                        ) {
                                            Text(
                                                text = if (isChallenge) "OPEN CHALLENGE" else "JOINABLE MATCH",
                                                fontSize = 8.sp,
                                                fontWeight = FontWeight.Black,
                                                color = theme.colors.accent
                                            )
                                        }
                                    }
                                }
                            }
                            HorizontalDivider(color = theme.colors.border)
                        }
                    }
                }
            }
        }
    }
}
