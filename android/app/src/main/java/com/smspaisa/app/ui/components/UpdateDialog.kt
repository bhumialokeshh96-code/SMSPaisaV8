package com.smspaisa.app.ui.components

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.smspaisa.app.data.api.AppVersionResponse
import com.smspaisa.app.utils.ApkDownloadManager
import com.smspaisa.app.utils.DownloadState
import com.smspaisa.app.viewmodel.AppUpdateViewModel

@Composable
fun UpdateDialog(
    versionInfo: AppVersionResponse,
    onDismiss: () -> Unit,
    viewModel: AppUpdateViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val isForced = versionInfo.forceUpdate
    val downloadState by viewModel.downloadState.collectAsState()

    val installPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) {
        if (ApkDownloadManager.canInstallUnknownApps(context)) {
            viewModel.startDownload(versionInfo.apkUrl)
        }
    }

    AlertDialog(
        onDismissRequest = {
            if (!isForced && downloadState !is DownloadState.Downloading) {
                viewModel.resetDownload()
                onDismiss()
            }
        },
        icon = {
            Icon(
                Icons.Default.SystemUpdate,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(32.dp)
            )
        },
        title = {
            Text(
                text = when {
                    downloadState is DownloadState.Downloading -> "Downloading Update..."
                    downloadState is DownloadState.Done -> "Download Complete!"
                    downloadState is DownloadState.Error -> "Download Failed"
                    isForced -> "Update Required"
                    else -> "Update Available"
                },
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when (val state = downloadState) {
                    is DownloadState.Idle, is DownloadState.Starting -> {
                        Text(
                            text = "Version ${versionInfo.latestVersion} available",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                        if (versionInfo.releaseNotes.isNotEmpty()) {
                            HorizontalDivider()
                            Text(
                                text = "What's new:",
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold)
                            )
                            Text(
                                text = versionInfo.releaseNotes,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                    is DownloadState.Downloading -> {
                        Text(
                            text = if (state.progress > 0) "${state.progress}% downloaded" else "Starting download...",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        if (state.progress > 0) {
                            val animatedProgress by animateFloatAsState(
                                targetValue = state.progress / 100f,
                                label = "download_progress"
                            )
                            LinearProgressIndicator(
                                progress = { animatedProgress },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Text(
                                text = "${state.progress}%,"
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.align(Alignment.End)
                            )
                        } else {
                            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                        }
                    }
                    is DownloadState.Done -> {
                        Text(
                            text = "Update downloaded successfully! Tap Install to continue.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                    is DownloadState.Error -> {
                        Text(
                            text = state.message,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    when (val state = downloadState) {
                        is DownloadState.Idle -> {
                            if (ApkDownloadManager.canInstallUnknownApps(context)) {
                                viewModel.startDownload(versionInfo.apkUrl)
                            } else {
                                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                                    val intent = Intent(
                                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                        Uri.parse("package:${context.packageName}")
                                    )
                                    installPermissionLauncher.launch(intent)
                                } else {
                                    viewModel.startDownload(versionInfo.apkUrl)
                                }
                            }
                        }
                        is DownloadState.Done -> {
                            viewModel.installApk(state.downloadId)
                        }
                        is DownloadState.Error -> {
                            viewModel.resetDownload()
                        }
                        is DownloadState.Starting -> { /* wait */ }
                        is DownloadState.Downloading -> { /* wait */ }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = downloadState !is DownloadState.Downloading && downloadState !is DownloadState.Starting
            ) {
                Text(
                    when (downloadState) {
                        is DownloadState.Idle -> "Download & Install"
                        is DownloadState.Starting -> "Starting..."
                        is DownloadState.Downloading -> "Downloading..."
                        is DownloadState.Done -> "Install Now"
                        is DownloadState.Error -> "Retry"
                    }
                )
            }
        },
        dismissButton = if (!isForced && downloadState !is DownloadState.Downloading) {
            {
                TextButton(onClick = {
                    viewModel.resetDownload()
                    onDismiss()
                }) {
                    Text("Later")
                }
            }
        } else null
    )
}