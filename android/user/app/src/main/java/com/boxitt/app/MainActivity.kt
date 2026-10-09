package com.boxitt.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import com.boxitt.app.services.SessionManager
import com.boxitt.app.services.Storage
import com.boxitt.app.theme.ThemeName
import com.boxitt.app.contexts.ThemeProvider
import com.boxitt.app.contexts.PermissionsProvider
import com.boxitt.app.contexts.PermissionsManager
import androidx.compose.ui.platform.LocalContext
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

import com.boxitt.app.services.GlobalSyncManager
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.flow.first

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize local Storage helper
        Storage.init(applicationContext)

        setContent {
            val themeStr by sessionManager.appTheme.collectAsState(initial = "LIGHT")
            val context = LocalContext.current

            // Global Sync Logic
            LaunchedEffect(Unit) {
                val userId = sessionManager.userId.first()
                GlobalSyncManager.syncAllData(userId)
                GlobalSyncManager.startRealtimeSync(userId)
            }
            
            // Trigger Permission Onboarding after login
            val isLoggedIn by sessionManager.isLoggedIn.collectAsState(initial = false)
            LaunchedEffect(isLoggedIn) {
                if (isLoggedIn) {
                    PermissionsManager.requestAllPermissions(context)
                }
            }

            // For now, let's keep the existing ThemeProvider and just wrap our App
            ThemeProvider {
                PermissionsProvider {
                    MaterialTheme {
                        Surface {
                            App(sessionManager = sessionManager)
                        }
                    }
                }
            }
        }
    }
}
