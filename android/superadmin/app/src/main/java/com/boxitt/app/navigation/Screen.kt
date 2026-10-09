package com.boxitt.app.navigation

sealed class Screen(val route: String) {
    // Auth
    object Login : Screen("login")
    object AuthCallback : Screen("auth_callback")
    object ResetPassword : Screen("reset_password")
    object PendingApproval : Screen("pending_approval")

    // Main App
    object ArenaDetail : Screen("arena_detail/{arenaId}") {
        fun createRoute(arenaId: String) = "arena_detail/$arenaId"
    }

    // Profile Screens
    object Profile : Screen("profile")
    object ViewIdentity : Screen("view_identity")
    object EditProfile : Screen("edit_profile")
    object ChangePassword : Screen("change_password")

    // SuperAdmin
    object AdminEditArena : Screen("admin_edit_arena/{arenaId}") {
        fun createRoute(arenaId: String) = "admin_edit_arena/$arenaId"
    }
    object SuperAdminDashboard : Screen("super_admin_dashboard")
    object SuperAdminApproval : Screen("super_admin_approval")
    object AddArena : Screen("add_arena?sport={sport}") {
        fun createRoute(sport: String) = "add_arena?sport=$sport"
    }

    // Utilities
    object LocationSelector : Screen("location_selector?sport={sport}&search={search}") {
        fun createRoute(sport: String, search: String? = null) = 
            "location_selector?sport=$sport" + if (search != null) "&search=$search" else ""
    }
    object SportSelector : Screen("sport_selector")

    // Reviews
    object Review : Screen("review/{arenaId}?arenaName={arenaName}") {
        fun createRoute(arenaId: String, arenaName: String? = null) =
            "review/$arenaId" + if (arenaName != null) "?arenaName=$arenaName" else ""
    }
}

