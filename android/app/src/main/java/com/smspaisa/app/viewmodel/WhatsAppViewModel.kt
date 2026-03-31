package com.smspaisa.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.WhatsAppBindRequest
import com.smspaisa.app.utils.toUserMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class WhatsAppUiState {
    object Loading : WhatsAppUiState()
    object Unbound : WhatsAppUiState()
    data class BindSuccess(val phone: String) : WhatsAppUiState()
    data class StatusResult(val phone: String, val status: String, val sendTime: Int) : WhatsAppUiState()
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
                    if (data != null && data.phone != null) {
                        _uiState.value = WhatsAppUiState.StatusResult(
                            phone = data.phone,
                            status = data.status,
                            sendTime = data.sendTime
                        )
                    } else {
                        _uiState.value = WhatsAppUiState.Unbound
                    }
                } else {
                    _uiState.value = WhatsAppUiState.Unbound
                }
            } catch (e: Exception) {
                _uiState.value = WhatsAppUiState.Error(e.toUserMessage())
            }
        }
    }

    fun bindWhatsApp(phone: String) {
        if (phone.isBlank()) {
            _uiState.value = WhatsAppUiState.Error("Please enter a valid phone number.")
            return
        }
        viewModelScope.launch {
            _uiState.value = WhatsAppUiState.Loading
            try {
                val response = apiService.bindWhatsApp(WhatsAppBindRequest(phone))
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()!!.data
                    if (data?.status == "success") {
                        _uiState.value = WhatsAppUiState.BindSuccess(phone)
                    } else {
                        _uiState.value = WhatsAppUiState.Error(data?.message ?: "Not Connected")
                    }
                } else {
                    val errorMsg = response.body()?.error?.message ?: "Failed to bind WhatsApp."
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
                    _uiState.value = WhatsAppUiState.Unbound
                } else {
                    _uiState.value = WhatsAppUiState.Error("Failed to unlink WhatsApp. Please try again.")
                }
            } catch (e: Exception) {
                _uiState.value = WhatsAppUiState.Error(e.toUserMessage())
            }
        }
    }
}
