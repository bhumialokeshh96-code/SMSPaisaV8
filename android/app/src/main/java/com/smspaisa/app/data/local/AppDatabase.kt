package com.smspaisa.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [SmsLogEntity::class, PendingReceivedSmsEntity::class],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun smsLogDao(): SmsLogDao
    abstract fun pendingReceivedSmsDao(): PendingReceivedSmsDao
}
