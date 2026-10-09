package com.boxitt.app

import androidx.compose.runtime.Composable
import com.boxitt.app.components.DashboardNavbar

/**
 * Wrapper composable around DashboardNavbar.
 * Equivalent to the React DashboardNavbarWrapper component.
 */
@Composable
fun DashboardNavbarWrapper(
    user: User,
    onAdminClick: (() -> Unit)? = null,
    onSuperAdminClick: (() -> Unit)? = null,
    onProfileClick: (() -> Unit)? = null,
    onBackClick: (() -> Unit)? = null
) {
    DashboardNavbar(
        user = user,
        onSuperAdminDashboardClick = onSuperAdminClick,
        onProfileClick = onProfileClick,
        onBackClick = onBackClick
    )
}




