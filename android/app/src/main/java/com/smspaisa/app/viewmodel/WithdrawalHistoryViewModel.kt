package com.smspaisa.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.repository.WalletRepository
import com.smspaisa.app.model.Transaction
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.smspaisa.app.utils.toUserMessage
import javax.inject.Inject

sealed class WithdrawalHistoryUiState {
    object Loading : WithdrawalHistoryUiState()
    data class Success(val transactions: List<Transaction>) : WithdrawalHistoryUiState()
    data class Error(val message: String) : WithdrawalHistoryUiState()
}

@HiltViewModel
class WithdrawalHistoryViewModel @Inject constructor(
    private val walletRepository: WalletRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<WithdrawalHistoryUiState>(WithdrawalHistoryUiState.Loading)
    val uiState: StateFlow<WithdrawalHistoryUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = WithdrawalHistoryUiState.Loading
            val result = walletRepository.getWithdrawHistory()
            _uiState.value = if (result.isSuccess) {
                WithdrawalHistoryUiState.Success(result.getOrDefault(emptyList()))
            } else {
                WithdrawalHistoryUiState.Error(result.exceptionOrNull()?.toUserMessage() ?: "Failed to load history")
            }
        }
    }
}
