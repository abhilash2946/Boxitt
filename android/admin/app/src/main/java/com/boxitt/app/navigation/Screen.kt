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
    object Booking : Screen("booking/{arenaId}") {
        fun createRoute(arenaId: String) = "booking/$arenaId"
    }

    // Nav & Profile Screens
    object Profile : Screen("profile")
    object ViewIdentity : Screen("view_identity")
    object EditProfile : Screen("edit_profile")
    object ChangePassword : Screen("change_password")
    object Transactions : Screen("transactions")
    object CustomerCare : Screen("customer_care")
    object AboutApp : Screen("about_app")

    // Admin
    object AdminLogin : Screen("admin_login")
    object AdminDashboard : Screen("admin_dashboard")
    object AdminEditArena : Screen("admin_edit_arena/{arenaId}") {
        fun createRoute(arenaId: String) = "admin_edit_arena/$arenaId"
    }
    object AddArena : Screen("add_arena?sport={sport}") {
        fun createRoute(sport: String) = "add_arena?sport=$sport"
    }

    // Utilities
    object Scanner : Screen("scanner")
    object LocationSelector : Screen("location_selector?sport={sport}&search={search}") {
        fun createRoute(sport: String, search: String? = null) = 
            "location_selector?sport=$sport" + if (search != null) "&search=$search" else ""
    }
    object SportSelector : Screen("sport_selector")
    object Payment : Screen("payment/{bookingId}") {
        fun createRoute(bookingId: String) = "payment/$bookingId"
    }

    // Reviews & History
    object Review : Screen("review/{arenaId}?arenaName={arenaName}") {
        fun createRoute(arenaId: String, arenaName: String? = null) =
            "review/$arenaId" + if (arenaName != null) "?arenaName=$arenaName" else ""
    }
    object History : Screen("history")
    object Ticket : Screen("ticket/{bookingId}") {
        fun createRoute(bookingId: String) = "ticket/$bookingId"
    }
}

