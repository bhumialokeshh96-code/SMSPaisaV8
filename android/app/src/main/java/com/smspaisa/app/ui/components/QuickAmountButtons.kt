package com.smspaisa.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun QuickAmountButtons(
    availableBalance: Double,
    onAmountSelected: (Double) -> Unit,
    modifier: Modifier = Modifier
) {
    val amounts = listOf(50.0, 100.0, 500.0)

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        amounts.forEach { amount ->
            OutlinedButton(
                onClick = { onAmountSelected(amount) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 8.dp)
            ) {
                Text("₹${amount.toInt()}", style = MaterialTheme.typography.bodySmall)
            }
        }
        Button(
            onClick = { onAmountSelected(availableBalance) },
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(8.dp),
            contentPadding = PaddingValues(horizontal = 4.dp, vertical = 8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.secondary
            )
        ) {
            Text("ALL", style = MaterialTheme.typography.bodySmall)
        }
    }
}
