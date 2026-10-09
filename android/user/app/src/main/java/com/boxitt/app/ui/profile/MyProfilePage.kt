package com.boxitt.app.ui.profile

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.activity.compose.BackHandler
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.rememberAsyncImagePainter
import com.boxitt.app.UserProfile
import com.boxitt.app.components.ThemeSelector
import com.boxitt.app.components.ViewProfileScreen
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.theme.ThemeName
import com.boxitt.app.navigation.Screen
import com.boxitt.app.services.AuthService
import com.boxitt.app.services.Storage
import kotlinx.coroutines.launch

@Composable
fun MyProfilePage(
    onNavigate: (String) -> Unit,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null,
    onConfirm: ((String, () -> Unit, (() -> Unit)?, String?, String?, Boolean?) -> Unit)? = null,
    viewModel: ProfileViewModel = hiltViewModel()
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    val uiState by viewModel.uiState.collectAsState()
    val user = uiState.user

    var showDetailedView by remember { mutableStateOf(false) }
    var showInviteDialog by remember { mutableStateOf(false) }

    BackHandler {
        if (showDetailedView) {
            showDetailedView = false
        } else {
            onNavigate("dashboard")
        }
    }

    if (uiState.isLoading && user == null) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(theme.colors.background),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = theme.colors.accent, modifier = Modifier.size(48.dp))
        }
        return
    }

    // Default or real user data
    val displayUsername = user?.displayName?.ifEmpty { "Rahul Kumar" } ?: "Rahul Kumar"
    val displayPhone = user?.phoneNumber?.ifEmpty { "+91 98765 43210" } ?: "+91 98765 43210"
    val profileImageUrl = user?.profileImageUrl
    val initials = displayUsername
        .split(" ")
        .mapNotNull { it.firstOrNull()?.toString() }
        .take(2)
        .joinToString("")
        .uppercase()
        .ifEmpty { "RK" }

    if (showDetailedView && user != null) {
        ViewProfileScreen(
            profile = user,
            onEdit = { onNavigate(Screen.EditProfile.route) },
            onLogout = {
                onConfirm?.invoke(
                    "Are you sure you want to logout?",
                    {
                        scope.launch {
                            AuthService.logOut()
                            Storage.logout()
                            onNavigate("login")
                        }
                    },
                    null,
                    "LOGOUT",
                    "CANCEL",
                    true
                ) ?: scope.launch {
                    AuthService.logOut()
                    Storage.logout()
                    onNavigate("login")
                }
            },
            onBack = { showDetailedView = false },
            onAlert = onAlert
        )
        return
    }

    val scrollState = rememberScrollState()

    Scaffold(
        containerColor = theme.colors.background,
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Back Button
                IconButton(
                    onClick = { onNavigate("dashboard") },
                    modifier = Modifier
                        .size(42.dp)
                        .background(theme.colors.card, CircleShape)
                        .border(1.dp, theme.colors.border, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = theme.colors.textPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Text(
                    text = "Profile",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.colors.textPrimary
                )

                // Theme / Settings
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ThemeSelector()
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // ─── TOP HERO CARD (RICH SIGNATURE DARK GREEN) ─────────────────
            val heroBgBrush = if (theme.name == ThemeName.DARK) {
                Brush.verticalGradient(listOf(Color(0xFF043E18), Color(0xFF0A1F12)))
            } else {
                Brush.verticalGradient(listOf(Color(0xFF04481C), Color(0xFF033314)))
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(28.dp))
                    .background(heroBgBrush)
                    .padding(vertical = 28.dp, horizontal = 20.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Avatar Circle with Camera Badge
                    Box(
                        modifier = Modifier.size(90.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(84.dp)
                                .clip(CircleShape)
                                .background(Color.White)
                                .clickable { onNavigate(Screen.EditProfile.route) },
                            contentAlignment = Alignment.Center
                        ) {
                            if (!profileImageUrl.isNullOrEmpty()) {
                                Image(
                                    painter = rememberAsyncImagePainter(profileImageUrl),
                                    contentDescription = "Avatar",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            } else {
                                Text(
                                    text = initials,
                                    color = Color(0xFF064E3B),
                                    fontSize = 28.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                        }

                        // Camera Icon Badge
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .offset(x = 2.dp, y = 2.dp)
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF059669))
                                .border(2.dp, Color.White, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CameraAlt,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(2.dp))

                    // Name
                    Text(
                        text = displayUsername,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )

                    // Phone
                    Text(
                        text = displayPhone,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White.copy(alpha = 0.85f),
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    // Buttons Row: [View profile] [Edit profile]
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Button(
                            onClick = { showDetailedView = true },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color.White,
                                contentColor = Color(0xFF064E3B)
                            ),
                            shape = RoundedCornerShape(20.dp),
                            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                            modifier = Modifier.height(40.dp)
                        ) {
                            Text(
                                text = "View profile",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        OutlinedButton(
                            onClick = { onNavigate(Screen.EditProfile.route) },
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.8f)),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(20.dp),
                            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                            modifier = Modifier.height(40.dp)
                        ) {
                            Text(
                                text = "Edit profile",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // ─── 3 STAT CARDS ROW (SCORE, MATCHES, RATING) ──────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Score Card
                StatCard(
                    title = "SCORE",
                    value = "842",
                    modifier = Modifier.weight(1f)
                )

                // Matches Card
                StatCard(
                    title = "MATCHES",
                    value = "37",
                    modifier = Modifier.weight(1f)
                )

                // Rating Card
                StatCard(
                    title = "RATING",
                    value = "4.8★",
                    modifier = Modifier.weight(1f)
                )
            }

            // ─── SECTION 1: ACCOUNT ─────────────────────────────────────────
            SectionContainer(title = "ACCOUNT") {
                ProfileMenuRow(
                    icon = Icons.Default.Person,
                    iconBg = Color(0xFFE0F2FE),
                    iconTint = Color(0xFF0284C7),
                    title = "View profile",
                    onClick = { showDetailedView = true }
                )
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 0.8.dp)
                ProfileMenuRow(
                    icon = Icons.Default.Edit,
                    iconBg = Color(0xFFDCFCE7),
                    iconTint = Color(0xFF16A34A),
                    title = "Edit profile",
                    onClick = { onNavigate(Screen.EditProfile.route) }
                )
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 0.8.dp)
                ProfileMenuRow(
                    icon = Icons.Default.EmojiEvents,
                    iconBg = Color(0xFFFEF3C7),
                    iconTint = Color(0xFFD97706),
                    title = "Player score",
                    subtitle = "Stats, badges & level",
                    onClick = { onNavigate(Screen.PlayerScore.route) }
                )
            }

            // ─── SECTION 2: ACTIVITY ────────────────────────────────────────
            SectionContainer(title = "ACTIVITY") {
                ProfileMenuRow(
                    icon = Icons.Default.CalendarToday,
                    iconBg = Color(0xFFFEE2E2),
                    iconTint = Color(0xFFDC2626),
                    title = "My bookings",
                    onClick = { onNavigate(Screen.History.route) }
                )
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 0.8.dp)
                ProfileMenuRow(
                    icon = Icons.Default.CreditCard,
                    iconBg = Color(0xFFFEF08A),
                    iconTint = Color(0xFFCA8A04),
                    title = "Payments & wallet",
                    onClick = { onNavigate(Screen.Transactions.route) }
                )
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 0.8.dp)
                ProfileMenuRow(
                    icon = Icons.Default.LocationCity,
                    iconBg = Color(0xFFCCFBF1),
                    iconTint = Color(0xFF0D9488),
                    title = "Saved arenas",
                    onClick = { onNavigate(Screen.ArenaList.route) }
                )
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 0.8.dp)
                ProfileMenuRow(
                    icon = Icons.Default.Notifications,
                    iconBg = Color(0xFFFEF9C3),
                    iconTint = Color(0xFFEAB308),
                    title = "Notifications",
                    onClick = { onNavigate(Screen.Notifications.route) }
                )
            }

            // ─── SECTION 3: SUPPORT ─────────────────────────────────────────
            SectionContainer(title = "SUPPORT") {
                ProfileMenuRow(
                    icon = Icons.Default.Call,
                    iconBg = Color(0xFFDCFCE7),
                    iconTint = Color(0xFF16A34A),
                    title = "Customer care",
                    onClick = { onNavigate(Screen.CustomerCare.route) }
                )
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 0.8.dp)
                ProfileMenuRow(
                    icon = Icons.Default.Info,
                    iconBg = Color(0xFFDCFCE7),
                    iconTint = Color(0xFF059669),
                    title = "About app",
                    onClick = { onNavigate(Screen.AboutApp.route) }
                )
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 0.8.dp)
                ProfileMenuRow(
                    icon = Icons.Default.People,
                    iconBg = Color(0xFFE0F2FE),
                    iconTint = Color(0xFF0284C7),
                    title = "Invite friends",
                    onClick = { showInviteDialog = true }
                )
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f), thickness = 0.8.dp)
                ProfileMenuRow(
                    icon = Icons.AutoMirrored.Filled.ExitToApp,
                    iconBg = Color(0xFFFFE4E6),
                    iconTint = Color(0xFFE11D48),
                    title = "Log out",
                    titleColor = Color(0xFFE11D48),
                    onClick = {
                        onConfirm?.invoke(
                            "Are you sure you want to logout?",
                            {
                                scope.launch {
                                    AuthService.logOut()
                                    Storage.logout()
                                    onNavigate("login")
                                }
                            },
                            null,
                            "LOGOUT",
                            "CANCEL",
                            true
                        ) ?: scope.launch {
                            AuthService.logOut()
                            Storage.logout()
                            onNavigate("login")
                        }
                    }
                )
            }

            // ─── FOOTER VERSION ─────────────────────────────────────────────
            Text(
                text = "boxitt v2.4.1",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = theme.colors.textDisabled,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp)
            )
        }
    }

    // Invite Friends Dialog
    if (showInviteDialog) {
        AlertDialog(
            onDismissRequest = { showInviteDialog = false },
            title = {
                Text(
                    text = "Invite Friends & Earn",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = theme.colors.textPrimary
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Share your referral link with sports buddies to get ₹100 wallet credits on their first booking!",
                        fontSize = 13.sp,
                        color = theme.colors.textSecondary
                    )
                    Text(
                        text = "Code: BOXITT-WIN50",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.accent
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, "Join Boxitt for turf bookings & live scoring! Use code BOXITT-WIN50 for ₹100 off: https://boxitt.app")
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share Boxitt"))
                        showInviteDialog = false
                    }
                ) {
                    Text("SHARE", color = theme.colors.accent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showInviteDialog = false }) {
                    Text("CANCEL", color = theme.colors.textSecondary)
                }
            },
            containerColor = theme.colors.card
        )
    }
}

