package com.boxitt.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.SportsMartialArts
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.boxitt.app.User
import com.boxitt.app.SportType
import com.boxitt.app.getSportCapability
import com.boxitt.app.contexts.LocalAppTheme

@Composable
fun DashboardNavbar(
    user: User?,
    showMenu: Boolean = false,
    isAdminMode: Boolean = false,
    onSuperAdminDashboardClick: (() -> Unit)? = null,
    onAdminApprovalClick: (() -> Unit)? = null,
    onProfileClick: (() -> Unit)? = null,
    onLogout: (() -> Unit)? = null,
    onBackClick: (() -> Unit)? = null,
    onChallengesClick: (() -> Unit)? = null,
    onNavigate: ((String) -> Unit)? = null,
    onSuperAdminMode: (() -> Unit)? = null,
    onAddArena: (() -> Unit)? = null,
    onChangePassword: (() -> Unit)? = null,
    onExitAdminMode: (() -> Unit)? = null,
    selectedSport: SportType? = null
) {
    val theme = LocalAppTheme.current
    val isApproved = user?.role_status == "approved"
    val isSuperAdmin = user?.role == "superadmin" && isApproved
    var menuExpanded by remember { mutableStateOf(false) }
    val supportsChallenge = selectedSport == null || getSportCapability(selectedSport).supportsChallenge

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Left: Logo
        Text(
            "BOXITT",
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
            color = theme.colors.textPrimary,
            letterSpacing = (-1).sp
        )

        // Right: Action Icons
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Challenges
            if (supportsChallenge) {
                IconButton(
                    onClick = { onChallengesClick?.invoke() },
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(theme.colors.backgroundSecondary)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                ) {
                    Icon(Icons.Default.SportsMartialArts, null, tint = theme.colors.textPrimary, modifier = Modifier.size(20.dp))
                }
            }

            // Notifications
            NotificationBell(userId = user?.id, onNavigate = onNavigate)

            // Profile
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(theme.colors.backgroundSecondary)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                    .clickable { onProfileClick?.invoke() },
                contentAlignment = Alignment.Center
            ) {
                if (!user?.profileImageUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = user!!.profileImageUrl,
                        contentDescription = "Profile",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = "Profile",
                        tint = theme.colors.textDisabled,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // 3-dots Menu
            if (showMenu && isSuperAdmin) {
                Box {
                    IconButton(
                        onClick = { menuExpanded = true },
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(theme.colors.backgroundSecondary)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                    ) {
                        Icon(Icons.Default.MoreVert, null, tint = theme.colors.textPrimary)
                    }

                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false },
                        modifier = Modifier
                            .background(theme.colors.card)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(16.dp))
                    ) {
                        if (isSuperAdmin) {
                            DropdownMenuItem(
                                text = { Text("Admin approval only", fontWeight = FontWeight.Bold, color = theme.colors.success, fontSize = 12.sp) },
                                onClick = {
                                    menuExpanded = false
                                    onAdminApprovalClick?.invoke()
                                },
                                leadingIcon = { Icon(Icons.Default.Shield, null, tint = theme.colors.success, modifier = Modifier.size(16.dp)) }
                            )

                            if (isAdminMode) {
                                DropdownMenuItem(
                                    text = { Text("Change Password", fontWeight = FontWeight.Bold, color = theme.colors.textPrimary, fontSize = 12.sp) },
                                    onClick = {
                                        menuExpanded = false
                                        onChangePassword?.invoke()
                                    },
                                    leadingIcon = { Icon(Icons.Default.Settings, null, tint = theme.colors.textPrimary, modifier = Modifier.size(16.dp)) }
                                )
                                DropdownMenuItem(
                                    text = { Text("Add Arena", fontWeight = FontWeight.Bold, color = theme.colors.accent, fontSize = 12.sp) },
                                    onClick = {
                                        menuExpanded = false
                                        onAddArena?.invoke()
                                    },
                                    leadingIcon = { Icon(Icons.Default.Add, null, tint = theme.colors.accent, modifier = Modifier.size(16.dp)) }
                                )
                                DropdownMenuItem(
                                    text = { Text("Exit Admin", fontWeight = FontWeight.Bold, color = theme.colors.error, fontSize = 12.sp) },
                                    onClick = {
                                        menuExpanded = false
                                        onExitAdminMode?.invoke()
                                    },
                                    leadingIcon = { Icon(Icons.Default.ExitToApp, null, tint = theme.colors.error, modifier = Modifier.size(16.dp)) }
                                )
                            } else {
                                DropdownMenuItem(
                                    text = { Text("Super Admin", fontWeight = FontWeight.Bold, color = theme.colors.textSecondary, fontSize = 12.sp) },
                                    onClick = {
                                        menuExpanded = false
                                        onSuperAdminMode?.invoke()
                                    },
                                    leadingIcon = { Icon(Icons.Default.Key, null, tint = theme.colors.textSecondary, modifier = Modifier.size(16.dp)) }
                                )
                            }
                        }

                        DropdownMenuItem(
                            text = { Text("Logout", fontWeight = FontWeight.Bold, color = theme.colors.error, fontSize = 12.sp) },
                            onClick = {
                                menuExpanded = false
                                onLogout?.invoke()
                            }
                        )
                    }
                }
            }
        }
    }
}
