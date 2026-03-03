package com.smspaisa.app.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface SmsLogDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(smsLog: SmsLogEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(smsLogs: List<SmsLogEntity>)

    @Query("SELECT * FROM sms_logs ORDER BY timestamp DESC")
    fun getAllLogs(): Flow<List<SmsLogEntity>>

    @Query("SELECT * FROM sms_logs ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    suspend fun getLogsPaged(limit: Int, offset: Int): List<SmsLogEntity>

    @Query("SELECT * FROM sms_logs WHERE status = :status ORDER BY timestamp DESC")
    fun getLogsByStatus(status: String): Flow<List<SmsLogEntity>>

    @Query("SELECT * FROM sms_logs WHERE timestamp >= :startTime ORDER BY timestamp DESC")
    suspend fun getLogsAfter(startTime: Long): List<SmsLogEntity>

    @Update
    suspend fun update(smsLog: SmsLogEntity)

    @Query("UPDATE sms_logs SET status = :status WHERE taskId = :taskId")
    suspend fun updateStatus(taskId: String, status: String)

    @Query("DELETE FROM sms_logs WHERE timestamp < :olderThan")
    suspend fun deleteOlderThan(olderThan: Long)

    @Query("SELECT COUNT(*) FROM sms_logs WHERE status = 'SENT' AND timestamp >= :startOfDay")
    suspend fun getSentCountToday(startOfDay: Long): Int

    @Query("SELECT status FROM sms_logs WHERE taskId = :taskId LIMIT 1")
    suspend fun getStatusByTaskId(taskId: String): String?
}
