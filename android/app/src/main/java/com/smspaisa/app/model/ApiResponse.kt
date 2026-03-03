package com.smspaisa.app.model

import androidx.annotation.Keep

@Keep
data class ApiResponse<T>(
    val success: Boolean,
    val data: T?,
    val error: ApiError?
)

@Keep
data class ApiError(
    val message: String,
    val code: String?
)
