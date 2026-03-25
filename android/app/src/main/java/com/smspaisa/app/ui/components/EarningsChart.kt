package com.smspaisa.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class ChartBar(
    val label: String,
    val value: Float
)

@Composable
fun EarningsChart(
    bars: List<ChartBar>,
    modifier: Modifier = Modifier,
    // Maine yahan explicit Orange/Green color lagaya hai taaki visible rahe
    barColor: Color = Color(0xFF4CAF50) // Bright Green Color
) {
    if (bars.isEmpty()) {
        Box(
            modifier = modifier.height(200.dp).fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "No data available",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
        }
        return
    }

    val maxValue = bars.maxOfOrNull { it.value } ?: 1f
    val adjustedMax = if (maxValue == 0f) 1f else maxValue

    // Naya Compose Layout Canvas ki jagah
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(180.dp)
            .padding(horizontal = 8.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.Bottom // Sab bars ko bottom se align karega
    ) {
        bars.forEach { bar ->
            // Height calculation: Kam se kam 5% height rakhi hai taaki 0 par dot dikhe
            val heightFraction = maxOf(0.05f, bar.value / adjustedMax)
            
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom,
                modifier = Modifier.weight(1f) // Har bar ko equal space dega
            ) {
                // 1. Text (Earning Value)
                val labelText = when {
                    bar.value == 0f -> "₹0"
                    bar.value >= 100f -> "₹${bar.value.toInt()}"
                    else -> "₹%.1f".format(bar.value)
                }
                
                Text(
                    text = labelText,
                    fontSize = 11.sp,
                    color = Color.DarkGray, // Dark text taaki white card pe dikhe
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 6.dp)
                )
                
                // 2. Bar Shape
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.5f) // Column ki 50% width lega (zyada faila hua nahi lagega)
                        .fillMaxHeight(heightFraction * 0.8f) // 80% total height bars ke liye
                        .background(
                            color = barColor, 
                            shape = RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp)
                        )
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // 3. Label Text ("Today", "Mon", etc.)
                Text(
                    text = bar.label,
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
        }
    }
}