// ─── STAT CARD HELPER ───────────────────────────────────────────────────────
@Composable
private fun StatCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier
) {
    val theme = LocalAppTheme.current
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(theme.colors.card)
            .border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))
            .padding(vertical = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = value,
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                color = theme.colors.textPrimary
            )
            Text(
                text = title,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = theme.colors.textSecondary,
                letterSpacing = 1.sp
            )
        }
    }
}

// ─── SECTION CONTAINER HELPER ───────────────────────────────────────────────
@Composable
private fun SectionContainer(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    val theme = LocalAppTheme.current
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = title,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = theme.colors.textSecondary,
            letterSpacing = 1.5.sp,
            modifier = Modifier.padding(start = 4.dp)
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(theme.colors.card)
                .border(1.dp, theme.colors.border, RoundedCornerShape(22.dp))
        ) {
            content()
        }
    }
}

// ─── MENU ROW ITEM HELPER ───────────────────────────────────────────────────
@Composable
private fun ProfileMenuRow(
    icon: ImageVector,
    iconBg: Color,
    iconTint: Color,
    title: String,
    subtitle: String? = null,
    titleColor: Color? = null,
    onClick: () -> Unit
) {
    val theme = LocalAppTheme.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(iconBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(20.dp)
                )
            }

            Column {
                Text(
                    text = title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = titleColor ?: theme.colors.textPrimary
                )
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = theme.colors.textSecondary
                    )
                }
            }
        }

        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = theme.colors.textSecondary.copy(alpha = 0.6f),
            modifier = Modifier.size(18.dp)
        )
    }
}
