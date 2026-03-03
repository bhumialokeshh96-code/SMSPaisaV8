package com.smspaisa.app.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.airbnb.lottie.compose.*
import com.smspaisa.app.R
import com.smspaisa.app.viewmodel.SupportViewModel
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FloatingSupportButton(
    viewModel: SupportViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val supportLinks by viewModel.supportLinks.collectAsState()

    var offsetX by remember { mutableStateOf(0f) }
    var offsetY by remember { mutableStateOf(0f) }
    var isDragging by remember { mutableStateOf(false) }
    var dragDistance by remember { mutableStateOf(0f) }
    var showBottomSheet by remember { mutableStateOf(false) }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val composition by rememberLottieComposition(LottieCompositionSpec.RawRes(R.raw.headphone))
    val progress by animateLottieCompositionAsState(
        composition = composition,
        iterations = LottieConstants.IterateForever
    )

    if (showBottomSheet) {
        ModalBottomSheet(
            onDismissRequest = { showBottomSheet = false },
            sheetState = sheetState,
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Handle bar
                HorizontalDivider(
                    modifier = Modifier
                        .width(40.dp)
                        .padding(bottom = 16.dp),
                    thickness = 4.dp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)
                )
                Text(
                    text = "Contact Support",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                Text(
                    text = "We're here to help you!",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    modifier = Modifier.padding(bottom = 24.dp)
                )

                // Telegram Button
                Button(
                    onClick = {
                        val url = supportLinks?.telegram ?: "https://t.me/smspaisa_support"
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        showBottomSheet = false
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF229ED9)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "✈  Telegram",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = Color.White
                    )
                }

                Spacer(Modifier.height(12.dp))

                // WhatsApp Button
                Button(
                    onClick = {
                        val url = supportLinks?.whatsapp ?: "https://wa.me/919000000000"
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        showBottomSheet = false
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "💬  WhatsApp",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = Color.White
                    )
                }

                Spacer(Modifier.height(16.dp))

                TextButton(onClick = { showBottomSheet = false }) {
                    Text("Close")
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .offset { IntOffset(offsetX.roundToInt(), offsetY.roundToInt()) }
            .size(72.dp)
            .pointerInput(Unit) {
                detectDragGestures(
                    onDragStart = {
                        isDragging = true
                        dragDistance = 0f
                    },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        offsetX += dragAmount.x
                        offsetY += dragAmount.y
                        dragDistance += kotlin.math.sqrt(
                            dragAmount.x * dragAmount.x + dragAmount.y * dragAmount.y
                        )
                    },
                    onDragEnd = {
                        isDragging = false
                    }
                )
            }
            .clickable { showBottomSheet = true }
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            shape = CircleShape,
            shadowElevation = 8.dp,
            color = MaterialTheme.colorScheme.surface
        ) {
            LottieAnimation(
                composition = composition,
                progress = { progress },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(8.dp)
            )
        }
    }
}
