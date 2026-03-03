package com.smspaisa.app.model

data class SendingProgress(
    val status: SendingStatus = SendingStatus.IDLE,
    val totalInRound: Int = 0,
    val sentInRound: Int = 0,
    val currentRecipient: String = "",
    val currentMessagePreview: String = "",
    val roundLimit: Int = 25,
    val errorMessage: String? = null,
    val roundSent: Int = 0,
    val roundFailed: Int = 0,
    val roundEarnings: Double = 0.0
)

enum class SendingStatus {
    IDLE, FETCHING, SENDING, WAITING, VERIFYING, REPORTING, ROUND_COMPLETE, ERROR
}
