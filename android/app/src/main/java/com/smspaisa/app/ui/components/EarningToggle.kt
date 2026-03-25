package com.smspaisa.app.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.airbnb.lottie.compose.*
import com.smspaisa.app.R
import com.smspaisa.app.model.SendingProgress
import com.smspaisa.app.model.SendingStatus
import com.smspaisa.app.ui.theme.Orange20

@Composable
fun EarningToggle(
    isActive: Boolean,
    onToggle: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    sendingProgress: SendingProgress = SendingProgress()
) {
    val pulseAnim = rememberInfiniteTransition(label = "pulse")
    val scale by pulseAnim.animateFloat(
        initialValue = 1f,
        targetValue = if (isActive) 1.08f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = EaseInOut),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    val activeColor = MaterialTheme.colorScheme.secondary
    
    // Lottie Animation setup
    val composition by rememberLottieComposition(LottieCompositionSpec.RawRes(R.raw.play_button))
    
    // Toggle Animation Logic: Play to Stop (Forward) and Stop to Play (Reverse)
    val progress by animateFloatAsState(
        targetValue = if (isActive) 1f else 0f, // 1f matlab end (Stop icon), 0f matlab start (Play icon)
        animationSpec = tween(
            durationMillis = composition?.duration?.toInt() ?: 600, // Lottie file ki original speed use karega
            easing = LinearEasing
        ),
        label = "LottieToggle"
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(140.dp)
        ) {
            if (isActive) {
                // Outer pulse ring
                Box(
                    modifier = Modifier
                        .size(140.dp)
                        .scale(scale)
                        .background(
                            color = activeColor.copy(alpha = 0.15f),
                            shape = CircleShape
                        )
                )
                // Middle ring
                Box(
                    modifier = Modifier
                        .size(115.dp)
                        .scale(scale)
                        .background(
                            color = activeColor.copy(alpha = 0.25f),
                            shape = CircleShape
                        )
                )
            }
            
            // Lottie Animation as Main Button
            Box(
                modifier = Modifier
                    .size(90.dp)
                    .clip(CircleShape)
                    .background(Color.Transparent) 
                    .clickable { onToggle(!isActive) }, // Tap karne par animation toggle hoga
                contentAlignment = Alignment.Center
            ) {
                LottieAnimation(
                    composition = composition,
                    progress = { progress }, // Custom progress attach kiya
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = if (isActive) {
                when (sendingProgress.status) {
                    SendingStatus.SENDING -> "Sending SMS... (${sendingProgress.sentInRound}/${sendingProgress.totalInRound})"
                    SendingStatus.WAITING -> sendingProgress.errorMessage ?: "Waiting for tasks..."
                    SendingStatus.FETCHING -> "Fetching tasks..."
                    SendingStatus.ROUND_COMPLETE -> "Round complete!"
                    SendingStatus.VERIFYING -> "Verifying..."
                    SendingStatus.REPORTING -> "Reporting..."
                    SendingStatus.ERROR -> sendingProgress.errorMessage ?: "Error occurred"
                    else -> "Service is running"
                }
            } else {
                "Tap to start earning"
            },
            style = MaterialTheme.typography.bodySmall,
            color = if (isActive) {
                if (sendingProgress.status == SendingStatus.WAITING && sendingProgress.errorMessage != null) {
                    Orange20  // Deep orange — indicates blocked
                } else {
                    MaterialTheme.colorScheme.secondary
                }
            } else {
                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            }
        )
    }
}
