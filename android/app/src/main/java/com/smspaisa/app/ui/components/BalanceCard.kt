package com.smspaisa.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smspaisa.app.R
import com.smspaisa.app.model.Wallet

@Composable
fun BalanceCard(
    wallet: Wallet,
    onWithdrawClick: () -> Unit,
    onHistoryClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.Transparent
        ),
        elevation = CardDefaults.cardElevation(8.dp)
    ) {
        Box {
            Image(
                painter = painterResource(R.drawable.bg_balance_card),
                contentDescription = "",
                modifier = Modifier.matchParentSize(),
                contentScale = ContentScale.Crop
            )
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(Color.Black.copy(alpha = 0.25f))
            )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            // Title Text - Available Balance
            Text(
                text = "Available Balance",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontSize = 14.sp,
                    letterSpacing = 0.05.sp,
                    fontWeight = FontWeight.Medium
                ),
                color = Color(0xCCFFFFFF)
            )
            Spacer(modifier = Modifier.height(4.dp))
            // Balance Amount with Glow Effect
            Text(
                text = "₹%.2f".format(wallet.balance),
                style = MaterialTheme.typography.headlineLarge.copy(
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold
                ),
                color = Color(0xFFFFFFFF),
                modifier = Modifier.shadow(
                    elevation = 12.dp,
                    shape = RoundedCornerShape(8.dp),
                    clip = false
                )
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    // Total Earned Label
                    Text(
                        text = "Total Earned",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 12.sp,
                            letterSpacing = 0.03.sp
                        ),
                        color = Color(0xB3FFFFFF)
                    )
                    // Total Earned Value
                    Text(
                        text = "₹%.2f".format(wallet.totalEarned),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 0.02.sp
                        ),
                        color = Color(0xFFFFFFFF)
                    )
                }
                Column {
                    // Withdrawn Label
                    Text(
                        text = "Withdrawn",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 12.sp,
                            letterSpacing = 0.03.sp
                        ),
                        color = Color(0xB3FFFFFF)
                    )
                    // Withdrawn Value
                    Text(
                        text = "₹%.2f".format(wallet.totalWithdrawn),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 0.02.sp
                        ),
                        color = Color(0xFFFFFFFF)
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onWithdrawClick,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = MaterialTheme.colorScheme.primary
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.AccountBalanceWallet,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Withdraw", fontWeight = FontWeight.SemiBold)
                }
                OutlinedButton(
                    onClick = onHistoryClick,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color.White
                    ),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color.White),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.History,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("History")
                }
            }
        }
        }
    }
}
