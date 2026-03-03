package com.smspaisa.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.SupportLinks
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SupportViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _supportLinks = MutableStateFlow<SupportLinks?>(null)
    val supportLinks: StateFlow<SupportLinks?> = _supportLinks.asStateFlow()

    init {
        fetchSupportLinks()
    }

    private fun fetchSupportLinks() {
        viewModelScope.launch {
            try {
                val response = apiService.getSupportLinks()
                if (response.isSuccessful && response.body()?.success == true) {
                    _supportLinks.value = response.body()?.data
                }
            } catch (e: Exception) {
                // Silently fail — fallback links are hardcoded in the UI
            }
        }
    }
}
