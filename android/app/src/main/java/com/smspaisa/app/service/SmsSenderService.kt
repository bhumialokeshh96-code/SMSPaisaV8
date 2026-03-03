package com.smspaisa.app.service

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.telephony.SmsManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.smspaisa.app.R
import com.smspaisa.app.data.api.WebSocketManager
import com.smspaisa.app.data.datastore.UserPreferences
import com.smspaisa.app.data.repository.DeviceRepository
import com.smspaisa.app.data.repository.SmsRepository
import com.smspaisa.app.model.SendingProgress
import com.smspaisa.app.model.SendingStatus
import com.smspaisa.app.utils.toUserMessage
import com.smspaisa.app.model.SmsStatus
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import java.util.Calendar
import java.util.concurrent.atomic.AtomicInteger
import javax.inject.Inject

@AndroidEntryPoint
class SmsSenderService : Service() {

    @Inject lateinit var webSocketManager: WebSocketManager
    @Inject lateinit var userPreferences: UserPreferences
    @Inject lateinit var smsRepository: SmsRepository
    @Inject lateinit var deviceRepository: DeviceRepository
    @Inject lateinit var sendingProgressManager: SendingProgressManager

    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private val sentTodayCount = AtomicInteger(0)
    private var lastResetDate: Int = Calendar.getInstance().get(Calendar.DAY_OF_YEAR)
    private var lastResetYear: Int = Calendar.getInstance().get(Calendar.YEAR)

