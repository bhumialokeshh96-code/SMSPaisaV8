package com.smspaisa.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_received_sms")
data class PendingReceivedSmsEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val deviceId: String,
    val sender: String,
    val message: String,
    val simSlot: Int,
    val receivedAt: String, // ISO 8601 string
    val retryCount: Int = 0
)
