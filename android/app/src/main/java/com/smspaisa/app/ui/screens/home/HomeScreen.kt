package com.smspaisa.app.ui.screens.home

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import kotlinx.coroutines.launch
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.smspaisa.app.R
import com.smspaisa.app.ui.components.*
import com.smspaisa.app.model.SendingStatus
import com.smspaisa.app.viewmodel.HomeUiState
import com.smspaisa.app.viewmodel.HomeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNavigateToStats: () -> Unit,
    onNavigateToWithdraw: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToHistory: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val permissionsNeeded by viewModel.permissionsNeeded.collectAsState()
    val sendingProgress by viewModel.sendingProgress.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val snackbarScope = rememberCoroutineScope()
    var showRoundSummary by remember { mutableStateOf(false) }

    LaunchedEffect(sendingProgress.status) {
        if (sendingProgress.status == SendingStatus.ROUND_COMPLETE &&
            (sendingProgress.roundSent > 0 || sendingProgress.roundFailed > 0)) {
            showRoundSummary = true
            viewModel.loadData()
        }
    }

    if (showRoundSummary) {
        RoundSummaryDialog(
            progress = sendingProgress,
            onDismiss = { showRoundSummary = false }
        )
    }

    val requiredPermissions = remember {
        buildList {
            add(Manifest.permission.SEND_SMS)
            add(Manifest.permission.READ_PHONE_STATE)
            add(Manifest.permission.READ_PHONE_NUMBERS)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        viewModel.onPermissionsResult(allGranted)
        if (!allGranted) {
            snackbarScope.launch {
                snackbarHostState.showSnackbar("Permissions denied. Service cannot start.")
            }
        }
    }

    LaunchedEffect(permissionsNeeded) {
        if (permissionsNeeded) {
            val allGranted = requiredPermissions.all {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }
            if (allGranted) {
                viewModel.onPermissionsResult(true)
            } else {
                permissionLauncher.launch(requiredPermissions.toTypedArray())
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    when (val state = uiState) {
                        is HomeUiState.Success -> Text("Hi, ${state.userName.split(" ").first()} 👋")
                        else -> Text("SMSPaisa")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadData() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                    IconButton(onClick = {}) {
                        Icon(Icons.Default.Notifications, contentDescription = "Notifications")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.Transparent) {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(painterResource(R.drawable.ic_nav_home), contentDescription = null, modifier = androidx.compose.ui.Modifier.size(24.dp)) },
                    label = { Text("Home") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToStats,
                    icon = { Icon(painterResource(R.drawable.ic_nav_stats), contentDescription = null, modifier = androidx.compose.ui.Modifier.size(24.dp)) },
                    label = { Text("Stats") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToWithdraw,
                    icon = { Icon(painterResource(R.drawable.ic_nav_withdraw), contentDescription = null, modifier = androidx.compose.ui.Modifier.size(24.dp)) },
                    label = { Text("Withdraw") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToProfile,
                    icon = { Icon(painterResource(R.drawable.ic_nav_profile), contentDescription = null, modifier = androidx.compose.ui.Modifier.size(24.dp)) },
                    label = { Text("Profile") }
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        when (val state = uiState) {
            is HomeUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    LottieLoading()
                }
            }
            is HomeUiState.Success -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        BalanceCard(
                            wallet = state.wallet,
                            onWithdrawClick = onNavigateToWithdraw,
                            onHistoryClick = onNavigateToHistory
                        )
                    }
                    item {
                        EarningToggle(
                            isActive = state.serviceEnabled,
                            onToggle = { viewModel.toggleService(it) },
                            modifier = Modifier.fillMaxWidth(),
                            sendingProgress = sendingProgress
                        )
                    }
                    item {
                        SendingProgressCard(progress = sendingProgress, onRetry = { viewModel.retryBatchPolling() }, isServiceRunning = state.serviceEnabled)
                    }
                    item {
                        Text(
                            text = "Today's Activity",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            StatsCard(
                                title = "Sent",
                                value = state.todayStats.sent.toString(),
                                modifier = Modifier.weight(1f)
                            )
                            StatsCard(
                                title = "Delivered",
                                value = state.todayStats.delivered.toString(),
                                modifier = Modifier.weight(1f),
                                containerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.12f)
                            )
                            StatsCard(
                                title = "Earned",
                                value = "₹%.2f".format(state.todayStats.earnings),
                                modifier = Modifier.weight(1f),
                                containerColor = MaterialTheme.colorScheme.tertiary.copy(alpha = 0.12f)
                            )
                        }
                    }
                    item {
                        Text(
                            text = "Live Activity",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                        )
                    }
                    if (state.recentLogs.isEmpty()) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.surface
                                ),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(32.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "No activity yet. Start the service to begin earning!",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                                    )
                                }
                            }
                        }
                    } else {
                        items(state.recentLogs) { log ->
                            SmsLogItem(smsLog = log)
                        }
                    }
                }
            }
            is HomeUiState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = state.message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(onClick = { viewModel.loadData() }) {
                            Text("Retry")
                        }
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
