package com.smspaisa.app.utils

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.widget.Toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.io.File

sealed class DownloadState {
    object Idle : DownloadState()
    object Starting : DownloadState()
    data class Downloading(val progress: Int) : DownloadState() // 0-100
    data class Done(val downloadId: Long) : DownloadState()     // store downloadId for install
    data class Error(val message: String) : DownloadState()
}

object ApkDownloadManager {

    fun downloadApk(context: Context, apkUrl: String, fileName: String = "SMSPaisa_update.apk"): Flow<DownloadState> = flow {
        emit(DownloadState.Starting)

        // Delete old APK if exists
        val apkFile = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName)
        if (apkFile.exists()) apkFile.delete()

        val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

        val request = DownloadManager.Request(Uri.parse(apkUrl))
            .setTitle("SMSPaisa Update")
            .setDescription("Downloading update...")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val downloadId = downloadManager.enqueue(request)

        // Poll progress
        while (true) {
            val query = DownloadManager.Query().setFilterById(downloadId)
            val cursor = downloadManager.query(query)

            if (cursor == null || !cursor.moveToFirst()) {
                emit(DownloadState.Error("Download failed"))
                cursor?.close()
                downloadManager.remove(downloadId)
                break
            }

            val statusCol = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
            val downloadedCol = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
            val totalCol = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)

            val status = if (statusCol >= 0) cursor.getInt(statusCol) else -1
            val downloaded = if (downloadedCol >= 0) cursor.getLong(downloadedCol) else 0L
            val total = if (totalCol >= 0) cursor.getLong(totalCol) else -1L

            cursor.close()

            when (status) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    // Pass the downloadId so we can get the URI from DownloadManager directly
                    emit(DownloadState.Done(downloadId))
                    break
                }
                DownloadManager.STATUS_FAILED -> {
                    downloadManager.remove(downloadId)
                    emit(DownloadState.Error("Download failed. Check your internet connection."))
                    break
                }
                DownloadManager.STATUS_RUNNING -> {
                    val progress = if (total > 0) ((downloaded * 100) / total).toInt() else 0
                    emit(DownloadState.Downloading(progress.coerceIn(0, 100)))
                }
                DownloadManager.STATUS_PENDING -> {
                    emit(DownloadState.Downloading(0))
                }
                DownloadManager.STATUS_PAUSED -> {
                    val progress = if (total > 0) ((downloaded * 100) / total).toInt() else 0
                    emit(DownloadState.Downloading(progress.coerceIn(0, 100)))
                }
            }
            delay(500) // poll every 500ms
        }
    }.flowOn(Dispatchers.IO)

    /**
     * Install the downloaded APK using DownloadManager's own content:// URI.
     * This completely bypasses FileProvider — no path registration needed.
     */
    fun installApk(context: Context, downloadId: Long) {
        try {
            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

            // DownloadManager gives us a content:// URI directly — no FileProvider needed!
            val apkUri = downloadManager.getUriForDownloadedFile(downloadId)

            if (apkUri == null) {
                Toast.makeText(context, "APK file not found. Please download again.", Toast.LENGTH_LONG).show()
                return
            }

            val installIntent = android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                        android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            context.startActivity(installIntent)

        } catch (e: android.content.ActivityNotFoundException) {
            Toast.makeText(context, "No app found to install APK.", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(context, "Install failed: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    fun canInstallUnknownApps(context: Context): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            @Suppress("DEPRECATION")
            android.provider.Settings.Secure.getInt(
                context.contentResolver,
                android.provider.Settings.Secure.INSTALL_NON_MARKET_APPS, 0
            ) == 1
        }
    }

    fun openInstallPermissionSettings(context: Context) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val intent = android.content.Intent(
                android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}")
            ).apply {
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }
    }
}