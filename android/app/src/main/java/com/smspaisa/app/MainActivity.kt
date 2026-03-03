package com.smspaisa.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.smspaisa.app.ui.components.GradientBackground
import com.smspaisa.app.ui.navigation.NavGraph
import com.smspaisa.app.ui.theme.SMSPaisaTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SMSPaisaTheme {
                GradientBackground {
                    NavGraph()
                }
            }
        }
    }
}