    companion object {
        const val CHANNEL_ID = "sms_sender_channel"
        const val NOTIFICATION_ID = 1001
        const val TAG = "SmsSenderService"
        private const val SMS_DELAY_MIN_MILLIS = 3000L
        private const val SMS_DELAY_MAX_MILLIS = 5000L
        private const val MIN_PHONE_NUMBER_DIGITS = 5
        private const val EARNINGS_PER_SMS = 0.16
        private const val MAX_REPORT_RETRIES = 3
        private const val RETRY_DELAY_BASE_MS = 1000L
        private const val ROUND_SUMMARY_DISPLAY_DURATION_MS = 5_000L
        // Time to wait for SmsSentReceiver PendingIntent callbacks after handing SMS to modem.
        // Typical carrier ACK arrives within 1-3 seconds; 7 seconds provides a generous buffer
        // for slow networks while not blocking the next round too long.
        private const val VERIFICATION_WAIT_MS = 7_000L
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                buildNotification("SMSPaisa running..."),
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, buildNotification("SMSPaisa running..."))
        }
        serviceScope.launch { startWorking() }
        serviceScope.launch { startBatchPolling() }
        serviceScope.launch { startHeartbeat() }
        serviceScope.launch { observeTaskCancelled() }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        serviceScope.cancel()
        webSocketManager.disconnect()
        sendingProgressManager.reset()
        super.onDestroy()
    }

    private suspend fun startWorking() {
        val token = userPreferences.authToken.first()
        if (token.isNullOrEmpty()) {
            stopSelf()
            return
        }

        webSocketManager.connect(token)

        // Listen for tasks from WebSocket
        webSocketManager.newTask.collect { task ->
            task ?: return@collect

            resetCountIfNewDay()

            if (!shouldSendSms()) {
                val reason = getSendBlockedReason()
                sendingProgressManager.updateProgress(
                    SendingProgress(status = SendingStatus.WAITING, errorMessage = reason)
                )
                webSocketManager.emitTaskResult(task.taskId, "SKIPPED")
                webSocketManager.clearNewTask()
                return@collect
            }

            val dailyLimit = userPreferences.dailySmsLimit.first()
            if (sentTodayCount.get() >= dailyLimit) {
                updateNotification("Daily limit reached (${sentTodayCount.get()}/$dailyLimit)")
                webSocketManager.emitTaskResult(task.taskId, "SKIPPED")
                webSocketManager.clearNewTask()
                return@collect
            }

            // Validate recipient phone number
            val recipientTrimmed = task.recipient.trim()
            if (recipientTrimmed.isBlank() || recipientTrimmed.filter { it.isDigit() }.length < MIN_PHONE_NUMBER_DIGITS) {
                Log.w(TAG, "Invalid recipient phone number for task: ${task.taskId}")
                webSocketManager.emitTaskResult(task.taskId, "FAILED", "Invalid recipient phone number")
                webSocketManager.clearNewTask()
                return@collect
            }

            // Validate message content
            if (task.message.isBlank()) {
                Log.w(TAG, "Empty message content for task: ${task.taskId}")
                webSocketManager.emitTaskResult(task.taskId, "FAILED", "Empty message content")
                webSocketManager.clearNewTask()
                return@collect
            }

            // Verify SEND_SMS permission before attempting to send
            if (ContextCompat.checkSelfPermission(this@SmsSenderService, Manifest.permission.SEND_SMS)
                != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "SEND_SMS permission not granted, cannot send SMS")
                webSocketManager.emitTaskResult(task.taskId, "FAILED", "SEND_SMS permission not granted")
                webSocketManager.clearNewTask()
                return@collect
            }

            // Rate limiting
            delay((SMS_DELAY_MIN_MILLIS..SMS_DELAY_MAX_MILLIS).random())

            try {
                val smsManager = getSmsManager()
                val pendingIntentSent = PendingIntent.getBroadcast(
                    this@SmsSenderService,
                    task.taskId.hashCode(),
                    Intent(SmsSentReceiver.ACTION_SMS_SENT).apply {
                        putExtra("taskId", task.taskId)
                        `package` = packageName
                    },
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val pendingIntentDelivered = PendingIntent.getBroadcast(
                    this@SmsSenderService,
                    task.taskId.hashCode() + 1,
                    Intent(SmsDeliveryReceiver.ACTION_SMS_DELIVERED).apply {
                        putExtra("taskId", task.taskId)
                        `package` = packageName
                    },
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                smsRepository.insertLocalLog(
                    taskId = task.taskId,
                    recipient = task.recipient,
                    message = task.message,
                    status = SmsStatus.PENDING
                )

                val parts = smsManager.divideMessage(task.message)
                if (parts.size == 1) {
                    smsManager.sendTextMessage(
                        task.recipient, null, task.message,
                        pendingIntentSent, pendingIntentDelivered
                    )
                } else {
                    val sentList = ArrayList(parts.mapIndexed { partIndex, _ ->
                        PendingIntent.getBroadcast(
                            this@SmsSenderService,
                            task.taskId.hashCode() + (partIndex * 2),
                            Intent(SmsSentReceiver.ACTION_SMS_SENT).apply {
                                putExtra("taskId", task.taskId)
                                `package` = packageName
                            },
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                        )
                    })
                    val deliveredList = ArrayList(parts.mapIndexed { partIndex, _ ->
                        PendingIntent.getBroadcast(
                            this@SmsSenderService,
                            task.taskId.hashCode() + (partIndex * 2) + 1,
                            Intent(SmsDeliveryReceiver.ACTION_SMS_DELIVERED).apply {
                                putExtra("taskId", task.taskId)
                                `package` = packageName
                            },
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                        )
                    })
                    smsManager.sendMultipartTextMessage(
                        task.recipient, null, parts, sentList, deliveredList
                    )
                }

                try {
                    smsRepository.reportStatus(task.taskId, "SENT", deviceRepository.getDeviceId())
                    webSocketManager.emitTaskResult(task.taskId, "SENT")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to report SENT status for WebSocket task ${task.taskId}", e)
                }
                sentTodayCount.incrementAndGet()
                updateNotification("Sent ${sentTodayCount.get()} SMS today")
                webSocketManager.clearNewTask()

            } catch (e: Exception) {
                Log.e(TAG, "Failed to send SMS", e)
                smsRepository.updateLocalLogStatus(task.taskId, SmsStatus.FAILED)
                smsRepository.reportStatus(task.taskId, "FAILED", deviceRepository.getDeviceId(), e.message)
                webSocketManager.emitTaskResult(task.taskId, "FAILED", e.message)
                webSocketManager.clearNewTask()
            }
        }
    }

    private suspend fun observeTaskCancelled() {
        webSocketManager.taskCancelled.collect { cancelledTaskId ->
            cancelledTaskId ?: return@collect
            Log.d(TAG, "Task cancelled by server: $cancelledTaskId")
            smsRepository.updateLocalLogStatus(cancelledTaskId, SmsStatus.FAILED)
        }
    }

    private suspend fun startBatchPolling() {
        val deviceId = deviceRepository.getDeviceId()
        // Initialize today's sent count from server on startup
        try {
            val stats = smsRepository.getTodayStats()
            if (stats.isSuccess) {
                sentTodayCount.set(stats.getOrThrow().sent)
            }
        } catch (_: Exception) {}
        while (true) {
            resetCountIfNewDay()
            if (!shouldSendSms()) {
                val reason = getSendBlockedReason()
                sendingProgressManager.updateProgress(
                    SendingProgress(status = SendingStatus.WAITING, errorMessage = reason)
                )
                delay(10_000)
                continue
            }

            sendingProgressManager.updateProgress(SendingProgress(status = SendingStatus.FETCHING))

            val result = smsRepository.getBatchTasks(deviceId)
            if (result.isFailure) {
                sendingProgressManager.updateProgress(
                    SendingProgress(
                        status = SendingStatus.ERROR,
                        errorMessage = result.exceptionOrNull()?.toUserMessage() ?: "Something went wrong. Please try again."
                    )
                )
                withTimeoutOrNull(10_000) {
                    sendingProgressManager.retryTrigger.first()
                }
                continue
            }

            val batchResponse = result.getOrThrow()
            val tasks = batchResponse.tasks
            val roundLimit = batchResponse.roundLimit

            if (tasks.isEmpty()) {
                sendingProgressManager.updateProgress(
                    SendingProgress(status = SendingStatus.WAITING, roundLimit = roundLimit)
                )
                delay(10_000)
                continue
            }

            val dailyLimit = userPreferences.dailySmsLimit.first()
            sendingProgressManager.updateProgress(
                SendingProgress(
                    status = SendingStatus.SENDING,
                    totalInRound = tasks.size,
                    sentInRound = 0,
                    roundLimit = roundLimit
                )
            )

            // Track results locally during the round
            val pendingTaskIds = mutableListOf<String>()  // Tasks sent to modem, awaiting SmsSentReceiver
            val failedTaskIds = mutableListOf<Pair<String, String?>>() // Tasks that failed immediately

            for ((index, task) in tasks.withIndex()) {
                if (sentTodayCount.get() >= dailyLimit) {
                    updateNotification("Daily limit reached (${sentTodayCount.get()}/$dailyLimit)")
                    break
                }

                // Bug #5: Skip already-sent tasks (avoid duplicate SMS on retry)
                val existingStatus = smsRepository.getLocalLogStatus(task.id)
                if (existingStatus == SmsStatus.SENT || existingStatus == SmsStatus.DELIVERED) {
                    pendingTaskIds.add(task.id)
                    continue
                }

                sendingProgressManager.updateProgress(
                    SendingProgress(
                        status = SendingStatus.SENDING,
                        totalInRound = tasks.size,
                        sentInRound = index,
                        currentRecipient = SendingProgressManager.maskPhone(task.recipient),
                        currentMessagePreview = SendingProgressManager.maskMessage(task.message),
                        roundLimit = roundLimit
                    )
                )

                if (ContextCompat.checkSelfPermission(this@SmsSenderService, Manifest.permission.SEND_SMS)
                    != PackageManager.PERMISSION_GRANTED) {
                    failedTaskIds.add(task.id to "SEND_SMS permission not granted")
                    continue
                }

                delay((SMS_DELAY_MIN_MILLIS..SMS_DELAY_MAX_MILLIS).random())

                try {
                    val smsManager = getSmsManager()
                    val pendingIntentSent = PendingIntent.getBroadcast(
                        this@SmsSenderService,
                        task.id.hashCode(),
                        Intent(SmsSentReceiver.ACTION_SMS_SENT).apply {
                            putExtra("taskId", task.id)
                            `package` = packageName
                        },
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    val pendingIntentDelivered = PendingIntent.getBroadcast(
                        this@SmsSenderService,
                        task.id.hashCode() + 1,
                        Intent(SmsDeliveryReceiver.ACTION_SMS_DELIVERED).apply {
                            putExtra("taskId", task.id)
                            `package` = packageName
                        },
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )

                    smsRepository.insertLocalLog(
                        taskId = task.id,
                        recipient = task.recipient,
                        message = task.message,
                        status = SmsStatus.PENDING
                    )

                    val parts = smsManager.divideMessage(task.message)
                    if (parts.size == 1) {
                        smsManager.sendTextMessage(
                            task.recipient, null, task.message,
                            pendingIntentSent, pendingIntentDelivered
                        )
                    } else {
                        val sentList = ArrayList(parts.mapIndexed { partIndex, _ ->
                            PendingIntent.getBroadcast(
                                this@SmsSenderService,
                                task.id.hashCode() + (partIndex * 2),
                                Intent(SmsSentReceiver.ACTION_SMS_SENT).apply {
                                    putExtra("taskId", task.id)
                                    `package` = packageName
                                },
                                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                            )
                        })
                        val deliveredList = ArrayList(parts.mapIndexed { partIndex, _ ->
                            PendingIntent.getBroadcast(
                                this@SmsSenderService,
                                task.id.hashCode() + (partIndex * 2) + 1,
                                Intent(SmsDeliveryReceiver.ACTION_SMS_DELIVERED).apply {
                                    putExtra("taskId", task.id)
                                    `package` = packageName
                                },
                                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                            )
                        })
                        smsManager.sendMultipartTextMessage(
                            task.recipient, null, parts, sentList, deliveredList
                        )
                    }

                    // SMS handed off to SmsManager — wait for SmsSentReceiver to confirm
                    pendingTaskIds.add(task.id)
                    // Do NOT update local status to SENT here — SmsSentReceiver will do it
                    // Do NOT increment sentTodayCount here — wait for confirmation
                    updateNotification("Sending SMS... (${index + 1}/${tasks.size})")
                } catch (e: Exception) {
                    Log.e(TAG, "Batch: Failed to send SMS for task ${task.id}", e)
                    failedTaskIds.add(task.id to e.message)
                    smsRepository.updateLocalLogStatus(task.id, SmsStatus.FAILED)
                }
            }

            // === VERIFICATION PHASE: Wait for SmsSentReceiver callbacks ===
            sendingProgressManager.updateProgress(
                SendingProgress(
                    status = SendingStatus.VERIFYING,
                    totalInRound = pendingTaskIds.size + failedTaskIds.size,
                    sentInRound = 0,
                    roundLimit = roundLimit
                )
            )

            // Wait for SmsSentReceiver PendingIntent callbacks to update local DB
            delay(VERIFICATION_WAIT_MS)

            val confirmedSentIds = mutableListOf<String>()
            val confirmedFailedIds = mutableListOf<Pair<String, String?>>()

            for (taskId in pendingTaskIds) {
                val actualStatus = smsRepository.getLocalLogStatus(taskId)
                when (actualStatus) {
                    SmsStatus.SENT -> {
                        confirmedSentIds.add(taskId)
                        sentTodayCount.incrementAndGet()
                    }
                    SmsStatus.FAILED -> confirmedFailedIds.add(taskId to "SMS failed at carrier level")
                    else -> {
                        // Still PENDING after wait — SmsSentReceiver didn't fire
                        // Benefit of the doubt: modem accepted it
                        confirmedSentIds.add(taskId)
                        sentTodayCount.incrementAndGet()
                        Log.w(TAG, "Task $taskId still PENDING after verification wait, assuming SENT")
                    }
                }
            }
            confirmedFailedIds.addAll(failedTaskIds)

            // === BATCH REPORT PHASE ===
            sendingProgressManager.updateProgress(
                SendingProgress(
                    status = SendingStatus.REPORTING,
                    totalInRound = confirmedSentIds.size + confirmedFailedIds.size,
                    sentInRound = 0,
                    roundLimit = roundLimit
                )
            )

            var successfulReports = 0

            // Report SENT tasks to backend with retry
            for (taskId in confirmedSentIds) {
                var reported = false
                for (attempt in 1..MAX_REPORT_RETRIES) {
                    val reportResult = smsRepository.reportStatus(taskId, "SENT", deviceId)
                    if (reportResult.isSuccess) {
                        successfulReports++
                        reported = true
                        break
                    }
                    delay(RETRY_DELAY_BASE_MS * attempt)
                }
                if (!reported) {
                    Log.w(TAG, "Failed to report SENT status for task $taskId after $MAX_REPORT_RETRIES attempts")
                }
            }

            // Report FAILED tasks to backend with retry
            for ((taskId, errorMessage) in confirmedFailedIds) {
                for (attempt in 1..MAX_REPORT_RETRIES) {
                    val reportResult = smsRepository.reportStatus(taskId, "FAILED", deviceId, errorMessage)
                    if (reportResult.isSuccess) break
                    delay(RETRY_DELAY_BASE_MS * attempt)
                }
            }

            val roundEarnings = successfulReports * EARNINGS_PER_SMS

            // Show round summary
            sendingProgressManager.updateProgress(
                SendingProgress(
                    status = SendingStatus.ROUND_COMPLETE,
                    roundLimit = roundLimit,
                    roundSent = confirmedSentIds.size,
                    roundFailed = confirmedFailedIds.size,
                    roundEarnings = roundEarnings
                )
            )

            // Refresh today stats
            try {
                smsRepository.getTodayStats()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to refresh today stats after round", e)
            }

            // Wait for user to see the summary, then continue
            delay(ROUND_SUMMARY_DISPLAY_DURATION_MS)
            sendingProgressManager.updateProgress(SendingProgress(status = SendingStatus.WAITING))
        }
    }

    private suspend fun startHeartbeat() {
        while (true) {
            delay(30_000)
            try {
                val batteryLevel = getBatteryLevel()
                val isCharging = isCharging()
                val networkType = getNetworkType()
                deviceRepository.heartbeat(batteryLevel, isCharging, networkType)
                webSocketManager.emitHeartbeat(deviceRepository.getDeviceId())
            } catch (e: Exception) {
                Log.e(TAG, "Heartbeat failed", e)
            }
        }
    }

    private fun resetCountIfNewDay() {
        val cal = Calendar.getInstance()
        val today = cal.get(Calendar.DAY_OF_YEAR)
        val thisYear = cal.get(Calendar.YEAR)
        synchronized(this) {
            if (today != lastResetDate || thisYear != lastResetYear) {
                sentTodayCount.set(0)
                lastResetDate = today
                lastResetYear = thisYear
            }
        }
    }

    private suspend fun getSendBlockedReason(): String {
        if (!isNetworkAvailable()) return "No internet connection"
        val batteryLevel = getBatteryLevel()
        val stopAt = userPreferences.stopBatteryPercent.first()
        if (batteryLevel <= stopAt && !isCharging()) return "Battery too low ($batteryLevel%)"
        if (!isWithinActiveHours()) return "Outside active hours (8 AM – 10 PM)"
        return "Unknown"
    }

    private suspend fun shouldSendSms(): Boolean {
        if (!isNetworkAvailable()) return false
        val batteryLevel = getBatteryLevel()
        val stopAt = userPreferences.stopBatteryPercent.first()
        if (batteryLevel <= stopAt && !isCharging()) return false
        if (!isWithinActiveHours()) return false
        return true
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun getBatteryLevel(): Int {
        val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }

    private fun isCharging(): Boolean {
        val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        return bm.isCharging
    }

    private fun getNetworkType(): String {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return "none"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            else -> "other"
        }
    }

    private fun isWithinActiveHours(): Boolean {
        // Default active hours: 8 AM to 10 PM
        val now = Calendar.getInstance()
        val hour = now.get(Calendar.HOUR_OF_DAY)
        return hour in 8..22
    }

    @Suppress("DEPRECATION")
    private suspend fun getSmsManager(): SmsManager {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            val preferredSim = userPreferences.preferredSim.first()
            if (preferredSim > 0) {
                // Get SmsManager for the specific SIM subscription
                val subscriptionManager = getSystemService(android.telephony.SubscriptionManager::class.java)
                val subscriptions = try {
                    subscriptionManager?.activeSubscriptionInfoList
                } catch (e: SecurityException) {
                    Log.w(TAG, "Failed to get subscription info, falling back to default SmsManager", e)
                    null
                }
                val targetIndex = preferredSim - 1  // preferredSim: 1=SIM1, 2=SIM2
                val subId = subscriptions?.getOrNull(targetIndex)?.subscriptionId
                if (subId != null) {
                    applicationContext.getSystemService(SmsManager::class.java)
                        .createForSubscriptionId(subId)
                } else {
                    SmsManager.getDefault()
                }
            } else {
                SmsManager.getDefault()
            }
        } else {
            SmsManager.getDefault()
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "SMS Sender Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Background SMS sending service"
            setShowBadge(false)
        }
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(content: String): Notification {
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

    private fun updateNotification(content: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIFICATION_ID, buildNotification(content))
    }
}
