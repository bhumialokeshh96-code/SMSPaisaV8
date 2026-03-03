package com.smspaisa.app.model

import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName

@Keep
data class Wallet(
    @SerializedName("balance") val balance: Double,
    @SerializedName("totalEarned") val totalEarned: Double,
    @SerializedName("totalWithdrawn") val totalWithdrawn: Double
)
