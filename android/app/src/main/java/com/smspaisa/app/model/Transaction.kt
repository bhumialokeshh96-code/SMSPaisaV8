package com.smspaisa.app.model

import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName

@Keep
data class Transaction(
    @SerializedName("id") val id: String,
    @SerializedName("type") val type: String,
    @SerializedName("amount") val amount: Double,
    @SerializedName("status") val status: String,
    @SerializedName("method") val method: String?,
    @SerializedName("createdAt") val createdAt: String
)
