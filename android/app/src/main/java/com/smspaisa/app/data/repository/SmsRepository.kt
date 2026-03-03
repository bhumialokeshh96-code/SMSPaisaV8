package com.smspaisa.app.data.repository

import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.BatchTasksResponse
import com.smspaisa.app.data.api.ReportStatusRequest
import com.smspaisa.app.data.local.SmsLogDao
import com.smspaisa.app.data.local.SmsLogEntity
import com.smspaisa.app.model.SmsLog
import com.smspaisa.app.model.SmsStatus
import com.smspaisa.app.model.SmsTask
import com.smspaisa.app.model.TodayStats
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SmsRepository @Inject constructor(
    private val apiService: ApiService,
    private val smsLogDao: SmsLogDao
) {
    val allSmsLogs: Flow<List<SmsLog>> = smsLogDao.getAllLogs().map { entities ->
        entities.map { it.toSmsLog() }
    }

    suspend fun getNextTask(): Result<SmsTask?> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getNextTask()
            if (response.isSuccessful) {
                Result.success(response.body()?.data)
            } else {
                Result.failure(Exception("Failed to get next task"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getBatchTasks(deviceId: String): Result<BatchTasksResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getBatchTasks(deviceId)
            val body = response.body()
            if (response.isSuccessful && body?.success == true && body.data != null) {
                Result.success(body.data)
            } else {
                Result.failure(Exception(body?.error?.message ?: "Failed to get batch tasks"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun reportStatus(taskId: String, status: String, deviceId: String, errorMessage: String? = null): Result<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response = apiService.reportStatus(ReportStatusRequest(taskId, status, deviceId, errorMessage))
                if (response.isSuccessful) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("Failed to report status"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun getTodayStats(): Result<TodayStats> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getTodayStats()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception("Failed to get today's stats"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getSmsLog(page: Int = 1, limit: Int = 20): Result<List<SmsLog>> =
        withContext(Dispatchers.IO) {
            try {
                val response = apiService.getSmsLog(page, limit)
                if (response.isSuccessful && response.body()?.success == true) {
                    val logs = response.body()!!.data!!
                    // Cache locally
                    smsLogDao.insertAll(logs.map { it.toEntity() })
                    Result.success(logs)
                } else {
                    Result.failure(Exception("Failed to get SMS log"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun insertLocalLog(
        taskId: String,
        recipient: String,
        message: String,
        status: SmsStatus,
        amount: Double = 0.0
    ) {
        val entity = SmsLogEntity(
            id = UUID.randomUUID().toString(),
            taskId = taskId,
            recipient = recipient,
            message = message,
            status = status.name,
            amount = amount,
            timestamp = System.currentTimeMillis()
        )
        smsLogDao.insert(entity)
    }

    suspend fun updateLocalLogStatus(taskId: String, status: SmsStatus) {
        smsLogDao.updateStatus(taskId, status.name)
    }

    suspend fun getLocalLogStatus(taskId: String): SmsStatus? {
        val statusStr = smsLogDao.getStatusByTaskId(taskId) ?: return null
        return try {
            SmsStatus.valueOf(statusStr)
        } catch (e: IllegalArgumentException) {
            null
        }
    }

    private fun SmsLogEntity.toSmsLog() = SmsLog(
        id = id,
        taskId = taskId,
        recipient = recipient,
        message = message,
        status = SmsStatus.valueOf(status),
        amount = amount,
        timestamp = timestamp
    )

    private fun SmsLog.toEntity() = SmsLogEntity(
        id = id,
        taskId = taskId,
        recipient = recipient,
        message = message,
        status = status.name,
        amount = amount,
        timestamp = timestamp
    )
}
