package com.smspaisa.app.service

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.ReportReceivedSmsRequest
import com.smspaisa.app.data.local.PendingReceivedSmsDao
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class ReceivedSmsSyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val apiService: ApiService,
    private val pendingReceivedSmsDao: PendingReceivedSmsDao
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "ReceivedSmsSyncWorker"
    }

    override suspend fun doWork(): Result {
        try {
            pendingReceivedSmsDao.purgeStale()
            val batch = pendingReceivedSmsDao.getBatch()
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
        return Result.success()
    }
}
