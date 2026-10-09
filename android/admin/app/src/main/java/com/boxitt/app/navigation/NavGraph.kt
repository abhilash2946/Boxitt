package com.boxitt.app.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navDeepLink
import androidx.navigation.navArgument
import androidx.navigation.NavType
import com.boxitt.app.*
import com.boxitt.app.pages.*
import com.boxitt.app.ui.profile.MyProfilePage
import com.boxitt.app.ui.profile.EditProfilePage
import com.boxitt.app.services.SessionManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SafeScreenWrapper(
    screenName: String,
    content: @Composable () -> Unit
) {
    val theme = com.boxitt.app.contexts.LocalAppTheme.current
    
    Box(
        modifier = Modifier.fillMaxSize().background(theme.colors.background)
    ) {
        content()
    }
}

@Composable
fun BoxittNavGraph(
    navController: NavHostController,
    navViewModel: NavigationViewModel,
    sessionManager: SessionManager,
    startDestination: String = Screen.SportSelector.route,
    modifier: Modifier = Modifier,
    onAlert: (String, String, (() -> Unit)?) -> Unit,
    onConfirm: (String, () -> Unit, (() -> Unit)?, String?, String?, Boolean?) -> Unit,
    isAdminMode: Boolean = false,
    triggerShowLogin: Boolean = false,
    triggerShowAdd: Boolean = false,
    triggerShowReset: Boolean = false,
    onAdminModeChange: (Boolean) -> Unit = {},
    onTriggerHandled: () -> Unit = {}
) {
    val userProfile by sessionManager.userProfile.collectAsState(initial = null)
    val user = remember(userProfile) {
        userProfile?.let { p ->
            User(
                id = p.id,
                email = p.email,
                display_name = p.displayName,
                phone_number = p.phoneNumber,
                avatar_url = p.avatar_url,
                role = p.role,
                role_status = p.role_status,
                latitude = p.latitude,
                longitude = p.longitude,
                address = p.address,
                location = p.location,
                profileImage = p.profileImage,
                joined_date = p.joined_date
            )
        }
    }

    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier
    ) {
        composable(Screen.Login.route) {
            LoginPage(
                onLoginSuccess = { role ->
                    if (role == "pending") {
                        navController.navigate(Screen.PendingApproval.route)
                    } else {
                        // Directly go to SportSelector; App.kt logic will intercept if profile is incomplete
                        navController.navigate(Screen.SportSelector.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                },
                onAlert = onAlert
            )
        }
        composable(
            route = Screen.AuthCallback.route,
            deepLinks = listOf(
                navDeepLink { uriPattern = "com.boxitt.app://auth-callback" }
            )
        ) {
            AuthCallbackPage(
                onNavigate = { dest ->
                    val targetRoute = when (dest) {
                        "edit-profile" -> Screen.EditProfile.route
                        "booking" -> Screen.SportSelector.route
                        else -> Screen.SportSelector.route
                    }
                    navController.navigate(targetRoute) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onAlert = onAlert
            )
        }
        composable(Screen.PendingApproval.route) {
            PendingApprovalPage(
                onNavigate = { dest ->
                    if (dest == "login") {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                }
            )
        }
        composable(Screen.SportSelector.route) {
            val coroutineScope = rememberCoroutineScope()
            SafeScreenWrapper("SportSelector") {
                SportSelector(
                    onSelect = { sport ->
                        navViewModel.setSelectedSport(sport.name)
                        navController.navigate(Screen.LocationSelector.createRoute(sport.name))
                    },
                    onLogout = {
                        coroutineScope.launch {
                            sessionManager.clearSession()
                        }
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onProfile = { navController.navigate(Screen.Profile.route) },
                    onConfirm = onConfirm
                )
            }
        }
        composable(
            route = Screen.LocationSelector.route,
            arguments = listOf(
                navArgument("sport") { type = NavType.StringType },
                navArgument("search") { type = NavType.StringType; nullable = true }
            )
        ) { backStackEntry ->
            val sportName = backStackEntry.arguments?.getString("sport") ?: ""
            val search = backStackEntry.arguments?.getString("search")
            SafeScreenWrapper("LocationSelector") {
                LocationSelector(
                    onSelect = { loc ->
                        navViewModel.setSelectedLocation(loc)
                        navController.navigate(Screen.Booking.createRoute(loc.id))
                    },
                    user = user,
                    sport = SportType.values()
                        .firstOrNull { it.name == sportName.uppercase() } ?: SportType.CRICKET,
                    onBack = { navController.popBackStack() },
                    onLogout = {},
                    onProfile = { navController.navigate(Screen.Profile.route) },
                    onSuperAdmin = { navController.navigate(Screen.SuperAdminApproval.route) },
                    onReview = { id -> navController.navigate(Screen.Review.createRoute(id)) },
                    onAlert = onAlert,
                    onConfirm = onConfirm,
                    onNavigate = { dest -> navController.navigate(dest) },
                    onOpenDetails = { id ->
                        navController.navigate(Screen.ArenaDetail.createRoute(id))
                    },
                    isAdminModeExternal = isAdminMode,
                    triggerShowLogin = triggerShowLogin,
                    triggerShowAdd = triggerShowAdd,
                    triggerShowReset = triggerShowReset,
                    onAdminModeChange = onAdminModeChange,
                    onTriggerHandled = onTriggerHandled,
                    initialSearchQuery = search
                )
            }
        }
        composable(
            route = Screen.ArenaDetail.route,
            arguments = listOf(navArgument("arenaId") { type = NavType.StringType })
        ) { backStackEntry ->
            val arenaId = backStackEntry.arguments?.getString("arenaId") ?: ""
            SafeScreenWrapper("ArenaDetails") {
                ArenaDetailsPage(
                    locationId = arenaId,
                    onBack = { navController.popBackStack() },
                    onBookNow = { _ ->
                        navController.navigate(Screen.Booking.createRoute(arenaId))
                    }
                )
            }
        }
        composable(
            route = Screen.Booking.route,
            arguments = listOf(navArgument("arenaId") { type = NavType.StringType })
        ) { backStackEntry ->
            val arenaId = backStackEntry.arguments?.getString("arenaId") ?: ""
            SafeScreenWrapper("Booking") {
                key(arenaId) {
                    BookingPage(
                        location = Location(id = arenaId, name = "Arena", address = ""), // Placeholder
                        onBack = { navController.popBackStack() },
                        user = user,
                        onAlert = onAlert,
                        onComplete = { navController.popBackStack() },
                        navViewModel = navViewModel
                    )
                }
            }
        }
        composable(Screen.Profile.route) {
            SafeScreenWrapper("Profile") {
                MyProfilePage(
                    onNavigate = { dest ->
                        when (dest) {
                            "edit-profile", Screen.EditProfile.route -> navController.navigate(Screen.EditProfile.route)
                            "customer-care", Screen.CustomerCare.route -> navController.navigate(Screen.CustomerCare.route)
                            "about-app", Screen.AboutApp.route -> navController.navigate(Screen.AboutApp.route)
                            "player-score", Screen.PlayerScore.route -> navController.navigate(Screen.PlayerScore.route)
                            "history", Screen.History.route -> navController.navigate(Screen.History.route)
                            "transactions", Screen.Transactions.route -> navController.navigate(Screen.Transactions.route)
                            "arena-list", Screen.ArenaList.route -> navController.navigate(Screen.ArenaList.route)
                            "notifications", Screen.Notifications.route -> navController.navigate(Screen.Notifications.route)
                            "login" -> {
                                navController.navigate(Screen.Login.route) {
                                    popUpTo(0) { inclusive = true }
                                }
                            }
                            "dashboard" -> {
                                if (!navController.popBackStack()) {
                                    navController.navigate(Screen.SportSelector.route) {
                                        popUpTo(0) { inclusive = true }
                                    }
                                }
                            }
                            else -> {
                                try {
                                    navController.navigate(dest)
                                } catch (e: Exception) {
                                    // fallback
                                }
                            }
                        }
                    },
                    onAlert = onAlert,
                    onConfirm = onConfirm
                )
            }
        }
        composable(Screen.CustomerCare.route) {
            SafeScreenWrapper("CustomerCare") {
                CustomerCarePage(
                    onNavigateBack = { navController.popBackStack() },
                    onAlert = onAlert
                )
            }
        }
        composable(Screen.AboutApp.route) {
            SafeScreenWrapper("AboutApp") {
                AboutAppPage(
                    onNavigateBack = { navController.popBackStack() },
                    onAlert = onAlert
                )
            }
        }
        composable(Screen.PlayerScore.route) {
            SafeScreenWrapper("PlayerScore") {
                PlayerScorePage(
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
        composable(Screen.EditProfile.route) {
            SafeScreenWrapper("EditProfile") {
                EditProfilePage(
                    onAlert = onAlert,
                    onNavigate = { dest ->
                        if (dest == "dashboard") {
                            if (!navController.popBackStack()) {
                                navController.navigate(Screen.SportSelector.route) {
                                    popUpTo(0) { inclusive = true }
                                }
                            }
                        } else if (dest == "my-profile" || dest == "profile") {
                            navController.navigate(Screen.Profile.route) {
                                popUpTo(Screen.Profile.route) { inclusive = true }
                            }
                        }
                    }
                )
            }
        }
        composable(Screen.Scanner.route) {
            SafeScreenWrapper("Scanner") {
                Scanner(
                    onAlert = onAlert
                )
            }
        }
        composable(Screen.Transactions.route) {
            SafeScreenWrapper("Transactions") {
                TransactionsPage(
                    user = user,
                    onAlert = onAlert
                )
            }
        }
        composable(
            route = Screen.Review.route,
            arguments = listOf(
                navArgument("arenaId") { type = NavType.StringType },
                navArgument("arenaName") { type = NavType.StringType; nullable = true }
            )
        ) { backStackEntry ->
            val arenaId = backStackEntry.arguments?.getString("arenaId")
            SafeScreenWrapper("Review") {
                ReviewPage(
                    locationId = arenaId,
                    userId = user?.id,
                    onBack = { navController.popBackStack() },
                    onAlert = onAlert
                )
            }
        }
        composable(
            route = Screen.AdminEditArena.route,
            arguments = listOf(navArgument("arenaId") { type = NavType.StringType })
        ) { backStackEntry ->
            val arenaId = backStackEntry.arguments?.getString("arenaId") ?: ""
            SafeScreenWrapper("AdminEditArena") {
                AdminEditArenaPage(
                    arenaId = arenaId,
                    onBack = { navController.popBackStack() },
                    onSaved = { id ->
                        navController.navigate(Screen.ArenaDetail.createRoute(id))
                    }
                )
            }
        }
        composable(Screen.ResetPassword.route) {
            ResetPasswordPage(
                onComplete = { navController.popBackStack() },
                onAlert = onAlert
            )
        }
        composable(Screen.AdminDashboard.route) {
            val selectedLoc by navViewModel.selectedLocation.collectAsState()

            SafeScreenWrapper("AdminDashboard") {
                AdminDashboard(
                    selectedLocation = selectedLoc ?: com.boxitt.app.Location(id = "", name = "Select Arena", address = ""),
                    onLocationChange = { navViewModel.setSelectedLocation(it) },
                    user = user,
                    onAlert = onAlert,
                    onConfirm = onConfirm
                )
            }
        }
    }
}

