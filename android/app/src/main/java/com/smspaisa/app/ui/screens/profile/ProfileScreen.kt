package com.smspaisa.app.ui.screens.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.smspaisa.app.R
import com.smspaisa.app.ui.components.FloatingSupportButton
import com.smspaisa.app.ui.components.LottieLoading
import com.smspaisa.app.viewmodel.ProfileUiState
import com.smspaisa.app.viewmodel.ProfileViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onNavigateBack: () -> Unit,
    onNavigateToReferral: () -> Unit,
    onLogout: () -> Unit,
    onNavigateToHome: () -> Unit,
    onNavigateToStats: () -> Unit,
    onNavigateToWithdraw: () -> Unit,
    viewModel: ProfileViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showLogoutDialog by remember { mutableStateOf(false) }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Logout") },
            text = { Text("Are you sure you want to logout?") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.logout()
                        showLogoutDialog = false
                        onLogout()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text("Logout") }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) { Text("Cancel") }
            }
        )
    }

    Box(modifier = Modifier.fillMaxSize()) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Profile & Settings") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.Transparent) {
                NavigationBarItem(false, onNavigateToHome, { Icon(painterResource(R.drawable.ic_nav_home), null, modifier = androidx.compose.ui.Modifier.size(24.dp)) }, label = { Text("Home") })
                NavigationBarItem(false, onNavigateToStats, { Icon(painterResource(R.drawable.ic_nav_stats), null, modifier = androidx.compose.ui.Modifier.size(24.dp)) }, label = { Text("Stats") })
                NavigationBarItem(false, onNavigateToWithdraw, { Icon(painterResource(R.drawable.ic_nav_withdraw), null, modifier = androidx.compose.ui.Modifier.size(24.dp)) }, label = { Text("Withdraw") })
                NavigationBarItem(true, {}, { Icon(painterResource(R.drawable.ic_nav_profile), null, modifier = androidx.compose.ui.Modifier.size(24.dp)) }, label = { Text("Profile") })
            }
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is ProfileUiState.Loading -> {
                Box(Modifier.fillMaxSize().padding(paddingValues), Alignment.Center) {
                    LottieLoading()
                }
            }
            is ProfileUiState.Success -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // User Info card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            ),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    modifier = Modifier.size(60.dp),
                                    shape = MaterialTheme.shapes.extraLarge,
                                    color = MaterialTheme.colorScheme.primary
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(
                                            text = state.user.name?.firstOrNull()?.uppercaseChar()?.toString() ?: "U",
                                            style = MaterialTheme.typography.headlineSmall.copy(color = MaterialTheme.colorScheme.onPrimary)
                                        )
                                    }
                                }
                                Spacer(Modifier.width(16.dp))
                                Column {
                                    Text(state.user.name ?: "User", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                                    Text(state.user.phone, style = MaterialTheme.typography.bodySmall)
                                    state.user.email?.let {
                                        Text(it, style = MaterialTheme.typography.bodySmall)
                                    }
                                }
                            }
                        }
                    }

                    // SMS Settings
                    item {
                        Text("SMS Settings", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold))
                    }
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                // Daily limit slider
                                Column {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text("Daily SMS Limit", style = MaterialTheme.typography.bodyMedium)
                                        Text("${state.dailySmsLimit} SMS", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                                    }
                                    Slider(
                                        value = state.dailySmsLimit.toFloat(),
                                        onValueChange = { viewModel.updateDailySmsLimit(it.toInt()) },
                                        valueRange = 50f..500f,
                                        steps = 8
                                    )
                                }
                                Divider()
                                // Battery threshold slider
                                Column {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text("Stop at Battery", style = MaterialTheme.typography.bodyMedium)
                                        Text("${state.stopBatteryPercent}%", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                                    }
                                    Slider(
                                        value = state.stopBatteryPercent.toFloat(),
                                        onValueChange = { viewModel.updateStopBatteryPercent(it.toInt()) },
                                        valueRange = 10f..50f,
                                        steps = 7
                                    )
                                }
                                Divider()
                                // WiFi only toggle
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text("WiFi Only", style = MaterialTheme.typography.bodyMedium)
                                        Text("Send SMS only on WiFi", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                                    }
                                    Switch(
                                        checked = state.wifiOnly,
                                        onCheckedChange = { viewModel.updateWifiOnly(it) }
                                    )
                                }
                                Divider()
                                // Preferred SIM
                                Column {
                                    Text("Preferred SIM", style = MaterialTheme.typography.bodyMedium)
                                    Spacer(Modifier.height(8.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        listOf(0 to "Auto", 1 to "SIM 1", 2 to "SIM 2").forEach { (value, label) ->
                                            FilterChip(
                                                selected = state.preferredSim == value,
                                                onClick = { viewModel.updatePreferredSim(value) },
                                                label = { Text(label) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Payment section
                    item {
                        Text("Payment & Referral", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold))
                    }
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column {
                                ListItem(
                                    headlineContent = { Text("My Referral Code") },
                                    supportingContent = { Text(state.user.referralCode.ifEmpty { "N/A" }) },
                                    leadingContent = { Icon(Icons.Default.CardGiftcard, null) },
                                    trailingContent = {
                                        TextButton(onClick = onNavigateToReferral) { Text("View") }
                                    }
                                )
                            }
                        }
                    }

                    // Logout
                    item {
                        Button(
                            onClick = { showLogoutDialog = true },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.error
                            )
                        ) {
                            Icon(Icons.Default.Logout, null)
                            Spacer(Modifier.width(8.dp))
                            Text("Logout")
                        }
                    }
                }
            }
            is ProfileUiState.Error -> {
                Box(Modifier.fillMaxSize().padding(paddingValues), Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = { viewModel.loadProfile() }) { Text("Retry") }
                    }
                }
            }
        }
    }
    // Floating support button - positioned at bottom end
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(end = 16.dp, bottom = 96.dp),
        contentAlignment = Alignment.BottomEnd
    ) {
        FloatingSupportButton()
    }
    }
}
