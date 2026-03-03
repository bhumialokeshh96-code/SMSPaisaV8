package com.smspaisa.app.service

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.smspaisa.app.data.repository.SmsRepository
import com.smspaisa.app.model.SmsStatus
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SmsSentReceiver : BroadcastReceiver() {

    @Inject lateinit var smsRepository: SmsRepository

    companion object {
        const val ACTION_SMS_SENT = "com.smspaisa.app.SMS_SENT"
        private const val TAG = "SmsSentReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra("taskId") ?: return
        val status = when (resultCode) {
            Activity.RESULT_OK -> SmsStatus.SENT
            else -> SmsStatus.FAILED
        }

        Log.d(TAG, "SMS sent result for $taskId: $status (resultCode: $resultCode)")

        CoroutineScope(Dispatchers.IO).launch {
            smsRepository.updateLocalLogStatus(taskId, status)
            // NOTE: reportStatus is now handled in batch after round complete
            // SmsSentReceiver only updates local DB status
        }
    }
}
