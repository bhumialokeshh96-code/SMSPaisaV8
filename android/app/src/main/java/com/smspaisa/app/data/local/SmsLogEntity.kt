package com.smspaisa.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sms_logs")
data class SmsLogEntity(
    @PrimaryKey val id: String,
    val taskId: String,
    val recipient: String,
    val message: String,
    val status: String,
    val amount: Double,
    val timestamp: Long
)
