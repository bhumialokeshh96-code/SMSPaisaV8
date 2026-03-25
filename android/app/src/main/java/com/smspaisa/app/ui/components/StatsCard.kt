package com.smspaisa.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun StatsCard(
    title: String,
    value: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
    cardType: String = "default" // "sent", "delivered", "earned", "default"
) {
    val (gradientStart, gradientEnd) = when (cardType) {
        "sent" -> Pair(Color(0xFFF5F5F5), Color(0xFFE8E8E8))
        "delivered" -> Pair(Color(0xFFE8F5E9), Color(0xFFC8E6C9))
        "earned" -> Pair(Color(0xFFFFF8E1), Color(0xFFFFE082))
        "failed" -> Pair(Color(0xFFFFEBEE), Color(0xFFFFCDD2))
        else -> Pair(Color(0xFFF8F8F8), Color(0xFFEFEFEF))
    }

    val cardShape = RoundedCornerShape(18.dp)

    Card(
        modifier = modifier,
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(gradientStart, gradientEnd)
                    )
                )
                .border(
                    width = 1.dp,
                    color = Color.White.copy(alpha = 0.6f),
                    shape = cardShape
                )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 0.03.sp
                    ),
                    color = Color(0xFF424242).copy(alpha = 0.7f)
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = value,
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    color = Color(0xFF1A1A1A)
                )
                subtitle?.let {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = it,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 10.sp
                        ),
                        color = Color(0xFF666666).copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}
