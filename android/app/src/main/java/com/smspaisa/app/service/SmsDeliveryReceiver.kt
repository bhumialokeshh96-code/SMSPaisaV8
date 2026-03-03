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
class SmsDeliveryReceiver : BroadcastReceiver() {

    @Inject lateinit var smsRepository: SmsRepository

    companion object {
        const val ACTION_SMS_DELIVERED = "com.smspaisa.app.SMS_DELIVERED"
        private const val TAG = "SmsDeliveryReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra("taskId") ?: return
        val status = when (resultCode) {
            Activity.RESULT_OK -> SmsStatus.DELIVERED
            else -> SmsStatus.FAILED
        }

        Log.d(TAG, "SMS delivery result for $taskId: $status (resultCode: $resultCode)")

        CoroutineScope(Dispatchers.IO).launch {
            smsRepository.updateLocalLogStatus(taskId, status)
            // NOTE: reportStatus is handled in batch after round complete
            // SmsDeliveryReceiver only updates local DB status
        }
    }
}
