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
import com.airbnb.lottie.compose.* // Lottie import zaroori hai
import com.smspaisa.app.R // R import zaroori hai raw folder ke liye
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
    
    // Animation ki speed aur state manage karne ke liye
    // Agar isActive true hai toh animation play hogi, warna ruk jayegi
    val progress by animateLottieCompositionAsState(
        composition = composition,
        isPlaying = isActive,
        iterations = LottieConstants.IterateForever // Animation lagatar chalane ke liye
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
                    .background(Color.Transparent) // Button ka default color ab transparent hai
                    .clickable { onToggle(!isActive) }, // Tap karne par toggle hoga
                contentAlignment = Alignment.Center
            ) {
                LottieAnimation(
                    composition = composition,
                    progress = { progress },
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
