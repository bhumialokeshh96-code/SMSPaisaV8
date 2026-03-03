package com.smspaisa.app.model

import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName

@Keep
data class SmsLog(
    @SerializedName("id") val id: String,
    @SerializedName("taskId") val taskId: String,
    @SerializedName("recipient") val recipient: String,
    @SerializedName("message") val message: String,
    @SerializedName("status") val status: SmsStatus,
    @SerializedName("amount") val amount: Double,
    @SerializedName("timestamp") val timestamp: Long
)

@Keep
enum class SmsStatus {
    QUEUED, ASSIGNED, SENT, DELIVERED, FAILED, PENDING
}
