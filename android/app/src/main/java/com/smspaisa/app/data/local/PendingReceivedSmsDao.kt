package com.smspaisa.app.data.local

import androidx.room.*

@Dao
interface PendingReceivedSmsDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: PendingReceivedSmsEntity): Long

    @Query("DELETE FROM pending_received_sms WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("SELECT * FROM pending_received_sms ORDER BY id ASC LIMIT 20")
    suspend fun getBatch(): List<PendingReceivedSmsEntity>

    @Delete
    suspend fun delete(entity: PendingReceivedSmsEntity)

    @Query("UPDATE pending_received_sms SET retryCount = retryCount + 1 WHERE id = :id")
    suspend fun incrementRetryCount(id: Long)

    @Query("DELETE FROM pending_received_sms WHERE retryCount >= 10")
    suspend fun purgeStale()
}
