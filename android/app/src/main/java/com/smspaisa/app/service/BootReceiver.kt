package com.smspaisa.app.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.smspaisa.app.data.datastore.UserPreferences
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
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
        }
    }
}
