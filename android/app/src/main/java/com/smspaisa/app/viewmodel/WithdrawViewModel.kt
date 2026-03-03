package com.smspaisa.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.api.PaymentAccount
import com.smspaisa.app.data.repository.WalletRepository
import com.smspaisa.app.model.Transaction
import com.smspaisa.app.model.Wallet
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.smspaisa.app.utils.toUserMessage
import javax.inject.Inject

sealed class WithdrawUiState {
    object Idle : WithdrawUiState()
    object Loading : WithdrawUiState()
    data class Ready(
        val wallet: Wallet,
        val paymentAccounts: List<PaymentAccount>,
        val withdrawHistory: List<Transaction>
    ) : WithdrawUiState()
    data class Success(val message: String) : WithdrawUiState()
    data class Error(val message: String) : WithdrawUiState()
}

@HiltViewModel
class WithdrawViewModel @Inject constructor(
    private val walletRepository: WalletRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<WithdrawUiState>(WithdrawUiState.Loading)
    val uiState: StateFlow<WithdrawUiState> = _uiState.asStateFlow()

    private var _lastReadyState: WithdrawUiState.Ready? = null
    val lastReadyState: WithdrawUiState.Ready? get() = _lastReadyState

    private val _selectedAmount = MutableStateFlow(0.0)
    val selectedAmount: StateFlow<Double> = _selectedAmount.asStateFlow()

    private val _selectedMethod = MutableStateFlow("UPI")
    val selectedMethod: StateFlow<String> = _selectedMethod.asStateFlow()

    private val _selectedAccountId = MutableStateFlow("")
    val selectedAccountId: StateFlow<String> = _selectedAccountId.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = WithdrawUiState.Loading
            val walletResult = walletRepository.getBalance()
            val accountsResult = walletRepository.getPaymentAccounts()
            val historyResult = walletRepository.getWithdrawHistory()

            val wallet = walletResult.getOrElse { Wallet(0.0, 0.0, 0.0) }
            val accounts = accountsResult.getOrElse { emptyList() }
            val history = historyResult.getOrElse { emptyList() }

            val ready = WithdrawUiState.Ready(wallet, accounts, history)
            _lastReadyState = ready
            _uiState.value = ready
        }
    }

    fun setAmount(amount: Double) {
        _selectedAmount.value = amount
    }

    fun setMethod(method: String) {
        _selectedMethod.value = method
    }

    fun setAccountId(id: String) {
        _selectedAccountId.value = id
    }

    fun requestWithdrawal() {
        viewModelScope.launch {
            val amount = _selectedAmount.value
            if (amount <= 0) {
                _uiState.value = WithdrawUiState.Error("Please enter a valid amount")
                return@launch
            }
            val accountId = _selectedAccountId.value
            if (accountId.isEmpty()) {
                _uiState.value = WithdrawUiState.Error("Please select a payment account")
                return@launch
            }

            val accounts = _lastReadyState?.paymentAccounts ?: emptyList()
            val selectedAccount = accounts.find { it.id == accountId }
            if (selectedAccount == null) {
                _uiState.value = WithdrawUiState.Error("Selected payment account not found")
                return@launch
            }

            val paymentDetails = if (selectedAccount.type == "UPI") {
                mapOf(
                    "accountId" to selectedAccount.id,
                    "type" to "UPI",
                    "upiId" to (selectedAccount.upiId ?: ""),
                    "name" to (selectedAccount.accountHolderName ?: "")
                )
            } else {
                mapOf(
                    "accountId" to selectedAccount.id,
                    "type" to "BANK",
                    "accountNumber" to (selectedAccount.accountNumber ?: ""),
                    "ifsc" to (selectedAccount.ifsc ?: ""),
                    "bankName" to (selectedAccount.bankName ?: ""),
                    "accountHolderName" to (selectedAccount.accountHolderName ?: "")
                )
            }

            _uiState.value = WithdrawUiState.Loading
            val result = walletRepository.requestWithdrawal(amount, _selectedMethod.value, paymentDetails)
            if (result.isSuccess) {
                _uiState.value = WithdrawUiState.Success("Withdrawal of ₹$amount requested successfully!")
            } else {
                _uiState.value = WithdrawUiState.Error(result.exceptionOrNull()?.toUserMessage() ?: "Withdrawal failed")
            }
        }
    }

    fun addUpi(upiId: String, name: String) {
        viewModelScope.launch {
            val result = walletRepository.addUpi(upiId, name)
            if (result.isSuccess) {
                loadData()
            } else {
                _uiState.value = WithdrawUiState.Error(result.exceptionOrNull()?.toUserMessage() ?: "Failed to add UPI")
            }
        }
    }

    fun addBank(accountNumber: String, ifsc: String, bankName: String, accountHolderName: String) {
        viewModelScope.launch {
            val result = walletRepository.addBank(accountNumber, ifsc, accountHolderName, bankName)
            if (result.isSuccess) {
                loadData()
            } else {
                _uiState.value = WithdrawUiState.Error(result.exceptionOrNull()?.toUserMessage() ?: "Failed to add bank account")
            }
        }
    }

    fun resetState() {
        loadData()
    }
}
