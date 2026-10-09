package com.boxitt.app.navigation

sealed class Screen(val route: String) {
    // Auth
    object Login : Screen("login")
    object AuthCallback : Screen("auth_callback")
    object ResetPassword : Screen("reset_password")

    // Main App
    object ArenaDetail : Screen("arena_detail/{arenaId}") {
        fun createRoute(arenaId: String) = "arena_detail/$arenaId"
    }
    object Booking : Screen("booking/{arenaId}") {
        fun createRoute(arenaId: String) = "booking/$arenaId"
    }

    // Bottom Nav Screens
    object Challenges : Screen("challenges?sport={sport}&arena={arena}") {
        fun createRoute(sport: String? = null, arena: String? = null): String {
            val params = mutableListOf<String>()
            if (sport != null) params.add("sport=$sport")
            if (arena != null) params.add("arena=$arena")
            return "challenges" + if (params.isNotEmpty()) "?${params.joinToString("&")}" else ""
        }
    }
    object Notifications : Screen("notifications")
    object Profile : Screen("profile")
    object ViewIdentity : Screen("view_identity")
    object EditProfile : Screen("edit_profile")
    object ChangePassword : Screen("change_password")
    object Transactions : Screen("transactions")
    object ArenaList : Screen("arena_list")
    object CustomerCare : Screen("customer_care")
    object AboutApp : Screen("about_app")
    object PlayerScore : Screen("player_score")

    // Utilities
    object LocationSelector : Screen("location_selector?sport={sport}&search={search}") {
        fun createRoute(sport: String, search: String? = null) = 
            "location_selector?sport=$sport" + if (search != null) "&search=$search" else ""
    }
    object SportSelector : Screen("sport_selector")
    object Payment : Screen("payment/{bookingId}") {
        fun createRoute(bookingId: String) = "payment/$bookingId"
    }

    // Scorers
    object ScorerList : Screen("scorer_list")
    object CricketScorer : Screen("cricket_scorer/{locationId}") {
        fun createRoute(locationId: String) = "cricket_scorer/$locationId"
    }

    // Reviews & Tickets
    object Review : Screen("review/{arenaId}?arenaName={arenaName}") {
        fun createRoute(arenaId: String, arenaName: String? = null) =
            "review/$arenaId" + if (arenaName != null) "?arenaName=$arenaName" else ""
    }
    object History : Screen("history")
    object Ticket : Screen("ticket/{bookingId}") {
        fun createRoute(bookingId: String) = "ticket/$bookingId"
    }
}
