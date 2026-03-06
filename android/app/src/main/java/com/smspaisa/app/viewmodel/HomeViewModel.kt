package com.smspaisa.app.viewmodel

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.api.WebSocketManager
import com.smspaisa.app.data.datastore.UserPreferences
import com.smspaisa.app.data.repository.SmsRepository
import com.smspaisa.app.data.repository.WalletRepository
import com.smspaisa.app.model.SendingProgress
import com.smspaisa.app.model.SmsLog
import com.smspaisa.app.model.TodayStats
import com.smspaisa.app.model.Wallet
import com.smspaisa.app.service.SendingProgressManager
import com.smspaisa.app.service.SmsSenderService
import com.smspaisa.app.utils.toUserMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class HomeUiState {
    object Loading : HomeUiState()
    data class Success(
        val wallet: Wallet,
        val todayStats: TodayStats,
        val recentLogs: List<SmsLog>,
        val serviceEnabled: Boolean,
        val userName: String
    ) : HomeUiState()
    data class Error(val message: String) : HomeUiState()
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val walletRepository: WalletRepository,
    private val smsRepository: SmsRepository,
    private val userPreferences: UserPreferences,
    private val webSocketManager: WebSocketManager,
    private val sendingProgressManager: SendingProgressManager,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private val _serviceEnabled = MutableStateFlow(false)
    val serviceEnabled: StateFlow<Boolean> = _serviceEnabled.asStateFlow()

    val sendingProgress: StateFlow<SendingProgress> = sendingProgressManager.progress

    init {
        loadData()
        observeServiceState()
        observeWebSocket()
    }

    private fun observeWebSocket() {
        viewModelScope.launch {
            webSocketManager.balanceUpdated.collect { balance ->
                balance ?: return@collect
                refreshBalance()
            }
        }
    }

    private fun observeServiceState() {
        viewModelScope.launch {
            userPreferences.serviceEnabled.collect { enabled ->
                updateServiceEnabledState(enabled)
            }
        }
    }

    private fun updateServiceEnabledState(enabled: Boolean) {
        _serviceEnabled.value = enabled
        val current = _uiState.value
        if (current is HomeUiState.Success && current.serviceEnabled != enabled) {
            _uiState.value = current.copy(serviceEnabled = enabled)
        }
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading
            try {
                val walletResult = walletRepository.getBalance()
                val statsResult = smsRepository.getTodayStats()
                val logsResult = smsRepository.getSmsLog(1, 10)
                val name = userPreferences.userName.first()
                val serviceOn = userPreferences.serviceEnabled.first()

                val wallet = walletResult.getOrElse { Wallet(0.0, 0.0, 0.0) }
                val stats = statsResult.getOrElse { TodayStats(0, 0, 0, 0.0, 200) }
                val logs = logsResult.getOrElse { emptyList() }

                _uiState.value = HomeUiState.Success(
                    wallet = wallet,
                    todayStats = stats,
                    recentLogs = logs,
                    serviceEnabled = serviceOn,
                    userName = name ?: "User"
                )
            } catch (e: Exception) {
                _uiState.value = HomeUiState.Error(e.toUserMessage())
            }
        }
    }

    private val _permissionsNeeded = MutableStateFlow(false)
    val permissionsNeeded: StateFlow<Boolean> = _permissionsNeeded.asStateFlow()

    fun toggleService(enable: Boolean) {
        if (enable) {
            _permissionsNeeded.value = true
        } else {
            viewModelScope.launch {
                val previousEnabled = _serviceEnabled.value
                try {
                    userPreferences.setServiceEnabled(false)
                    updateServiceEnabledState(false)
                    val intent = Intent(context, SmsSenderService::class.java)
                    context.stopService(intent)
                } catch (e: Exception) {
                    updateServiceEnabledState(previousEnabled)
                }
            }
        }
    }

    fun onPermissionsResult(allGranted: Boolean) {
        _permissionsNeeded.value = false
        if (allGranted) {
            val sendSmsGranted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.SEND_SMS
            ) == PackageManager.PERMISSION_GRANTED

            val notificationsGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    context, Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }

            if (!sendSmsGranted || !notificationsGranted) {
                updateServiceEnabledState(false)
                return
            }

            viewModelScope.launch {
                try {
                    userPreferences.setServiceEnabled(true)
                    updateServiceEnabledState(true)
                    val intent = Intent(context, SmsSenderService::class.java)
                    context.startForegroundService(intent)
                } catch (e: Exception) {
                    updateServiceEnabledState(false)
                }
            }
        }
    }

    fun retryBatchPolling() {
        sendingProgressManager.triggerRetry()
    }

    fun refreshBalance() {
        viewModelScope.launch {
            val result = walletRepository.getBalance()
            val current = _uiState.value
            if (result.isSuccess && current is HomeUiState.Success) {
                _uiState.value = current.copy(wallet = result.getOrThrow())
            }
        }
    }
}
