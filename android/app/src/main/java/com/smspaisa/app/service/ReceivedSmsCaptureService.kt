package com.smspaisa.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.smspaisa.app.R
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.ReportReceivedSmsRequest
import com.smspaisa.app.data.local.PendingReceivedSmsDao
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import javax.inject.Inject

@AndroidEntryPoint
class ReceivedSmsCaptureService : Service() {

    @Inject lateinit var apiService: ApiService
    @Inject lateinit var pendingReceivedSmsDao: PendingReceivedSmsDao

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        const val CHANNEL_ID = "received_sms_channel"
        const val NOTIFICATION_ID = 2001
        private const val TAG = "ReceivedSmsCaptureService"
        private const val SYNC_INTERVAL_MS = 30_000L
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                buildNotification(),
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, buildNotification())
        }
        serviceScope.launch { syncLoop() }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    private suspend fun syncLoop() {
        while (true) {
            delay(SYNC_INTERVAL_MS)
            try {
                pendingReceivedSmsDao.purgeStale()
                val batch = pendingReceivedSmsDao.getBatch()
                if (batch.isEmpty()) continue

                for (pending in batch) {
                    try {
                        val request = ReportReceivedSmsRequest(
                            deviceId = pending.deviceId,
                            sender = pending.sender,
                            message = pending.message,
                            simSlot = pending.simSlot,
                            receivedAt = pending.receivedAt
                        )
                        val response = apiService.reportReceivedSms(request)
                        if (response.isSuccessful) {
                            Log.d(TAG, "Synced pending received SMS id=${pending.id}")
                            pendingReceivedSmsDao.delete(pending)
                        } else {
                            Log.w(TAG, "Server rejected pending SMS id=${pending.id}: ${response.code()}")
                            pendingReceivedSmsDao.incrementRetryCount(pending.id)
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to sync pending received SMS id=${pending.id}", e)
                        pendingReceivedSmsDao.incrementRetryCount(pending.id)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error during pending received SMS sync", e)
            }
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Received SMS Capture Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Background received SMS capture service"
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
        }
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val openAppIntent = PendingIntent.getActivity(
            this, 0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SMSPaisa")
            .setContentText("Task Fetching...")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(openAppIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
