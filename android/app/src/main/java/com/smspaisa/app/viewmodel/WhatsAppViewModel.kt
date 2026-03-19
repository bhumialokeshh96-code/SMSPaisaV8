package com.smspaisa.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.WhatsAppPairRequest
import com.smspaisa.app.utils.toUserMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class WhatsAppUiState {
    object Loading : WhatsAppUiState()
    object Unlinked : WhatsAppUiState()
    data class CodeGenerated(val code: String) : WhatsAppUiState()
    data class Linked(val number: String) : WhatsAppUiState()
    data class Error(val message: String) : WhatsAppUiState()
}

@HiltViewModel
class WhatsAppViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow<WhatsAppUiState>(WhatsAppUiState.Loading)
    val uiState: StateFlow<WhatsAppUiState> = _uiState.asStateFlow()

    init {
        checkStatus()
    }

    fun checkStatus() {
        viewModelScope.launch {
            _uiState.value = WhatsAppUiState.Loading
            try {
                val response = apiService.getWhatsAppStatus()
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()!!.data
                    if (data != null && data.status == "CONNECTED" && data.number != null) {
                        _uiState.value = WhatsAppUiState.Linked(data.number)
                    } else {
                        _uiState.value = WhatsAppUiState.Unlinked
                    }
                } else {
                    _uiState.value = WhatsAppUiState.Unlinked
                }
            } catch (e: Exception) {
                _uiState.value = WhatsAppUiState.Error(e.toUserMessage())
            }
        }
    }

    fun requestPairingCode(phoneNumber: String) {
        if (phoneNumber.isBlank()) {
            _uiState.value = WhatsAppUiState.Error("Please enter a valid phone number with country code (e.g., 919876543210 — no + or spaces).")
            return
        }
        viewModelScope.launch {
            _uiState.value = WhatsAppUiState.Loading
            try {
                val response = apiService.requestWhatsAppPairing(WhatsAppPairRequest(phoneNumber))
                if (response.isSuccessful && response.body()?.success == true) {
                    val code = response.body()!!.data?.code
                    if (!code.isNullOrBlank()) {
                        _uiState.value = WhatsAppUiState.CodeGenerated(code)
                    } else {
                        _uiState.value = WhatsAppUiState.Error("Failed to generate pairing code. Please try again.")
                    }
                } else {
                    val errorMsg = response.body()?.error?.message ?: "Failed to request pairing code."
                    _uiState.value = WhatsAppUiState.Error(errorMsg)
                }
            } catch (e: Exception) {
                _uiState.value = WhatsAppUiState.Error(e.toUserMessage())
            }
        }
    }

    fun unlinkAccount() {
        viewModelScope.launch {
            _uiState.value = WhatsAppUiState.Loading
            try {
                val response = apiService.unlinkWhatsApp()
                if (response.isSuccessful) {
                    _uiState.value = WhatsAppUiState.Unlinked
                } else {
                    _uiState.value = WhatsAppUiState.Error("Failed to unlink WhatsApp. Please try again.")
                }
            } catch (e: Exception) {
                _uiState.value = WhatsAppUiState.Error(e.toUserMessage())
            }
        }
    }
}
