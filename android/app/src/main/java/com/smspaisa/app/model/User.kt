package com.smspaisa.app.model

import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName

@Keep
data class User(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String? = null,
    @SerializedName("phone") val phone: String,
    @SerializedName("email") val email: String?,
    @SerializedName("referralCode") val referralCode: String = "",
    @SerializedName("createdAt") val createdAt: String = ""
)
