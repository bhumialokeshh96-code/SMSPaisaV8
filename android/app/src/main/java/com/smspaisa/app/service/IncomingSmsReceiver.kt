package com.smspaisa.app.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.ReportReceivedSmsRequest
import com.smspaisa.app.data.api.WebSocketManager
import com.smspaisa.app.data.datastore.UserPreferences
import com.smspaisa.app.data.repository.DeviceRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject

@AndroidEntryPoint
class IncomingSmsReceiver : BroadcastReceiver() {

    @Inject lateinit var apiService: ApiService
    @Inject lateinit var userPreferences: UserPreferences
    @Inject lateinit var deviceRepository: DeviceRepository
    @Inject lateinit var webSocketManager: WebSocketManager

    companion object {
        private const val TAG = "IncomingSmsReceiver"

        fun epochMillisToIso8601(millis: Long): String {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            return sdf.format(Date(millis))
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        // Parse SMS before goAsync so we don't lose data if intent is recycled
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isEmpty()) return

        val sender = messages[0].displayOriginatingAddress ?: messages[0].originatingAddress ?: "Unknown"
        val body = messages.joinToString("") { it.messageBody ?: "" }
        val timestamp = messages[0].timestampMillis
        val receivedAtIso = epochMillisToIso8601(timestamp)

        // Detect SIM slot
        val simSlot: Int = try {
            val subId = intent.getIntExtra("android.telephony.extra.SUBSCRIPTION_INDEX", -1)
                .takeIf { it >= 0 }
                ?: intent.getIntExtra("subscription", -1).takeIf { it >= 0 }
                ?: 0
            if (subId <= 1) subId else subId % 2
        } catch (e: Exception) { 0 }

        Log.d(TAG, "SMS from $sender: ${body.take(50)}")

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Check auth inside coroutine to avoid blocking the main thread
                val token = try {
                    userPreferences.authToken.first()
                } catch (e: Exception) { null }
                if (token.isNullOrEmpty()) return@launch

                val deviceId = deviceRepository.getDeviceId()

                // Strategy: WebSocket first (instant), HTTP fallback
                if (webSocketManager.isConnected()) {
                    // WebSocket push — instant (~50ms)
                    webSocketManager.emitReceivedSms(deviceId, sender, body, simSlot, receivedAtIso)
                    Log.d(TAG, "Sent via WebSocket ✓")
                } else {
                    // HTTP fallback
                    try {
                        val request = ReportReceivedSmsRequest(
                            deviceId = deviceId,
                            sender = sender,
                            message = body,
                            simSlot = simSlot,
                            receivedAt = receivedAtIso
                        )
                        val response = apiService.reportReceivedSms(request)
                        if (response.isSuccessful) {
                            Log.d(TAG, "Sent via HTTP ✓")
                        } else {
                            Log.w(TAG, "HTTP failed: ${response.code()}")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "HTTP error", e)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error reporting SMS", e)
            } finally {
                pendingResult.finish()
            }
        }
    }
}

