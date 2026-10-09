package com.boxitt.app.components

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.boxitt.app.Location
import com.boxitt.app.navigation.Screen
import com.boxitt.app.contexts.LocalAppTheme

@Composable
fun BottomNavbar(
    navController: NavHostController,
    currentRoute: String?,
    userRole: String?,
    userStatus: String?,
    selectedLocation: Location?
) {
    val theme = LocalAppTheme.current
    val isApproved = userStatus == "approved"
    val isAdminOrSuper = (userRole == "admin" || userRole == "superadmin") && isApproved

    NavigationBar(
        containerColor = theme.colors.backgroundSecondary.copy(alpha = 0.9f),
        contentColor = theme.colors.textPrimary,
        tonalElevation = 8.dp,
        modifier = Modifier.padding(bottom = 8.dp, start = 8.dp, end = 8.dp).clip(RoundedCornerShape(24.dp))
    ) {
        // Book
        NavigationBarItem(
            selected = currentRoute?.startsWith("booking") == true,
            onClick = {
                if (selectedLocation != null) {
                    navController.navigate(Screen.Booking.createRoute(selectedLocation.id))
                } else {
                    navController.navigate(Screen.SportSelector.route)
                }
            },
            icon = { Icon(Icons.Default.DateRange, contentDescription = "Book") },
            label = { Text("Book", fontSize = 10.sp, fontWeight = FontWeight.Black) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = theme.colors.accent,
                selectedTextColor = theme.colors.accent,
                unselectedIconColor = theme.colors.textDisabled,
                unselectedTextColor = theme.colors.textDisabled,
                indicatorColor = Color.Transparent
            )
        )

        // Score
        NavigationBarItem(
            selected = currentRoute == Screen.ScorerList.route,
            onClick = { navController.navigate(Screen.ScorerList.route) },
            icon = { Icon(Icons.Default.Dashboard, contentDescription = "Score") },
            label = { Text("Score", fontSize = 10.sp, fontWeight = FontWeight.Black) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = theme.colors.accent,
                selectedTextColor = theme.colors.accent,
                unselectedIconColor = theme.colors.textDisabled,
                unselectedTextColor = theme.colors.textDisabled,
                indicatorColor = Color.Transparent
            )
        )

        // Scan
        if (isAdminOrSuper) {
            NavigationBarItem(
                selected = currentRoute == Screen.Scanner.route,
                onClick = { navController.navigate(Screen.Scanner.route) },
                icon = { Icon(Icons.Default.QrCodeScanner, contentDescription = "Scan") },
                label = { Text("Scan", fontSize = 10.sp, fontWeight = FontWeight.Black) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = theme.colors.accent,
                    selectedTextColor = theme.colors.accent,
                    unselectedIconColor = theme.colors.textDisabled,
                    unselectedTextColor = theme.colors.textDisabled,
                    indicatorColor = Color.Transparent
                )
            )
        }

        // History
        NavigationBarItem(
            selected = currentRoute == Screen.Transactions.route,
            onClick = { navController.navigate(Screen.Transactions.route) },
            icon = { Icon(Icons.Default.History, contentDescription = "History") },
            label = { Text("History", fontSize = 10.sp, fontWeight = FontWeight.Black) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = theme.colors.accent,
                selectedTextColor = theme.colors.accent,
                unselectedIconColor = theme.colors.textDisabled,
                unselectedTextColor = theme.colors.textDisabled,
                indicatorColor = Color.Transparent
            )
        )

        // Admin
        if (isAdminOrSuper) {
            NavigationBarItem(
                selected = currentRoute == Screen.AdminDashboard.route,
                onClick = { navController.navigate(Screen.AdminDashboard.route) },
                icon = { Icon(Icons.Default.Shield, contentDescription = "Admin") },
                label = { Text("Admin", fontSize = 10.sp, fontWeight = FontWeight.Black) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = theme.colors.accent,
                    selectedTextColor = theme.colors.accent,
                    unselectedIconColor = theme.colors.textDisabled,
                    unselectedTextColor = theme.colors.textDisabled,
                    indicatorColor = Color.Transparent
                )
            )
        }
    }
}
