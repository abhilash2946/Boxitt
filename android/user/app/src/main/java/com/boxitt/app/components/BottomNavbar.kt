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
import com.boxitt.app.SportType
import com.boxitt.app.getSportCapability
import com.boxitt.app.navigation.Screen
import com.boxitt.app.contexts.LocalAppTheme

@Composable
fun BottomNavbar(
    navController: NavHostController,
    currentRoute: String?,
    userRole: String?,
    userStatus: String?,
    selectedLocation: Location?,
    selectedSport: SportType? = null
) {
    val theme = LocalAppTheme.current
    val isScorerAvailable = selectedSport == null || getSportCapability(selectedSport).scorerAvailable

    NavigationBar(
        containerColor = theme.colors.backgroundSecondary.copy(alpha = 0.9f),
        contentColor = theme.colors.textPrimary,
        tonalElevation = 8.dp,
        modifier = Modifier.padding(bottom = 8.dp, start = 8.dp, end = 8.dp).clip(RoundedCornerShape(24.dp))
    ) {
        // Book
        NavigationBarItem(
            selected = currentRoute?.startsWith("booking") == true || currentRoute == Screen.SportSelector.route,
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
        if (isScorerAvailable) {
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
        }
    }
}
