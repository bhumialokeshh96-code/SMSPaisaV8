package com.smspaisa.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.smspaisa.app.model.SendingProgress
import com.smspaisa.app.model.SendingStatus
import com.smspaisa.app.ui.theme.Orange20

@Composable
fun SendingProgressCard(progress: SendingProgress, onRetry: () -> Unit = {}, isServiceRunning: Boolean = false) {
    if (progress.status == SendingStatus.IDLE && !isServiceRunning) return

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = when (progress.status) {
                        SendingStatus.FETCHING -> "Fetching tasks..."
                        SendingStatus.SENDING -> "Sending SMS..."
                        SendingStatus.WAITING -> if (progress.errorMessage != null) "Paused" else "Waiting for tasks..."
                        SendingStatus.VERIFYING -> "Verifying SMS delivery..."
                        SendingStatus.REPORTING -> "Reporting results to server..."
                        SendingStatus.ROUND_COMPLETE -> "Round complete!"
                        SendingStatus.ERROR -> "Error occurred"
                        SendingStatus.IDLE -> "Waiting for next batch..."
                    },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                if (progress.status == SendingStatus.SENDING) {
                    Text("${progress.sentInRound}/${progress.totalInRound}")
                }
            }

            if (progress.status == SendingStatus.SENDING && progress.totalInRound > 0) {
                Spacer(modifier = Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { progress.sentInRound.toFloat() / progress.totalInRound.toFloat() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Sending to ${progress.currentRecipient} — \"${progress.currentMessagePreview}\"",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            if (progress.status == SendingStatus.WAITING) {
                Spacer(modifier = Modifier.height(8.dp))
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    color = if (progress.errorMessage != null) {
                        Orange20  // Orange for blocked
                    } else {
                        MaterialTheme.colorScheme.primary
                    }
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = progress.errorMessage ?: "No tasks available. Checking again soon...",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (progress.errorMessage != null) {
                        Orange20
                    } else {
                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    }
                )
            }

            if (progress.status == SendingStatus.IDLE && isServiceRunning) {
                Spacer(modifier = Modifier.height(8.dp))
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Service is active. Waiting for next batch...",
                    style = MaterialTheme.typography.bodySmall
                )
            }

            if (progress.status == SendingStatus.VERIFYING) {
                Spacer(modifier = Modifier.height(8.dp))
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Waiting for carrier confirmation...",
                    style = MaterialTheme.typography.bodySmall
                )
            }

            if (progress.status == SendingStatus.REPORTING) {
                Spacer(modifier = Modifier.height(8.dp))
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Syncing SMS results with server...",
                    style = MaterialTheme.typography.bodySmall
                )
            }

            if (progress.status == SendingStatus.ERROR) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = progress.errorMessage ?: "Unknown error occurred",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = onRetry) {
                    Text("Retry")
                }
            }
        }
    }
}
