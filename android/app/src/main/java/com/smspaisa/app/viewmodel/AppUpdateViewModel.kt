package com.smspaisa.app.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.api.AppVersionResponse
import com.smspaisa.app.data.repository.AppUpdateRepository
import com.smspaisa.app.utils.ApkDownloadManager
import com.smspaisa.app.utils.DownloadState
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AppUpdateViewModel @Inject constructor(
    private val repository: AppUpdateRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _updateInfo = MutableStateFlow<AppVersionResponse?>(null)
    val updateInfo: StateFlow<AppVersionResponse?> = _updateInfo.asStateFlow()

    private val _downloadState = MutableStateFlow<DownloadState>(DownloadState.Idle)
    val downloadState: StateFlow<DownloadState> = _downloadState.asStateFlow()

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

    fun startDownload(apkUrl: String) {
        viewModelScope.launch {
            ApkDownloadManager.downloadApk(context, apkUrl).collect { state ->
                _downloadState.value = state
            }
        }
    }

    fun resetDownload() {
        _downloadState.value = DownloadState.Idle
    }

    fun dismissUpdate() {
        val info = _updateInfo.value
        if (info?.forceUpdate == false) {
            _updateInfo.value = null
            _downloadState.value = DownloadState.Idle
        }
    }
}
