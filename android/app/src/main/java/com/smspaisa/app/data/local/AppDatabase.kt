package com.smspaisa.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [SmsLogEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun smsLogDao(): SmsLogDao
}
