package com.smspaisa.app.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = Coral40,
    onPrimary = Grey99,
    primaryContainer = Coral80,
    onPrimaryContainer = Coral20,
    secondary = Green40,
    onSecondary = Grey99,
    secondaryContainer = Green80,
    onSecondaryContainer = Green20,
    tertiary = Orange40,
    onTertiary = Grey99,
    tertiaryContainer = Orange80,
    onTertiaryContainer = Orange20,
    error = Red40,
    onError = Grey99,
    errorContainer = Red80,
    onErrorContainer = Red20,
    background = Grey99,
    onBackground = Grey10,
    surface = Grey95,
    onSurface = Grey10,
    surfaceVariant = Grey90,
    onSurfaceVariant = Grey20,
    outline = Grey20
)

private val DarkColorScheme = darkColorScheme(
    primary = Coral80,
    onPrimary = Coral20,
    primaryContainer = Coral40,
    onPrimaryContainer = Coral80,
    secondary = Green80,
    onSecondary = Green20,
    secondaryContainer = Green40,
    onSecondaryContainer = Green80,
    tertiary = Orange80,
    onTertiary = Orange20,
    tertiaryContainer = Orange40,
    onTertiaryContainer = Orange80,
    error = Red80,
    onError = Red20,
    errorContainer = Red40,
    onErrorContainer = Red80,
    background = Grey10,
    onBackground = Grey90,
    surface = Grey20,
    onSurface = Grey90,
    surfaceVariant = Grey20,
    onSurfaceVariant = Grey90,
    outline = Grey50
)

@Composable
fun SMSPaisaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            val statusBarColor = if (darkTheme) Grey10 else WarmBeige
            val navBarColor = if (darkTheme) Grey10 else SoftPink
            window.statusBarColor = statusBarColor.toArgb()
            window.navigationBarColor = navBarColor.toArgb()
            val insetsController = WindowCompat.getInsetsController(window, view)
            insetsController.isAppearanceLightStatusBars = !darkTheme
            insetsController.isAppearanceLightNavigationBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
