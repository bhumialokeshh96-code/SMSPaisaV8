package com.smspaisa.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
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
    private var wakeLock: PowerManager.WakeLock? = null
    private var smsContentObserver: ContentObserver? = null

    companion object {
        const val CHANNEL_ID = "received_sms_channel"
        const val NOTIFICATION_ID = 2001
        private const val TAG = "ReceivedSmsCaptureService"
        private const val SYNC_INTERVAL_MS = 10_000L
        private const val WAKE_LOCK_TIMEOUT_MS = 10 * 60 * 1000L // 10 minutes safety net
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        // Acquire a partial WakeLock so the CPU never sleeps while service is running
        val pm = getSystemService(PowerManager::class.java)
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "SMSPaisa:ReceivedSmsCaptureService"
        ).apply { acquire(WAKE_LOCK_TIMEOUT_MS) }

        // Register a ContentObserver on the SMS inbox so we trigger an immediate sync
        // whenever a new SMS appears — even if the BroadcastReceiver missed it
        val handler = Handler(Looper.getMainLooper())
        smsContentObserver = object : ContentObserver(handler) {
            override fun onChange(selfChange: Boolean, uri: Uri?) {
                Log.d(TAG, "SMS inbox changed, triggering immediate sync")
                serviceScope.launch { performSync() }
            }
        }
        contentResolver.registerContentObserver(
            Uri.parse("content://sms/inbox"),
            true,
            smsContentObserver!!
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                buildNotification("Actively monitoring SMS..."),
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, buildNotification("Actively monitoring SMS..."))
        }
        serviceScope.launch { syncLoop() }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Restart service if user swipes app from recents
        try {
            val restartIntent = Intent(applicationContext, ReceivedSmsCaptureService::class.java)
            startForegroundService(restartIntent)
        } catch (e: Exception) {
            Log.w(TAG, "Could not restart service from onTaskRemoved, START_STICKY will handle it", e)
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        smsContentObserver?.let { contentResolver.unregisterContentObserver(it) }
        smsContentObserver = null
        serviceScope.cancel()
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        super.onDestroy()
    }

    private suspend fun syncLoop() {
        while (true) {
            performSync()
            delay(SYNC_INTERVAL_MS)
        }
    }

    private suspend fun performSync() {
        try {
            updateNotification("Actively monitoring SMS...")
            pendingReceivedSmsDao.purgeStale()
            val batch = pendingReceivedSmsDao.getBatch()
            if (batch.isEmpty()) {
                return
            }

            val total = batch.size
            updateNotification("Syncing $total pending SMS...")
            var successCount = 0
            var failCount = 0

            for ((index, pending) in batch.withIndex()) {
                val itemNum = index + 1
                updateNotification("Syncing SMS $itemNum/$total from ${pending.sender}...")
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
                        successCount++
                        updateNotification("Synced $itemNum/$total ✓")
                    } else {
                        val errMsg = response.message().take(60)
                        Log.w(TAG, "Server rejected pending SMS id=${pending.id}: ${response.code()}")
                        pendingReceivedSmsDao.incrementRetryCount(pending.id)
                        failCount++
                        updateNotification("Sync failed $itemNum/$total: ${response.code()} $errMsg")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to sync pending received SMS id=${pending.id}", e)
                    pendingReceivedSmsDao.incrementRetryCount(pending.id)
                    failCount++
                    updateNotification("Sync failed $itemNum/$total: Network error")
                }
            }

            updateNotification("Sync done: $successCount sent, $failCount failed. Monitoring...")
        } catch (e: Exception) {
            Log.e(TAG, "Error during pending received SMS sync", e)
            updateNotification("DB Error: ${e.message?.take(60) ?: "Unknown error"}")
        }
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIFICATION_ID, buildNotification(text))
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

    private fun buildNotification(content: String = "Actively monitoring SMS..."): Notification {
        val openAppIntent = PendingIntent.getActivity(
            this, 0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SMSPaisa")
            .setContentText(content)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(openAppIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
