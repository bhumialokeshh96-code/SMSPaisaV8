package com.smspaisa.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.datastore.UserPreferences
import com.smspaisa.app.data.repository.AuthRepository
import com.smspaisa.app.data.repository.DeviceRepository
import com.smspaisa.app.ui.navigation.Screen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import com.smspaisa.app.utils.toUserMessage
import javax.inject.Inject

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    object Success : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val deviceRepository: DeviceRepository,
    private val userPreferences: UserPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val _startDestination = MutableStateFlow(Screen.Onboarding.route)
    val startDestination: StateFlow<String> = _startDestination.asStateFlow()

    private val _isReady = MutableStateFlow(false)
    val isReady: StateFlow<Boolean> = _isReady.asStateFlow()

    init {
        determineStartDestination()
    }

    private fun determineStartDestination() {
        viewModelScope.launch {
            val onboardingDone = userPreferences.onboardingCompleted.first()
            val token = userPreferences.authToken.first()
            _startDestination.value = when {
                !onboardingDone -> Screen.Onboarding.route
                token.isNullOrEmpty() -> Screen.Login.route
                else -> Screen.Home.route
            }
            _isReady.value = true
        }
    }

    fun login(phone: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            val result = authRepository.login(phone, password)
            _uiState.value = if (result.isSuccess) {
                AuthUiState.Success
            } else {
                AuthUiState.Error(result.exceptionOrNull()?.toUserMessage() ?: "Login failed")
            }
        }
    }

    fun register(phone: String, email: String?, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            val deviceId = deviceRepository.getDeviceId()
            val result = authRepository.register(phone, email, password, deviceId)
            _uiState.value = if (result.isSuccess) {
                AuthUiState.Success
            } else {
                AuthUiState.Error(result.exceptionOrNull()?.toUserMessage() ?: "Registration failed")
            }
        }
    }

    fun completeOnboarding() {
        viewModelScope.launch {
            userPreferences.setOnboardingCompleted(true)
        }
    }

    fun resetState() {
        _uiState.value = AuthUiState.Idle
    }
}
