package com.smspaisa.app.service

import com.smspaisa.app.model.SendingProgress
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SendingProgressManager @Inject constructor() {
    private val _progress = MutableStateFlow(SendingProgress())
    val progress: StateFlow<SendingProgress> = _progress.asStateFlow()

    private val _retryTrigger = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val retryTrigger: SharedFlow<Unit> = _retryTrigger.asSharedFlow()

    fun updateProgress(progress: SendingProgress) {
        _progress.value = progress
    }

    fun triggerRetry() {
        _retryTrigger.tryEmit(Unit)
    }

    fun reset() {
        _progress.value = SendingProgress()
    }

    companion object {
        fun maskPhone(phone: String): String {
            if (phone.length <= 4) return "****"
            return phone.take(2) + "*".repeat(phone.length - 4) + phone.takeLast(2)
        }

        fun maskMessage(message: String): String {
            if (message.length <= 3) return "***"
            return message.take(3) + "***"
        }
    }
}
