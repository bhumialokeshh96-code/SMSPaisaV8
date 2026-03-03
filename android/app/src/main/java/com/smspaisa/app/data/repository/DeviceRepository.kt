package com.smspaisa.app.data.repository

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.telephony.TelephonyManager
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.HeartbeatRequest
import com.smspaisa.app.data.api.RegisterDeviceRequest
import com.smspaisa.app.data.api.UpdateDeviceSettingsRequest
import com.smspaisa.app.model.Device
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceRepository @Inject constructor(
    private val apiService: ApiService,
    @ApplicationContext private val context: Context
) {
    @SuppressLint("HardwareIds")
    fun getDeviceId(): String {
        return android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        ) ?: "unknown"
    }

    fun getDeviceName(): String {
        return "${Build.MANUFACTURER} ${Build.MODEL}"
    }

    fun getSimCount(): Int {
        return try {
            val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                tm.activeModemCount
            } else {
                @Suppress("DEPRECATION")
                tm.phoneCount
            }
        } catch (e: Exception) {
            1
        }
    }

    suspend fun registerDevice(fcmToken: String? = null): Result<Device> = withContext(Dispatchers.IO) {
        try {
            val simCount = getSimCount()
            val simInfo = buildMap<String, Any?> {
                put("simCount", simCount)
                if (fcmToken != null) put("fcmToken", fcmToken)
            }
            val request = RegisterDeviceRequest(
                deviceId = getDeviceId(),
                deviceName = getDeviceName(),
                simInfo = simInfo
            )
            val response = apiService.registerDevice(request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.error?.message ?: "Failed to register device"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateDeviceSettings(
        dailyLimit: Int? = null,
        activeHoursStart: String? = null,
        activeHoursEnd: String? = null
    ): Result<Device> = withContext(Dispatchers.IO) {
        try {
            val request = UpdateDeviceSettingsRequest(
                deviceId = getDeviceId(),
                dailyLimit = dailyLimit,
                activeHoursStart = activeHoursStart,
                activeHoursEnd = activeHoursEnd
            )
            val response = apiService.updateDeviceSettings(request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception("Failed to update device settings"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun heartbeat(batteryLevel: Int, isCharging: Boolean, networkType: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response = apiService.heartbeat(
                    HeartbeatRequest(getDeviceId(), batteryLevel, isCharging, networkType)
                )
                if (response.isSuccessful) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("Heartbeat failed"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun getDevices(): Result<List<Device>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getDevices()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception("Failed to get devices"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
