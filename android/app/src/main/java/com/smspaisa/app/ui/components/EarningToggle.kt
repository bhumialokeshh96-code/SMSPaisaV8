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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    
    // Button ke rings ka animation
    val scale by pulseAnim.animateFloat(
        initialValue = 1f,
        targetValue = if (isActive) 1.08f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = EaseInOut),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    // NAYA: Text ke liye Shining/Glowing Animation 
    // Ye 0.3 (thoda dim) se 1.0 (pura bright) tak jayega aur wapas aayega
    val textGlowAlpha by pulseAnim.animateFloat(
        initialValue = 0.3f, 
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "textGlow"
    )

    val activeColor = MaterialTheme.colorScheme.secondary
    
    val composition by rememberLottieComposition(LottieCompositionSpec.RawRes(R.raw.play_button))
    
    val progress by animateFloatAsState(
        targetValue = if (isActive) 1f else 0f, 
        animationSpec = tween(
            durationMillis = composition?.duration?.toInt() ?: 600,
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
            modifier = Modifier.size(170.dp) 
        ) {
            if (isActive) {
                Box(
                    modifier = Modifier
                        .size(170.dp)
                        .scale(scale)
                        .background(
                            color = activeColor.copy(alpha = 0.15f),
                            shape = CircleShape
                        )
                )
                Box(
                    modifier = Modifier
                        .size(140.dp)
                        .scale(scale)
                        .background(
                            color = activeColor.copy(alpha = 0.25f),
                            shape = CircleShape
                        )
                )
            }
            
            Box(
                modifier = Modifier
                    .size(115.dp) 
                    .clip(CircleShape)
                    .background(Color.Transparent) 
                    .clickable { onToggle(!isActive) }, 
                contentAlignment = Alignment.Center
            ) {
                LottieAnimation(
                    composition = composition,
                    progress = { progress },
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
        
        Spacer(modifier = Modifier.height(12.dp)) 
        
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
                "TAP TO START EARNING" 
            },
            style = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.ExtraBold, 
                letterSpacing = 1.2.sp, 
                fontSize = 15.sp 
            ),
            color = if (isActive) {
                if (sendingProgress.status == SendingStatus.WAITING && sendingProgress.errorMessage != null) {
                    Orange20  
                } else {
                    MaterialTheme.colorScheme.secondary
                }
            } else {
                // NAYA: Yahan humne textGlowAlpha laga diya hai shining effect ke liye
                Color.White.copy(alpha = textGlowAlpha) 
            }
        )
    }
}
