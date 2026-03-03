package com.smspaisa.app.ui.screens.history

import androidx.compose.foundation.isSystemInDarkTheme
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.smspaisa.app.R
import com.smspaisa.app.model.Transaction
import com.smspaisa.app.ui.components.LottieLoading
import com.smspaisa.app.viewmodel.WithdrawalHistoryUiState
import com.smspaisa.app.viewmodel.WithdrawalHistoryViewModel
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

private val dateInputFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}
private val dateOutputFmt = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WithdrawalHistoryScreen(
    onNavigateBack: () -> Unit,
    onNavigateToHome: () -> Unit,
    onNavigateToStats: () -> Unit,
    onNavigateToWithdraw: () -> Unit,
    onNavigateToProfile: () -> Unit,
    viewModel: WithdrawalHistoryViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Withdrawal History") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.load() }) {
                        Icon(Icons.Default.Refresh, "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.Transparent) {
                NavigationBarItem(false, onNavigateToHome, { Icon(painterResource(R.drawable.ic_nav_home), null, modifier = Modifier.size(24.dp)) }, label = { Text("Home") })
                NavigationBarItem(false, onNavigateToStats, { Icon(painterResource(R.drawable.ic_nav_stats), null, modifier = Modifier.size(24.dp)) }, label = { Text("Stats") })
                NavigationBarItem(false, onNavigateToWithdraw, { Icon(painterResource(R.drawable.ic_nav_withdraw), null, modifier = Modifier.size(24.dp)) }, label = { Text("Withdraw") })
                NavigationBarItem(false, onNavigateToProfile, { Icon(painterResource(R.drawable.ic_nav_profile), null, modifier = Modifier.size(24.dp)) }, label = { Text("Profile") })
            }
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is WithdrawalHistoryUiState.Loading -> {
                Box(Modifier.fillMaxSize().padding(paddingValues), Alignment.Center) {
                    LottieLoading()
                }
            }
            is WithdrawalHistoryUiState.Error -> {
                Box(Modifier.fillMaxSize().padding(paddingValues), Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = { viewModel.load() }) { Text("Retry") }
                    }
                }
            }
            is WithdrawalHistoryUiState.Success -> {
                if (state.transactions.isEmpty()) {
                    Box(Modifier.fillMaxSize().padding(paddingValues), Alignment.Center) {
                        Text("No withdrawal history yet.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(paddingValues),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(state.transactions) { txn ->
                            WithdrawalHistoryItem(txn)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WithdrawalHistoryItem(txn: Transaction) {
    val isDark = isSystemInDarkTheme()
    val statusColor = when (txn.status) {
        "COMPLETED" -> if (isDark) Color(0xFF81C784) else Color(0xFF2E7D32)
        "FAILED" -> if (isDark) Color(0xFFEF9A9A) else Color(0xFFC62828)
        else -> if (isDark) Color(0xFFFFCC02) else Color(0xFFF9A825)
    }
    val statusBg = when (txn.status) {
        "COMPLETED" -> if (isDark) Color(0xFF1B5E20).copy(alpha = 0.4f) else Color(0xFFE8F5E9)
        "FAILED" -> if (isDark) Color(0xFFB71C1C).copy(alpha = 0.4f) else Color(0xFFFFEBEE)
        else -> if (isDark) Color(0xFFE65100).copy(alpha = 0.4f) else Color(0xFFFFF8E1)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if ((txn.method ?: "").contains("UPI", ignoreCase = true)) Icons.Default.AccountBalanceWallet else Icons.Default.AccountBalance,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(36.dp)
                )
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(
                        text = txn.method ?: txn.type,
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold)
                    )
                    Text(
                        text = try {
                            dateOutputFmt.format(dateInputFmt.parse(txn.createdAt)!!)
                        } catch (e: Exception) { txn.createdAt },
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "₹%.2f".format(txn.amount),
                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold)
                )
                Spacer(Modifier.height(4.dp))
                Surface(
                    color = statusBg,
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = txn.status,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = statusColor
                    )
                }
            }
        }
    }
}

