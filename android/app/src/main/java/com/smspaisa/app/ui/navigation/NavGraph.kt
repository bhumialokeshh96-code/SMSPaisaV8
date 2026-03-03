package com.smspaisa.app.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.smspaisa.app.ui.components.LottieLoading
import com.smspaisa.app.ui.components.UpdateDialog
import com.smspaisa.app.ui.screens.auth.ForgotPasswordScreen
import com.smspaisa.app.ui.screens.auth.LoginScreen
import com.smspaisa.app.ui.screens.auth.RegisterScreen
import com.smspaisa.app.ui.screens.home.HomeScreen
import com.smspaisa.app.ui.screens.onboarding.OnboardingScreen
import com.smspaisa.app.ui.screens.profile.ProfileScreen
import com.smspaisa.app.ui.screens.referral.ReferralScreen
import com.smspaisa.app.ui.screens.stats.StatsScreen
import com.smspaisa.app.ui.screens.withdraw.WithdrawScreen
import com.smspaisa.app.ui.screens.history.WithdrawalHistoryScreen
import com.smspaisa.app.viewmodel.AppUpdateViewModel
import com.smspaisa.app.viewmodel.AuthViewModel

sealed class Screen(val route: String) {
    object Onboarding : Screen("onboarding")
    object Login : Screen("login")
    object Register : Screen("register")
    object ForgotPassword : Screen("forgot_password")
    object Home : Screen("home")
    object Stats : Screen("stats")
    object Withdraw : Screen("withdraw")
    object Profile : Screen("profile")
    object Referral : Screen("referral")
    object History : Screen("history")
}

@Composable
fun NavGraph(
    navController: NavHostController = rememberNavController()
) {
    val authViewModel: AuthViewModel = hiltViewModel()
    val isReady by authViewModel.isReady.collectAsState()
    val startDestination by authViewModel.startDestination.collectAsState()

    val appUpdateViewModel: AppUpdateViewModel = hiltViewModel()
    val updateInfo by appUpdateViewModel.updateInfo.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        try {
            val currentVersion = context.packageManager
                .getPackageInfo(context.packageName, 0).versionName ?: "1.0.0"
            appUpdateViewModel.checkForUpdate(currentVersion)
        } catch (e: Exception) {
            // Silently ignore — don't crash if update check fails
        }
    }

    updateInfo?.let { info ->
        UpdateDialog(
            versionInfo = info,
            onDismiss = { appUpdateViewModel.dismissUpdate() }
        )
    }

    if (!isReady) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "SMSPaisa",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(16.dp))
                LottieLoading(centered = false)
            }
        }
        return
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Onboarding.route) {
            OnboardingScreen(
                onComplete = {
                    authViewModel.completeOnboarding()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Onboarding.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Login.route) {
            LoginScreen(
                onNavigateToHome = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigateToRegister = {
                    navController.navigate(Screen.Register.route)
                },
                onNavigateToForgotPassword = {
                    navController.navigate(Screen.ForgotPassword.route)
                }
            )
        }

        composable(Screen.ForgotPassword.route) {
            ForgotPasswordScreen(
                onPasswordResetSuccess = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.ForgotPassword.route) { inclusive = true }
                    }
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(Screen.Register.route) {
            RegisterScreen(
                onNavigateToHome = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Home.route) {
            HomeScreen(
                onNavigateToStats = { navController.navigate(Screen.Stats.route) },
                onNavigateToWithdraw = { navController.navigate(Screen.Withdraw.route) },
                onNavigateToProfile = { navController.navigate(Screen.Profile.route) },
                onNavigateToHistory = { navController.navigate(Screen.History.route) }
            )
        }

        composable(Screen.Stats.route) {
            StatsScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToHome = { navController.navigate(Screen.Home.route) },
                onNavigateToWithdraw = { navController.navigate(Screen.Withdraw.route) },
                onNavigateToProfile = { navController.navigate(Screen.Profile.route) }
            )
        }

        composable(Screen.Withdraw.route) {
            WithdrawScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToHome = { navController.navigate(Screen.Home.route) },
                onNavigateToStats = { navController.navigate(Screen.Stats.route) },
                onNavigateToProfile = { navController.navigate(Screen.Profile.route) },
                onNavigateToHistory = { navController.navigate(Screen.History.route) }
            )
        }

        composable(Screen.Profile.route) {
            ProfileScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToReferral = { navController.navigate(Screen.Referral.route) },
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigateToHome = { navController.navigate(Screen.Home.route) },
                onNavigateToStats = { navController.navigate(Screen.Stats.route) },
                onNavigateToWithdraw = { navController.navigate(Screen.Withdraw.route) }
            )
        }

        composable(Screen.Referral.route) {
            ReferralScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.History.route) {
            WithdrawalHistoryScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToHome = { navController.navigate(Screen.Home.route) },
                onNavigateToStats = { navController.navigate(Screen.Stats.route) },
                onNavigateToWithdraw = { navController.navigate(Screen.Withdraw.route) },
                onNavigateToProfile = { navController.navigate(Screen.Profile.route) }
            )
        }
    }
}
