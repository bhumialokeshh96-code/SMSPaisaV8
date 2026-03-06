package com.smspaisa.app.service

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Telephony
import android.telephony.SmsMessage
import android.util.Log
import androidx.core.app.NotificationCompat
import com.smspaisa.app.R
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.ReportReceivedSmsRequest
import com.smspaisa.app.data.datastore.UserPreferences
import com.smspaisa.app.data.local.PendingReceivedSmsDao
import com.smspaisa.app.data.local.PendingReceivedSmsEntity
import com.smspaisa.app.data.repository.DeviceRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

@AndroidEntryPoint
class IncomingSmsReceiver : BroadcastReceiver() {

    @Inject lateinit var apiService: ApiService
    @Inject lateinit var userPreferences: UserPreferences
    @Inject lateinit var deviceRepository: DeviceRepository
    @Inject lateinit var pendingReceivedSmsDao: PendingReceivedSmsDao

    companion object {
        private const val TAG = "IncomingSmsReceiver"
        private const val WAKE_LOCK_TIMEOUT_MS = 60_000L  // 60-second timeout as safety net
        private const val OPERATION_TIMEOUT_MS = 55_000L  // stay within the wake lock window

        fun epochMillisToIso8601(millis: Long): String {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            return sdf.format(Date(millis))
        }

        private fun triggerImmediateSync(context: Context) {
            WorkManager.getInstance(context).enqueue(
                OneTimeWorkRequestBuilder<ReceivedSmsSyncWorker>().build()
            )
        }

        private fun updateCaptureNotification(context: Context, text: String) {
            val notification = NotificationCompat.Builder(context, ReceivedSmsCaptureService.CHANNEL_ID)
                .setContentTitle("SMSPaisa")
                .setContentText(text)
                .setSmallIcon(R.drawable.ic_notification)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(ReceivedSmsCaptureService.NOTIFICATION_ID, notification)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        updateCaptureNotification(context, "SMS received! Checking auth...")

        val token = try {
            kotlinx.coroutines.runBlocking { userPreferences.authToken.first() }
        } catch (e: Exception) { null }

        if (token.isNullOrEmpty()) {
            Log.d(TAG, "No auth token, skipping SMS report")
            updateCaptureNotification(context, "❌ No auth token! Login required")
            return
        }

        val messages: Array<SmsMessage> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            Telephony.Sms.Intents.getMessagesFromIntent(intent)
        } else {
            @Suppress("DEPRECATION")
            val pdus = intent.extras?.get("pdus") as? Array<*>
            pdus?.mapNotNull {
                @Suppress("DEPRECATION")
                SmsMessage.createFromPdu(it as ByteArray)
            }?.toTypedArray() ?: emptyArray()
        }

        if (messages.isEmpty()) return

        // Build full message body (may be split into multiple PDUs)
        val sender = messages[0].displayOriginatingAddress ?: messages[0].originatingAddress ?: "Unknown"
        val body = messages.joinToString("") { it.messageBody ?: "" }
        val timestamp = messages[0].timestampMillis
        val receivedAtIso = epochMillisToIso8601(timestamp)

        // Detect SIM slot from subscription ID (0 = SIM1, 1 = SIM2).
        // For devices with more than 2 SIMs, map to slot 0 or 1 via modulo.
        val simSlot: Int = try {
            val subscriptionId = intent.getIntExtra("android.telephony.extra.SUBSCRIPTION_INDEX", -1)
                .takeIf { it >= 0 }
                ?: intent.getIntExtra("subscription", -1)
                    .takeIf { it >= 0 }
                ?: 0
            if (subscriptionId <= 1) subscriptionId else subscriptionId % 2
        } catch (e: Exception) { 0 }

        Log.d(TAG, "Received SMS from $sender on SIM slot $simSlot: ${body.take(50)}")
        updateCaptureNotification(context, "SMS from $sender. Sending to server...")

        // Acquire a partial WakeLock to prevent the CPU from sleeping before we finish reporting
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "SMSPaisa:IncomingSmsReceiver"
        ).apply { acquire(WAKE_LOCK_TIMEOUT_MS) }

        // Use goAsync() to extend the BroadcastReceiver's lifetime beyond the 10-second window
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                withTimeout(OPERATION_TIMEOUT_MS) { // stay within the wake lock window
                    val deviceId = try {
                        deviceRepository.getDeviceId()
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to get deviceId", e)
                        updateCaptureNotification(context, "❌ Failed to get deviceId: ${e.message?.take(60) ?: "Unknown error"}")
                        return@withTimeout
                    }
                    try {
                        updateCaptureNotification(context, "Reporting SMS from $sender to server...")
                        val request = ReportReceivedSmsRequest(
                            deviceId = deviceId,
                            sender = sender,
                            message = body,
                            simSlot = simSlot,
                            receivedAt = receivedAtIso
                        )
                        val response = apiService.reportReceivedSms(request)
                        if (response.isSuccessful) {
                            Log.d(TAG, "Successfully reported received SMS to server")
                            updateCaptureNotification(context, "✅ SMS from $sender reported! Waiting...")
                        } else {
                            val errMsg = response.message().take(60)
                            Log.w(TAG, "Failed to report received SMS: ${response.code()}, queuing for retry")
                            updateCaptureNotification(context, "❌ Server error ${response.code()}: $errMsg. Queued")
                            pendingReceivedSmsDao.insert(
                                PendingReceivedSmsEntity(
                                    deviceId = deviceId,
                                    sender = sender,
                                    message = body,
                                    simSlot = simSlot,
                                    receivedAt = receivedAtIso
                                )
                            )
                            triggerImmediateSync(context)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error reporting received SMS, queuing for retry", e)
                        updateCaptureNotification(context, "❌ Network error: ${e.message?.take(60) ?: "Unknown error"}. Queued")
                        try {
                            pendingReceivedSmsDao.insert(
                                PendingReceivedSmsEntity(
                                    deviceId = deviceId,
                                    sender = sender,
                                    message = body,
                                    simSlot = simSlot,
                                    receivedAt = receivedAtIso
                                )
                            )
                            triggerImmediateSync(context)
                        } catch (dbErr: Exception) {
                            Log.e(TAG, "Failed to queue SMS in local DB", dbErr)
                            updateCaptureNotification(context, "❌ DB error: ${dbErr.message?.take(60) ?: "Unknown error"}")
                        }
                    }
                }
            } finally {
                if (wakeLock.isHeld) wakeLock.release()
                pendingResult.finish()
            }
        }
    }
}

