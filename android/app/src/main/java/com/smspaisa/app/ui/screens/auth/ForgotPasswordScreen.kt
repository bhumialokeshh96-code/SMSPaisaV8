package com.smspaisa.app.ui.screens.auth

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.smspaisa.app.viewmodel.ForgotPasswordUiState
import com.smspaisa.app.viewmodel.ForgotPasswordViewModel

@Composable
fun ForgotPasswordScreen(
    onPasswordResetSuccess: () -> Unit,
    onBackClick: () -> Unit,
    viewModel: ForgotPasswordViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()

    var phone by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var showSecurityTipsDialog by remember { mutableStateOf(true) }
    var step by remember { mutableStateOf(1) }

    if (showSecurityTipsDialog) {
        AlertDialog(
            onDismissRequest = { /* Cannot dismiss — must confirm */ },
            title = { Text("🔔 Security Tips 🔔") },
            text = {
                Column {
                    Text("⚠️⚠️⚠️ Your Device ID is an important credential for your account security and is only used for identity verification.\n")
                    Text("1️⃣ Do not disclose it\nYour Device ID is directly associated with your device and account. Do not share it with anyone.\n")
                    Text("2️⃣ Official use only 🔒🔒🔒\nPassword reset uses your registered device to verify your identity through the in-app secure channel.\n")
                    Text("3️⃣ Risk consequences\nUnauthorized access may result in account theft.\n")
                    Text("4️⃣ Question handling\nIf you encounter suspicious requests, terminate immediately and contact support.")
                }
            },
            confirmButton = {
                Button(onClick = { showSecurityTipsDialog = false }) {
                    Text("Confirm")
                }
            }
        )
    }

    if (!showSecurityTipsDialog) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            when (step) {
                1 -> {
                    Text("Forgot Password", style = MaterialTheme.typography.headlineMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Enter your registered phone number. We'll verify your device automatically.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(24.dp))

                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("Phone Number") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            if (phone.isBlank()) {
                                Toast.makeText(context, "Please enter phone number", Toast.LENGTH_SHORT).show()
                            } else {
                                viewModel.verifyDevice(phone)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = uiState !is ForgotPasswordUiState.Loading
                    ) {
                        if (uiState is ForgotPasswordUiState.Loading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp))
                        } else {
                            Text("Verify My Device")
                        }
                    }
                }

                2 -> {
                    Text("Set New Password", style = MaterialTheme.typography.headlineMedium)
                    Spacer(modifier = Modifier.height(24.dp))

                    OutlinedTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it },
                        label = { Text("New Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it },
                        label = { Text("Confirm Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            when {
                                newPassword.length < 6 -> Toast.makeText(context, "Password must be at least 6 characters", Toast.LENGTH_SHORT).show()
                                newPassword != confirmPassword -> Toast.makeText(context, "Passwords do not match", Toast.LENGTH_SHORT).show()
                                else -> viewModel.resetPassword(newPassword)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = uiState !is ForgotPasswordUiState.Loading
                    ) {
                        if (uiState is ForgotPasswordUiState.Loading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp))
                        } else {
                            Text("Reset Password")
                        }
                    }
                }
            }

            LaunchedEffect(uiState) {
                when (uiState) {
                    is ForgotPasswordUiState.DeviceVerified -> {
                        step = 2
                    }
                    is ForgotPasswordUiState.PasswordReset -> {
                        Toast.makeText(context, "Password reset successfully!", Toast.LENGTH_LONG).show()
                        onPasswordResetSuccess()
                    }
                    is ForgotPasswordUiState.Error -> {
                        Toast.makeText(context, (uiState as ForgotPasswordUiState.Error).message, Toast.LENGTH_LONG).show()
                    }
                    else -> {}
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            TextButton(onClick = onBackClick) {
                Text("Back to Login")
            }
        }
    }
}
