package com.smspaisa.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.api.AppVersionResponse
import com.smspaisa.app.data.repository.AppUpdateRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AppUpdateViewModel @Inject constructor(
    private val repository: AppUpdateRepository
) : ViewModel() {

    private val _updateInfo = MutableStateFlow<AppVersionResponse?>(null)
    val updateInfo: StateFlow<AppVersionResponse?> = _updateInfo.asStateFlow()

    fun checkForUpdate(currentVersion: String) {
        viewModelScope.launch {
            try {
                val result = repository.getLatestVersion()
                result.onSuccess { versionInfo ->
                    val needsUpdate = repository.isUpdateAvailable(currentVersion, versionInfo.latestVersion)
                    if (needsUpdate) {
                        _updateInfo.value = versionInfo
                    }
                }
            } catch (e: Exception) {
                // Silently ignore
            }
        }
    }

    fun dismissUpdate() {
        val info = _updateInfo.value
        if (info?.forceUpdate == false) {
            _updateInfo.value = null
        }
    }
}
