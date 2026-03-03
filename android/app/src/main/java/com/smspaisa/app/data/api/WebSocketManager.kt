package com.smspaisa.app.data.api

import android.util.Log
import com.smspaisa.app.BuildConfig
import com.smspaisa.app.model.SmsTask
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

enum class ConnectionState { DISCONNECTED, CONNECTING, CONNECTED }

@Singleton
class WebSocketManager @Inject constructor() {

    companion object {
        private const val TAG = "WebSocketManager"
        private const val CONNECTION_TIMEOUT_MS = 20_000L
    }

    private var socket: Socket? = null

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _newTask = MutableStateFlow<SmsTask?>(null)
    val newTask: StateFlow<SmsTask?> = _newTask.asStateFlow()

    private val _balanceUpdated = MutableStateFlow<Double?>(null)
    val balanceUpdated: StateFlow<Double?> = _balanceUpdated.asStateFlow()

    private val _taskCancelled = MutableStateFlow<String?>(null)
    val taskCancelled: StateFlow<String?> = _taskCancelled.asStateFlow()

    fun connect(token: String) {
        if (socket?.connected() == true) return

        _connectionState.value = ConnectionState.CONNECTING

        val options = IO.Options.builder()
            .setAuth(mapOf("token" to token))
            .setReconnection(true)
            .setReconnectionAttempts(Int.MAX_VALUE)
            .setReconnectionDelay(1000)
            .setTimeout(CONNECTION_TIMEOUT_MS)
            .setTransports(arrayOf("websocket"))
            .build()

        socket = IO.socket(BuildConfig.BASE_URL.trimEnd('/'), options).apply {
            on(Socket.EVENT_CONNECT) {
                _connectionState.value = ConnectionState.CONNECTED
            }
            on(Socket.EVENT_DISCONNECT) {
                _connectionState.value = ConnectionState.DISCONNECTED
            }
            on(Socket.EVENT_CONNECT_ERROR) {
                _connectionState.value = ConnectionState.DISCONNECTED
            }
            on("new-task") { args ->
                val data = args.firstOrNull() as? JSONObject ?: return@on
                val taskId = data.optString("taskId")
                val recipient = data.optString("recipient")
                val message = data.optString("message")
                if (taskId.isBlank() || recipient.isBlank() || message.isBlank()) {
                    Log.w(TAG, "Received new-task with missing required fields (taskId blank=${taskId.isBlank()}, recipient blank=${recipient.isBlank()}, message blank=${message.isBlank()})")
                    return@on
                }
                val task = SmsTask(
                    taskId = taskId,
                    recipient = recipient,
                    message = message,
                    priority = data.optInt("priority", 1)
                )
                _newTask.value = task
            }
            on("balance-updated") { args ->
                val data = args.firstOrNull() as? JSONObject ?: return@on
                _balanceUpdated.value = data.optDouble("balance")
            }
            on("task-cancelled") { args ->
                val data = args.firstOrNull() as? JSONObject ?: return@on
                _taskCancelled.value = data.optString("taskId")
            }
            connect()
        }
    }

    fun emitTaskResult(taskId: String, status: String, errorMessage: String? = null) {
        val data = JSONObject().apply {
            put("taskId", taskId)
            put("status", status)
            errorMessage?.let { put("errorMessage", it) }
        }
        socket?.emit("task-result", data)
    }

    fun emitDeviceStatus(deviceId: String, batteryLevel: Int, isCharging: Boolean) {
        val data = JSONObject().apply {
            put("deviceId", deviceId)
            put("batteryLevel", batteryLevel)
            put("isCharging", isCharging)
        }
        socket?.emit("device-status", data)
    }

    fun emitHeartbeat(deviceId: String) {
        val data = JSONObject().apply {
            put("deviceId", deviceId)
            put("timestamp", System.currentTimeMillis())
        }
        socket?.emit("heartbeat", data)
    }

    fun clearNewTask() {
        _newTask.value = null
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        _connectionState.value = ConnectionState.DISCONNECTED
    }
}
