package com.smspaisa.app.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.smspaisa.app.data.api.AppVersionResponse

@Composable
fun UpdateDialog(
    versionInfo: AppVersionResponse,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val isForced = versionInfo.forceUpdate

    AlertDialog(
        onDismissRequest = { if (!isForced) onDismiss() },
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
                text = if (isForced) "Update Required" else "Update Available",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Version ${versionInfo.latestVersion} available",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
                if (versionInfo.releaseNotes.isNotEmpty()) {
                    Divider()
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
        },
        confirmButton = {
            Button(
                onClick = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(versionInfo.apkUrl))
                    context.startActivity(intent)
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Download & Install")
            }
        },
        dismissButton = if (!isForced) {
            {
                TextButton(onClick = onDismiss) {
                    Text("Later")
                }
            }
        } else null
    )
}
