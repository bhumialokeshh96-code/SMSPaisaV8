package com.smspaisa.app.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.smspaisa.app.R
import com.smspaisa.app.ui.navigation.Screen

data class BottomNavItem(
    val label: String,
    val iconRes: Int,
    val route: String
)

val bottomNavItems = listOf(
    BottomNavItem("Home", R.drawable.ic_nav_home, Screen.Home.route),
    BottomNavItem("Stats", R.drawable.ic_nav_stats, Screen.Stats.route),
    BottomNavItem("Withdraw", R.drawable.ic_nav_withdraw, Screen.Withdraw.route),
    BottomNavItem("Profile", R.drawable.ic_nav_profile, Screen.Profile.route)
)

@Composable
fun BottomNavBar(
    navController: NavController,
    onNavigate: (String) -> Unit
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    NavigationBar {
        bottomNavItems.forEach { item ->
            NavigationBarItem(
                selected = currentRoute == item.route,
                onClick = { onNavigate(item.route) },
                icon = {
                    Icon(
                        painter = painterResource(id = item.iconRes),
                        contentDescription = item.label,
                        modifier = Modifier.size(24.dp)
                    )
                },
                label = { Text(item.label) }
            )
        }
    }
}