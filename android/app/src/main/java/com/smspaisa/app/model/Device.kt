package com.smspaisa.app.model

import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName

@Keep
data class Device(
    @SerializedName("id") val id: String = "",
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceName") val deviceName: String,
    @SerializedName("dailyLimit") val dailyLimit: Int = 300,
    @SerializedName("activeHoursStart") val activeHoursStart: String = "09:00",
    @SerializedName("activeHoursEnd") val activeHoursEnd: String = "21:00",
    @SerializedName("isOnline") val isOnline: Boolean = false,
    @SerializedName("smsSentToday") val smsSentToday: Int = 0,
    @SerializedName("createdAt") val createdAt: String = ""
)
