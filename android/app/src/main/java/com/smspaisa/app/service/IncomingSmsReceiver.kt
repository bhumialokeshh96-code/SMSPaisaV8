package com.smspaisa.app.service

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
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

        fun epochMillisToIso8601(millis: Long): String {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            return sdf.format(Date(millis))
        }

        private fun triggerImmediateSync(context: Context) {
            try {
                WorkManager.getInstance(context).enqueue(
                    OneTimeWorkRequestBuilder<ReceivedSmsSyncWorker>().build()
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to trigger immediate sync", e)
            }
        }

        fun updateCaptureNotification(context: Context, text: String) {
            Log.d(TAG, "Notification: $text")
            val runnable = Runnable {
                try {
                    val notification = NotificationCompat.Builder(context, ReceivedSmsCaptureService.CHANNEL_ID)
                        .setContentTitle("SMSPaisa")
                        .setContentText(text)
                        .setSmallIcon(R.drawable.ic_notification)
                        .setOngoing(true)
                        .setPriority(NotificationCompat.PRIORITY_LOW)
                        .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                        .build()
                    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    nm.notify(ReceivedSmsCaptureService.NOTIFICATION_ID, notification)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to update notification", e)
                }
            }
            if (Looper.myLooper() == Looper.getMainLooper()) {
                runnable.run()
            } else {
                Handler(Looper.getMainLooper()).post(runnable)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            updateCaptureNotification(context, "Receiver fired but action=${intent.action}")
            return
        }

        updateCaptureNotification(context, "SMS received! Checking auth...")

        val token = try {
            kotlinx.coroutines.runBlocking { userPreferences.authToken.first() }
        } catch (e: Exception) {
            updateCaptureNotification(context, "❌ Auth error: ${e.message?.take(60)}")
            null
        }

        if (token.isNullOrEmpty()) {
            Log.d(TAG, "No auth token, skipping SMS report")
            updateCaptureNotification(context, "❌ No auth token! Login required")
            return
        }

        updateCaptureNotification(context, "Auth OK ✓ Parsing SMS...")

        val messages: Array<SmsMessage> = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                Telephony.Sms.Intents.getMessagesFromIntent(intent)
            } else {
                @Suppress("DEPRECATION")
                val pdus = intent.extras?.get("pdus") as? Array<*>
                pdus?.mapNotNull {
                    @Suppress("DEPRECATION")
                    SmsMessage.createFromPdu(it as ByteArray)
                }?.toTypedArray() ?: emptyArray()
            }
        } catch (e: Exception) {
            updateCaptureNotification(context, "❌ Parse error: ${e.message?.take(60)}")
            return
        }

        if (messages.isEmpty()) {
            updateCaptureNotification(context, "❌ No messages in intent")
            return
        }

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
        updateCaptureNotification(context, "SMS from $sender parsed ✓ Getting deviceId...")

        // Use goAsync() to extend the BroadcastReceiver's lifetime beyond the 10-second window
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            val deviceId = try {
                deviceRepository.getDeviceId()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get deviceId", e)
                updateCaptureNotification(context, "❌ No deviceId: ${e.message?.take(60)}")
                pendingResult.finish()
                return@launch
            }

            updateCaptureNotification(context, "DeviceId=$deviceId ✓ Sending to server...")

            try {
                val request = ReportReceivedSmsRequest(
                    deviceId = deviceId,
                    sender = sender,
                    message = body,
                    simSlot = simSlot,
                    receivedAt = receivedAtIso
                )
                updateCaptureNotification(context, "POST /api/sms/received from $sender...")
                val response = apiService.reportReceivedSms(request)
                if (response.isSuccessful) {
                    Log.d(TAG, "Successfully reported received SMS to server")
                    updateCaptureNotification(context, "✅ SMS from $sender reported! Waiting...")
                } else {
                    val code = response.code()
                    val errBody = try { response.errorBody()?.string()?.take(80) ?: response.message() } catch(e: Exception) { response.message() }
                    Log.w(TAG, "Failed to report received SMS: $code")
                    updateCaptureNotification(context, "❌ Server $code: $errBody. Queued")
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
                Log.e(TAG, "Error reporting received SMS", e)
                updateCaptureNotification(context, "❌ ${e.javaClass.simpleName}: ${e.message?.take(50)}. Queued")
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
                    updateCaptureNotification(context, "❌ DB save failed: ${dbErr.message?.take(50)}")
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}

