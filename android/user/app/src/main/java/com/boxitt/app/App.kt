package com.boxitt.app

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.boxitt.app.theme.ThemeName
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.navigation.BoxittNavGraph
import com.boxitt.app.navigation.NavigationViewModel
import com.boxitt.app.navigation.Screen
import com.boxitt.app.components.DashboardNavbar
import com.boxitt.app.components.BottomNavbar
import com.boxitt.app.services.SessionManager
import com.boxitt.app.services.ErrorHandler
import androidx.hilt.navigation.compose.hiltViewModel

data class GlobalAlert(
    val message: String,
    val type: String, // "success", "error", "info"
    val onClose: (() -> Unit)? = null
)

data class GlobalConfirm(
    val message: String,
    val onConfirm: () -> Unit,
    val onCancel: (() -> Unit)? = null,
    val confirmText: String? = null,
    val cancelText: String? = null,
    val isDestructive: Boolean = false
)

@Composable
fun App(
    sessionManager: SessionManager,
    navViewModel: NavigationViewModel = hiltViewModel()
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Use synchronous storage as hint for initial state to avoid "flash"
    val initialUser = remember { com.boxitt.app.services.Storage.getUser() }
    val isLoggedIn by sessionManager.isLoggedIn.collectAsState(initial = initialUser != null)
    val isProfileComplete by sessionManager.isProfileComplete.collectAsState(initial = initialUser?.isComplete ?: false)
    val userProfile by sessionManager.userProfile.collectAsState(initial = initialUser?.toUserProfile())
    val selectedSport by navViewModel.selectedSport.collectAsState()
    val selectedLocation by navViewModel.selectedLocation.collectAsState()

    var isAdminMode by remember { mutableStateOf(com.boxitt.app.services.Storage.isSuperAdminSession()) }
    var triggerShowLogin by remember { mutableStateOf(false) }
    var triggerShowAdd by remember { mutableStateOf(false) }
    var triggerShowReset by remember { mutableStateOf(false) }

    var globalAlert by remember { mutableStateOf<GlobalAlert?>(null) }
    var globalConfirm by remember { mutableStateOf<GlobalConfirm?>(null) }

    val triggerAlert: (String, String, (() -> Unit)?) -> Unit = { msg, type, onClose ->
        globalAlert = GlobalAlert(msg, type, onClose)
    }

    val triggerConfirm: (String, () -> Unit, (() -> Unit)?, String?, String?, Boolean?) -> Unit = 
        { msg, onConfirm, onCancel, confirmText, cancelText, isDestructive ->
            globalConfirm = GlobalConfirm(msg, onConfirm, onCancel, confirmText, cancelText, isDestructive ?: false)
        }

    val startDestination = remember(isLoggedIn, isProfileComplete) {
        if (!isLoggedIn) Screen.Login.route
        else if (!isProfileComplete) Screen.EditProfile.route
        else Screen.SportSelector.route
    }

    Scaffold(
        topBar = {
            val authRoutes = listOf(
                Screen.Login.route,
                Screen.PendingApproval.route,
                Screen.ResetPassword.route,
                Screen.AdminLogin.route,
                Screen.Review.route
            )
            val showTopBar = isLoggedIn && currentRoute !in authRoutes && currentRoute != Screen.Transactions.route

            if (showTopBar) {
                DashboardNavbar(
                    user = userProfile?.let { p ->
                        User(
                            id = p.id,
                            email = p.email,
                            display_name = p.displayName,
                            phone_number = p.phoneNumber,
                            avatar_url = p.avatar_url,
                            role = p.role,
                            role_status = p.role_status,
                            profileImage = p.profileImage
                        )
                    },
                    showMenu = currentRoute?.startsWith(Screen.LocationSelector.route.split("?")[0]) == true,
                    isAdminMode = isAdminMode,
                    onAdminApprovalClick = {
                        if (userProfile?.role == "superadmin") {
                            navController.navigate(Screen.SuperAdminApproval.route)
                        }
                    },
                    onSuperAdminDashboardClick = { 
                        if (userProfile?.role == "superadmin") {
                            navController.navigate(Screen.SuperAdminDashboard.route)
                        }
                    },
                    onSuperAdminMode = { triggerShowLogin = true },
                    onAddArena = { triggerShowAdd = true },
                    onChangePassword = { triggerShowReset = true },
                    onExitAdminMode = {
                        com.boxitt.app.services.Storage.setSuperAdminSession(false)
                        isAdminMode = false
                    },
                    onProfileClick = { navController.navigate(Screen.Profile.route) },
                    onChallengesClick = { navController.navigate(Screen.Challenges.createRoute(selectedSport)) },
                    onNavigate = { dest -> navController.navigate(dest) },
                    onLogout = {
                        triggerConfirm(
                            "Are you sure you want to log out?",
                            {
                                scope.launch {
                                    sessionManager.clearSession()
                                    navController.navigate(Screen.Login.route) {
                                        popUpTo(0) { inclusive = true }
                                    }
                                }
                            },
                            null,
                            "LOGOUT",
                            "CANCEL",
                            true
                        )
                    },
                    onBackClick = null,
                    selectedSport = selectedSport
                )
            }
        },
        bottomBar = {
            val showBottomBar = isLoggedIn && (
                currentRoute?.startsWith("booking") == true ||
                currentRoute == Screen.ScorerList.route ||
                currentRoute == Screen.Scanner.route ||
                currentRoute == Screen.AdminDashboard.route
            ) && currentRoute != Screen.Transactions.route

            if (showBottomBar) {
                BottomNavbar(
                    navController = navController,
                    currentRoute = currentRoute,
                    userRole = userProfile?.role,
                    userStatus = userProfile?.role_status,
                    selectedLocation = selectedLocation,
                    selectedSport = selectedSport
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(theme.colors.background)
                .padding(innerPadding)
        ) {
            BoxittNavGraph(
                navController = navController,
                navViewModel = navViewModel,
                sessionManager = sessionManager,
                startDestination = startDestination,
                onAlert = triggerAlert,
                onConfirm = triggerConfirm,
                isAdminMode = isAdminMode,
                triggerShowLogin = triggerShowLogin,
                triggerShowAdd = triggerShowAdd,
                triggerShowReset = triggerShowReset,
                onAdminModeChange = { isAdminMode = it },
                onTriggerHandled = {
                    triggerShowLogin = false
                    triggerShowAdd = false
                    triggerShowReset = false
                }
            )

            // Floating Chat Button
            if (isLoggedIn && currentRoute != Screen.Chat.route) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.BottomEnd
                ) {
                    BadgedBox(
                        badge = {
                            Badge(
                                containerColor = Color(0xFFEF4444),
                                contentColor = Color.White
                            ) {
                                Text(
                                    text = "2",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    ) {
                        FloatingActionButton(
                            onClick = { navController.navigate(Screen.Chat.route) },
                            containerColor = theme.colors.accent,
                            contentColor = Color.White,
                            shape = CircleShape
                        ) {
                            Icon(Icons.Default.Message, contentDescription = "Chat", modifier = Modifier.size(24.dp))
                        }
                    }
                }
            }
        }

        // Global Alert Modal with Expandable Technical Details
        globalAlert?.let { alert ->
            var showTechnicalDetails by remember { mutableStateOf(false) }
            val errorInfo = remember(alert.message) { 
                if (alert.type == "error") {
                    com.boxitt.app.services.ErrorHandler.handle(Exception(alert.message))
                } else null 
            }

            Dialog(
                onDismissRequest = { 
                    alert.onClose?.invoke()
                    globalAlert = null 
                },
                properties = DialogProperties(usePlatformDefaultWidth = false)
            ) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .animateContentSize()
                        .clip(RoundedCornerShape(28.dp)),
                    color = theme.colors.card,
                    border = BorderStroke(1.dp, theme.colors.border)
                ) {
                    Column(
                        modifier = Modifier.padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        val icon: ImageVector
                        val iconColor: Color
                        val titleText: String
                        val bodyText: String

                        when (alert.type) {
                            "success" -> {
                                icon = Icons.Default.CheckCircle
                                iconColor = theme.colors.success
                                titleText = "SUCCESS"
                                bodyText = alert.message
                            }
                            "error" -> {
                                icon = Icons.Default.Close
                                iconColor = theme.colors.error
                                titleText = errorInfo?.title ?: "ERROR"
                                bodyText = errorInfo?.userMessage ?: alert.message
                            }
                            else -> {
                                icon = Icons.Default.Info
                                iconColor = theme.colors.accent
                                titleText = "NOTICE"
                                bodyText = alert.message
                            }
                        }

                        Box(
                            modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)).background(iconColor.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(icon, null, tint = iconColor, modifier = Modifier.size(32.dp))
                        }

                        Spacer(Modifier.height(16.dp))
                        Text(titleText, fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = FontStyle.Italic)
                        Spacer(Modifier.height(8.dp))
                        Text(bodyText, textAlign = TextAlign.Center, color = theme.colors.textSecondary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        
                        // Technical Details Toggle (for Errors)
                        if (alert.type == "error") {
                            Spacer(Modifier.height(16.dp))
                            Text(
                                if (showTechnicalDetails) "HIDE TECHNICAL DETAILS" else "VIEW TECHNICAL DETAILS",
                                modifier = Modifier
                                    .clickable { showTechnicalDetails = !showTechnicalDetails }
                                    .padding(8.dp),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 1.sp
                            )
                            
                            if (showTechnicalDetails) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 8.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(theme.colors.backgroundSecondary)
                                        .padding(12.dp)
                                ) {
                                    Text(
                                        alert.message,
                                        fontSize = 11.sp,
                                        color = theme.colors.textSecondary,
                                        fontStyle = FontStyle.Italic
                                    )
                                }
                            }
                        }

                        Spacer(Modifier.height(32.dp))
                        Button(
                            onClick = { 
                                alert.onClose?.invoke()
                                globalAlert = null 
                            },
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = theme.colors.accent),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("CONFIRM", fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                        }
                    }
                }
            }
        }

        // Global Confirm Modal
        globalConfirm?.let { confirm ->
            Dialog(
                onDismissRequest = { 
                    confirm.onCancel?.invoke()
                    globalConfirm = null 
                },
                properties = DialogProperties(usePlatformDefaultWidth = false)
            ) {
                Surface(
                    modifier = Modifier.fillMaxWidth(0.85f).clip(RoundedCornerShape(28.dp)),
                    color = theme.colors.card,
                    border = BorderStroke(1.dp, theme.colors.border)
                ) {
                    Column(
                        modifier = Modifier.padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)).background(if (confirm.isDestructive) theme.colors.error.copy(alpha = 0.2f) else theme.colors.accent.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(if (confirm.isDestructive) Icons.Default.Warning else Icons.Default.Shield, null, tint = if (confirm.isDestructive) theme.colors.error else theme.colors.accent, modifier = Modifier.size(32.dp))
                        }

                        Spacer(Modifier.height(16.dp))
                        Text(if (confirm.isDestructive) "ARE YOU SURE?" else "PLEASE CONFIRM", fontSize = 20.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary, fontStyle = FontStyle.Italic)
                        Spacer(Modifier.height(8.dp))
                        Text(confirm.message, textAlign = TextAlign.Center, color = theme.colors.textSecondary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Spacer(Modifier.height(32.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            TextButton(
                                onClick = { 
                                    confirm.onCancel?.invoke()
                                    globalConfirm = null 
                                },
                                modifier = Modifier.weight(1f).height(52.dp),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(confirm.cancelText ?: "CANCEL", color = theme.colors.textSecondary, fontWeight = FontWeight.Black)
                            }
                            Button(
                                onClick = { 
                                    confirm.onConfirm()
                                    globalConfirm = null 
                                },
                                modifier = Modifier.weight(1f).height(52.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = if (confirm.isDestructive) theme.colors.error else theme.colors.accent),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(confirm.confirmText ?: "PROCEED", fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
