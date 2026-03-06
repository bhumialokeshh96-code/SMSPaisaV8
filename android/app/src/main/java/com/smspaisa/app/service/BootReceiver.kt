package com.smspaisa.app.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.smspaisa.app.data.datastore.UserPreferences
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.util.concurrent.TimeUnit
import javax.inject.Inject

@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject lateinit var userPreferences: UserPreferences

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            Log.d(TAG, "Boot completed, checking if service should restart")
            val serviceEnabled = runBlocking { userPreferences.serviceEnabled.first() }
            val token = runBlocking { userPreferences.authToken.first() }

            if (serviceEnabled && !token.isNullOrEmpty()) {
                Log.d(TAG, "Restarting SmsSenderService after boot")
                val serviceIntent = Intent(context, SmsSenderService::class.java)
                context.startForegroundService(serviceIntent)
            }

            // Always start the received SMS capture service after boot if user is logged in
            if (!token.isNullOrEmpty()) {
                Log.d(TAG, "Starting ReceivedSmsCaptureService after boot")
                val captureIntent = Intent(context, ReceivedSmsCaptureService::class.java)
                context.startForegroundService(captureIntent)
            }

            // Always schedule the periodic received SMS sync worker after boot,
            // so sync resumes even if the user never opens the app.
            val syncRequest = PeriodicWorkRequestBuilder<ReceivedSmsSyncWorker>(5, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "received_sms_sync",
                ExistingPeriodicWorkPolicy.REPLACE,
                syncRequest
            )
        }
    }
}
