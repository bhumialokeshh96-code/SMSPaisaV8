package com.smspaisa.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.datastore.UserPreferences
import com.smspaisa.app.data.repository.AuthRepository
import com.smspaisa.app.data.repository.DeviceRepository
import com.smspaisa.app.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import com.smspaisa.app.utils.toUserMessage
import javax.inject.Inject

sealed class ProfileUiState {
    object Loading : ProfileUiState()
    data class Success(
        val user: User,
        val dailySmsLimit: Int,
        val stopBatteryPercent: Int,
        val preferredSim: Int,
        val wifiOnly: Boolean
    ) : ProfileUiState()
    data class Error(val message: String) : ProfileUiState()
}

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val deviceRepository: DeviceRepository,
    private val userPreferences: UserPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow<ProfileUiState>(ProfileUiState.Loading)
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        loadProfile()
    }

    fun loadProfile() {
        viewModelScope.launch {
            _uiState.value = ProfileUiState.Loading
            val profileResult = authRepository.getProfile()
            profileResult.onSuccess { user ->
                val limit = userPreferences.dailySmsLimit.first()
                val battery = userPreferences.stopBatteryPercent.first()
                val sim = userPreferences.preferredSim.first()
                val wifi = userPreferences.wifiOnly.first()
                _uiState.value = ProfileUiState.Success(
                    user = user,
                    dailySmsLimit = limit,
                    stopBatteryPercent = battery,
                    preferredSim = sim,
                    wifiOnly = wifi
                )
            }
            profileResult.onFailure {
                _uiState.value = ProfileUiState.Error(it.toUserMessage())
            }
        }
    }

    fun updateDailySmsLimit(limit: Int) {
        viewModelScope.launch {
            userPreferences.setDailySmsLimit(limit)
            deviceRepository.updateDeviceSettings(dailyLimit = limit)
            refreshSettings()
        }
    }

    fun updateStopBatteryPercent(percent: Int) {
        viewModelScope.launch {
            userPreferences.setStopBatteryPercent(percent)
            refreshSettings()
        }
    }

    fun updatePreferredSim(sim: Int) {
        viewModelScope.launch {
            userPreferences.setPreferredSim(sim)
            refreshSettings()
        }
    }

    fun updateWifiOnly(wifiOnly: Boolean) {
        viewModelScope.launch {
            userPreferences.setWifiOnly(wifiOnly)
            refreshSettings()
        }
    }

    private fun refreshSettings() {
        val current = _uiState.value
        if (current is ProfileUiState.Success) {
            viewModelScope.launch {
                val limit = userPreferences.dailySmsLimit.first()
                val battery = userPreferences.stopBatteryPercent.first()
                val sim = userPreferences.preferredSim.first()
                val wifi = userPreferences.wifiOnly.first()
                _uiState.value = current.copy(
                    dailySmsLimit = limit,
                    stopBatteryPercent = battery,
                    preferredSim = sim,
                    wifiOnly = wifi
                )
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
        }
    }
}

