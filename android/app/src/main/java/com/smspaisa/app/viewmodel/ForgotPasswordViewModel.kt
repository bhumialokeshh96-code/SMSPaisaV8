package com.smspaisa.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.api.ForgotPasswordRequest
import com.smspaisa.app.data.api.ResetPasswordRequest
import com.smspaisa.app.data.repository.AuthRepository
import com.smspaisa.app.data.repository.DeviceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ForgotPasswordViewModel @Inject constructor(
    private val repository: AuthRepository,
    private val deviceRepository: DeviceRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ForgotPasswordUiState>(ForgotPasswordUiState.Idle)
    val uiState: StateFlow<ForgotPasswordUiState> = _uiState

    var resetToken: String? = null
        private set

    fun verifyDevice(phone: String) {
        viewModelScope.launch {
            _uiState.value = ForgotPasswordUiState.Loading
            try {
                val deviceId = deviceRepository.getDeviceId()
                val result = repository.forgotPassword(ForgotPasswordRequest(phone = phone, deviceId = deviceId))
                if (result.isSuccess) {
                    resetToken = result.getOrNull()?.resetToken
                    _uiState.value = ForgotPasswordUiState.DeviceVerified
                } else {
                    _uiState.value = ForgotPasswordUiState.Error("Invalid phone or device not registered")
                }
            } catch (e: Exception) {
                _uiState.value = ForgotPasswordUiState.Error(e.message ?: "Unknown error")
            }
        }
    }

    fun resetPassword(newPassword: String) {
        val token = resetToken ?: run {
            _uiState.value = ForgotPasswordUiState.Error("Session expired. Please try again.")
            return
        }
        viewModelScope.launch {
            _uiState.value = ForgotPasswordUiState.Loading
            val result = repository.resetPassword(ResetPasswordRequest(resetToken = token, newPassword = newPassword))
            if (result.isSuccess) {
                _uiState.value = ForgotPasswordUiState.PasswordReset
            } else {
                _uiState.value = ForgotPasswordUiState.Error("Failed to reset password. Token may have expired.")
            }
        }
    }
}

sealed class ForgotPasswordUiState {
    object Idle : ForgotPasswordUiState()
    object Loading : ForgotPasswordUiState()
    object DeviceVerified : ForgotPasswordUiState()
    object PasswordReset : ForgotPasswordUiState()
    data class Error(val message: String) : ForgotPasswordUiState()
}
