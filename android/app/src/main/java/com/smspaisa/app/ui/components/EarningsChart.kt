package com.smspaisa.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.style.TextAlign
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
    barColor: Color = MaterialTheme.colorScheme.primary
) {
    if (bars.isEmpty()) return

    val maxValue = bars.maxOfOrNull { it.value } ?: 1f
    val adjustedMax = if (maxValue == 0f) 1f else maxValue

    Column(modifier = modifier) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
        ) {
            val totalWidth = size.width
            val totalHeight = size.height
            val barCount = bars.size
            val spacingPx = 6.dp.toPx()
            val barWidth = (totalWidth - spacingPx * (barCount + 1)) / barCount
            val spacing = spacingPx

            bars.forEachIndexed { index, bar ->
                val barHeight = (bar.value / adjustedMax) * totalHeight * 0.85f
                val left = spacing + index * (barWidth + spacing)
                val top = totalHeight - barHeight

                drawRoundRect(
                    color = barColor,
                    topLeft = Offset(left, top),
                    size = Size(barWidth, barHeight),
                    cornerRadius = CornerRadius(4.dp.toPx())
                )

                if (bar.value > 0f) {
                    val paint = android.graphics.Paint().apply {
                        color = android.graphics.Color.DKGRAY
                        textSize = 9.dp.toPx()
                        textAlign = android.graphics.Paint.Align.CENTER
                        isAntiAlias = true
                    }
                    val label = if (bar.value >= 100f) "₹${bar.value.toInt()}" else "₹%.1f".format(bar.value)
                    drawContext.canvas.nativeCanvas.drawText(
                        label,
                        left + barWidth / 2,
                        top - 4.dp.toPx(),
                        paint
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            bars.forEach { bar ->
                Text(
                    text = bar.label,
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}
