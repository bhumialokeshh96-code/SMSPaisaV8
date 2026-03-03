package com.smspaisa.app.ui.screens.withdraw

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.smspaisa.app.R
import com.smspaisa.app.data.api.PaymentAccount
import com.smspaisa.app.ui.components.*
import com.smspaisa.app.viewmodel.WithdrawUiState
import com.smspaisa.app.viewmodel.WithdrawViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WithdrawScreen(
    onNavigateBack: () -> Unit,
    onNavigateToHome: () -> Unit,
    onNavigateToStats: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToHistory: () -> Unit,
    viewModel: WithdrawViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val selectedAmount by viewModel.selectedAmount.collectAsState()
    val selectedMethod by viewModel.selectedMethod.collectAsState()
    var amountInput by remember { mutableStateOf("") }
    var showAddUpiDialog by remember { mutableStateOf(false) }
    var showAddBankDialog by remember { mutableStateOf(false) }

    LaunchedEffect(uiState) {
        if (uiState is WithdrawUiState.Success) {
            amountInput = ""
        }
    }

    if (showAddUpiDialog) {
        AddUpiDialog(
            onDismiss = { showAddUpiDialog = false },
            onAdd = { upiId, name ->
                viewModel.addUpi(upiId, name)
                showAddUpiDialog = false
            }
        )
    }

    if (showAddBankDialog) {
        AddBankDialog(
            onDismiss = { showAddBankDialog = false },
            onAdd = { accountNumber, ifsc, bankName, holderName ->
                viewModel.addBank(accountNumber, ifsc, bankName, holderName)
                showAddBankDialog = false
            }
        )
    }

    Box(modifier = Modifier.fillMaxSize()) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Withdraw") },
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
                NavigationBarItem(true, {}, { Icon(painterResource(R.drawable.ic_nav_withdraw), null, modifier = androidx.compose.ui.Modifier.size(24.dp)) }, label = { Text("Withdraw") })
                NavigationBarItem(false, onNavigateToProfile, { Icon(painterResource(R.drawable.ic_nav_profile), null, modifier = androidx.compose.ui.Modifier.size(24.dp)) }, label = { Text("Profile") })
            }
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is WithdrawUiState.Loading -> {
                Box(Modifier.fillMaxSize().padding(paddingValues), Alignment.Center) {
                    LottieLoading()
                }
            }
            is WithdrawUiState.Ready, is WithdrawUiState.Success, is WithdrawUiState.Error -> {
                val readyState = when (state) {
                    is WithdrawUiState.Ready -> state
                    else -> viewModel.lastReadyState
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Balance Card
                    readyState?.let {
                        item {
                            BalanceCard(
                                wallet = it.wallet,
                                onWithdrawClick = {},
                                onHistoryClick = onNavigateToHistory
                            )
                        }
                    }

                    if (state is WithdrawUiState.Success) {
                        item {
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                                )
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.CheckCircle, null, tint = MaterialTheme.colorScheme.secondary)
                                    Spacer(Modifier.width(8.dp))
                                    Text(state.message)
                                }
                            }
                        }
                    }
                    if (state is WithdrawUiState.Error) {
                        item {
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.errorContainer
                                )
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Error, null, tint = MaterialTheme.colorScheme.error)
                                    Spacer(Modifier.width(8.dp))
                                    Text(state.message)
                                }
                            }
                        }
                    }

                    // Method selector
                    item {
                        Text("Payment Method", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold))
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("UPI", "BANK").forEach { method ->
                                FilterChip(
                                    selected = selectedMethod == method,
                                    onClick = { viewModel.setMethod(method) },
                                    label = { Text(if (method == "BANK") "Bank" else method) }
                                )
                            }
                        }
                    }

                    // Payment accounts
                    readyState?.let { ready ->
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Payment Accounts", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold))
                                TextButton(onClick = {
                                    if (selectedMethod == "UPI") showAddUpiDialog = true
                                    else showAddBankDialog = true
                                }) {
                                    Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Add ${selectedMethod}")
                                }
                            }
                        }
                        if (ready.paymentAccounts.isEmpty()) {
                            item {
                                OutlinedCard(modifier = Modifier.fillMaxWidth()) {
                                    Box(
                                        modifier = Modifier.fillMaxWidth().padding(20.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("No payment accounts. Add UPI or Bank account.", style = MaterialTheme.typography.bodySmall)
                                    }
                                }
                            }
                        } else {
                            items(ready.paymentAccounts.filter { it.type.equals(selectedMethod, ignoreCase = true) }) { account ->
                                PaymentAccountItem(
                                    account = account,
                                    isSelected = viewModel.selectedAccountId.collectAsState().value == account.id,
                                    onSelect = { viewModel.setAccountId(account.id) }
                                )
                            }
                        }
                    }

                    // Amount input
                    item {
                        Text("Amount", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold))
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = amountInput,
                            onValueChange = {
                                amountInput = it
                                it.toDoubleOrNull()?.let { amt -> viewModel.setAmount(amt) }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            prefix = { Text("₹") },
                            placeholder = { Text("Enter amount") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true
                        )
                        Spacer(Modifier.height(8.dp))
                        QuickAmountButtons(
                            availableBalance = readyState?.wallet?.balance ?: 0.0,
                            onAmountSelected = { amt ->
                                amountInput = amt.toString()
                                viewModel.setAmount(amt)
                            }
                        )
                    }

                    // Withdraw button
                    item {
                        Button(
                            onClick = { viewModel.requestWithdrawal() },
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            enabled = uiState !is WithdrawUiState.Loading
                        ) {
                            Text("Request Withdrawal", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold))
                        }
                    }

                    // Withdrawal history
                    readyState?.let { ready ->
                        if (ready.withdrawHistory.isNotEmpty()) {
                            item {
                                Text("Recent Withdrawals", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold))
                            }
                            items(ready.withdrawHistory) { txn ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(txn.method ?: "Unknown", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
                                            Text(
                                                text = try {
                                                    val inputFmt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault())
                                                    val outputFmt = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.getDefault())
                                                    outputFmt.format(inputFmt.parse(txn.createdAt)!!)
                                                } catch (e: Exception) { txn.createdAt },
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                                            )
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text("₹%.2f".format(txn.amount), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                                            Text(txn.status, style = MaterialTheme.typography.labelSmall)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            else -> {}
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
private fun PaymentAccountItem(
    account: PaymentAccount,
    isSelected: Boolean,
    onSelect: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(16.dp),
        onClick = onSelect
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadioButton(selected = isSelected, onClick = onSelect)
            Spacer(Modifier.width(8.dp))
            Column {
                Text(account.type, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
                Text(account.details, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
            }
        }
    }
}

@Composable
private fun AddUpiDialog(
    onDismiss: () -> Unit,
    onAdd: (String, String) -> Unit
) {
    var upiId by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add UPI ID") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = upiId,
                    onValueChange = { upiId = it },
                    label = { Text("UPI ID") },
                    placeholder = { Text("example@upi") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Account Holder Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (upiId.isNotEmpty() && name.isNotEmpty()) onAdd(upiId, name) },
                enabled = upiId.isNotEmpty() && name.isNotEmpty()
            ) { Text("Add") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
private fun AddBankDialog(
    onDismiss: () -> Unit,
    onAdd: (String, String, String, String) -> Unit
) {
    var accountNumber by remember { mutableStateOf("") }
    var ifsc by remember { mutableStateOf("") }
    var bankName by remember { mutableStateOf("") }
    var holderName by remember { mutableStateOf("") }
    val isValid = accountNumber.isNotEmpty() && ifsc.isNotEmpty() && bankName.isNotEmpty() && holderName.isNotEmpty()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Bank Account") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = accountNumber, onValueChange = { accountNumber = it },
                    label = { Text("Account Number") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                OutlinedTextField(value = ifsc, onValueChange = { ifsc = it.uppercase() },
                    label = { Text("IFSC Code") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = bankName, onValueChange = { bankName = it },
                    label = { Text("Bank Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = holderName, onValueChange = { holderName = it },
                    label = { Text("Account Holder Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            Button(onClick = { if (isValid) onAdd(accountNumber, ifsc, bankName, holderName) }, enabled = isValid) {
                Text("Add")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
