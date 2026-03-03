package com.smspaisa.app.ui.screens.stats

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
import com.smspaisa.app.model.DailyStats
import com.smspaisa.app.ui.components.*
import com.smspaisa.app.viewmodel.StatsPeriod
import com.smspaisa.app.viewmodel.StatsUiState
import com.smspaisa.app.viewmodel.StatsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToHome: () -> Unit,
    onNavigateToWithdraw: () -> Unit,
    onNavigateToProfile: () -> Unit,
    viewModel: StatsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val selectedPeriod by viewModel.selectedPeriod.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Statistics") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadStats(selectedPeriod) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.Transparent) {
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToHome,
                    icon = { Icon(painterResource(R.drawable.ic_nav_home), null, modifier = androidx.compose.ui.Modifier.size(24.dp)) },
                    label = { Text("Home") }
                )
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(painterResource(R.drawable.ic_nav_stats), null, modifier = androidx.compose.ui.Modifier.size(24.dp)) },
                    label = { Text("Stats") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToWithdraw,
                    icon = { Icon(painterResource(R.drawable.ic_nav_withdraw), null, modifier = androidx.compose.ui.Modifier.size(24.dp)) },
                    label = { Text("Withdraw") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToProfile,
                    icon = { Icon(painterResource(R.drawable.ic_nav_profile), null, modifier = androidx.compose.ui.Modifier.size(24.dp)) },
                    label = { Text("Profile") }
                )
            }
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is StatsUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    LottieLoading()
                }
            }
            is StatsUiState.Success -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Overview summary card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            ),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    "Overview",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    OverviewItem("Total SMS", state.overview.totalSmsSent.toString())
                                    OverviewItem("Total Earned", "₹%.0f".format(state.overview.totalEarnings))
                                    OverviewItem("Success Rate", "%.1f%%".format(state.overview.successRate))
                                }
                            }
                        }
                    }

                    // Period selector
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            StatsPeriod.values().forEach { period ->
                                FilterChip(
                                    selected = selectedPeriod == period,
                                    onClick = { viewModel.selectPeriod(period) },
                                    label = { Text(period.name.lowercase().replaceFirstChar { it.uppercase() }) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }

                    // Earnings Chart
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            ),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                val chartTitle = when (selectedPeriod) {
                                    StatsPeriod.DAILY -> "This Week's Earnings"
                                    StatsPeriod.WEEKLY -> "This Week's Earnings"
                                    StatsPeriod.MONTHLY -> "This Month's Earnings"
                                }
                                Text(
                                    chartTitle,
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold)
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                val chartBars = when {
                                    state.weeklyStats != null -> state.weeklyStats.days.map { day ->
                                        val dayName = try {
                                            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
                                            val cal = java.util.Calendar.getInstance()
                                            cal.time = sdf.parse(day.date)!!
                                            java.text.SimpleDateFormat("EEE", java.util.Locale.getDefault()).format(cal.time)
                                        } catch (e: Exception) { day.date.takeLast(5) }
                                        ChartBar(dayName, day.earnings.toFloat())
                                    }
                                    state.monthlyStats != null -> state.monthlyStats.weeks.mapIndexed { index, week ->
                                        ChartBar("W${index + 1}", week.totalEarnings.toFloat())
                                    }
                                    state.dailyStats != null -> listOf(
                                        ChartBar("Today", state.dailyStats.earnings.toFloat())
                                    )
                                    else -> emptyList()
                                }
                                EarningsChart(
                                    bars = chartBars,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }

                    // Stats breakdown
                    item {
                        Text(
                            "Breakdown",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                        )
                    }
                    item {
                        val totalSent = when {
                            state.weeklyStats != null -> state.weeklyStats.totalSent
                            state.monthlyStats != null -> state.monthlyStats.totalSent
                            state.dailyStats != null -> state.dailyStats.sent
                            else -> 0
                        }
                        val totalDelivered = when {
                            state.weeklyStats != null -> state.weeklyStats.totalDelivered
                            state.monthlyStats != null -> state.monthlyStats.totalDelivered
                            state.dailyStats != null -> state.dailyStats.delivered
                            else -> 0
                        }
                        val totalFailed = when {
                            state.weeklyStats != null -> state.weeklyStats.totalFailed
                            state.monthlyStats != null -> state.monthlyStats.totalFailed
                            state.dailyStats != null -> state.dailyStats.failed
                            else -> 0
                        }
                        val totalEarnings = when {
                            state.weeklyStats != null -> state.weeklyStats.totalEarnings
                            state.monthlyStats != null -> state.monthlyStats.totalEarnings
                            state.dailyStats != null -> state.dailyStats.earnings
                            else -> 0.0
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            StatsCard(
                                title = "Sent",
                                value = totalSent.toString(),
                                modifier = Modifier.weight(1f)
                            )
                            StatsCard(
                                title = "Delivered",
                                value = totalDelivered.toString(),
                                modifier = Modifier.weight(1f),
                                containerColor = MaterialTheme.colorScheme.secondaryContainer
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            StatsCard(
                                title = "Failed",
                                value = totalFailed.toString(),
                                modifier = Modifier.weight(1f),
                                containerColor = MaterialTheme.colorScheme.errorContainer
                            )
                            StatsCard(
                                title = "Earnings",
                                value = "₹%.2f".format(totalEarnings),
                                modifier = Modifier.weight(1f),
                                containerColor = MaterialTheme.colorScheme.tertiaryContainer
                            )
                        }
                    }
                }
            }
            is StatsUiState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(onClick = { viewModel.loadStats() }) { Text("Retry") }
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

@Composable
private fun OverviewItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
    }
}
