package com.smspaisa.app.data.repository

import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.AppVersionResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppUpdateRepository @Inject constructor(
    private val apiService: ApiService
) {
    suspend fun getLatestVersion(): Result<AppVersionResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getAppVersion()
            if (response.isSuccessful && response.body()?.success == true) {
                val data = response.body()?.data
                if (data != null) {
                    Result.success(data)
                } else {
                    Result.failure(Exception("Failed to check update"))
                }
            } else {
                Result.failure(Exception("Failed to check update"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun isUpdateAvailable(currentVersion: String, latestVersion: String): Boolean {
        return compareVersions(latestVersion, currentVersion) > 0
    }

    fun isForceUpdate(currentVersion: String, minVersion: String): Boolean {
        return compareVersions(currentVersion, minVersion) < 0
    }

    private fun compareVersions(v1: String, v2: String): Int {
        val parts1 = v1.split(".").map { it.toIntOrNull() ?: 0 }
        val parts2 = v2.split(".").map { it.toIntOrNull() ?: 0 }
        val maxLen = maxOf(parts1.size, parts2.size)
        for (i in 0 until maxLen) {
            val p1 = parts1.getOrElse(i) { 0 }
            val p2 = parts2.getOrElse(i) { 0 }
            if (p1 != p2) return p1 - p2
        }
        return 0
    }
}
