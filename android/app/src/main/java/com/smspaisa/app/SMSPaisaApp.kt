package com.smspaisa.app

import android.app.Application
import android.content.Intent
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.smspaisa.app.data.datastore.UserPreferences
import com.smspaisa.app.service.ReceivedSmsCaptureService
import com.smspaisa.app.service.ReceivedSmsSyncWorker
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit
import javax.inject.Inject

@HiltAndroidApp
class SMSPaisaApp : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var userPreferences: UserPreferences

    private val appScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        scheduleReceivedSmsSyncWorker()
        startReceivedSmsCaptureServiceIfLoggedIn()
    }

    private fun scheduleReceivedSmsSyncWorker() {
        val syncRequest = PeriodicWorkRequestBuilder<ReceivedSmsSyncWorker>(5, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "received_sms_sync",
            ExistingPeriodicWorkPolicy.REPLACE,
            syncRequest
        )
    }

    private fun startReceivedSmsCaptureServiceIfLoggedIn() {
        appScope.launch {
            val token = userPreferences.authToken.first()
            if (!token.isNullOrEmpty()) {
                startForegroundService(Intent(this@SMSPaisaApp, ReceivedSmsCaptureService::class.java))
            }
        }
    }
}
