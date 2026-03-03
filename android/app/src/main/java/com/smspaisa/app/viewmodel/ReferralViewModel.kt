package com.smspaisa.app.viewmodel

import android.content.Context
import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.ApplyReferralRequest
import com.smspaisa.app.data.api.ReferralStats
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.smspaisa.app.utils.toUserMessage
import javax.inject.Inject

sealed class ReferralUiState {
    object Loading : ReferralUiState()
    data class Success(val stats: ReferralStats) : ReferralUiState()
    data class Error(val message: String) : ReferralUiState()
}

@HiltViewModel
class ReferralViewModel @Inject constructor(
    private val apiService: ApiService,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow<ReferralUiState>(ReferralUiState.Loading)
    val uiState: StateFlow<ReferralUiState> = _uiState.asStateFlow()

    private val _applyResult = MutableStateFlow<String?>(null)
    val applyResult: StateFlow<String?> = _applyResult.asStateFlow()

    init {
        loadReferralStats()
    }

    fun loadReferralStats() {
        viewModelScope.launch {
            _uiState.value = ReferralUiState.Loading
            try {
                val response = apiService.getReferralStats()
                if (response.isSuccessful && response.body()?.success == true) {
                    _uiState.value = ReferralUiState.Success(response.body()!!.data!!)
                } else {
                    _uiState.value = ReferralUiState.Error("Failed to load referral stats")
                }
            } catch (e: Exception) {
                _uiState.value = ReferralUiState.Error(e.toUserMessage())
            }
        }
    }

    fun applyReferralCode(code: String) {
        viewModelScope.launch {
            try {
                val response = apiService.applyReferral(ApplyReferralRequest(code))
                if (response.isSuccessful && response.body()?.success == true) {
                    _applyResult.value = "Referral code applied successfully!"
                    loadReferralStats()
                } else {
                    _applyResult.value = response.body()?.error?.message ?: "Failed to apply code"
                }
            } catch (e: Exception) {
                _applyResult.value = e.toUserMessage()
            }
        }
    }

    fun shareReferralCode(code: String) {
        viewModelScope.launch {
            val downloadLink = try {
                val response = apiService.getAppVersion()
                val url = response.body()?.data?.apkUrl
                if (response.isSuccessful && !url.isNullOrBlank()) url
                else "https://smspaisa.com/app"
            } catch (e: Exception) {
                "https://smspaisa.com/app"
            }

            val shareIntent = Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(
                        Intent.EXTRA_TEXT,
                        "Join SMSPaisa and earn money by sending SMS! Use my referral code: $code\nDownload: $downloadLink"
                    )
                },
                "Share via"
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(shareIntent)
        }
    }

    fun clearApplyResult() {
        _applyResult.value = null
    }
}
