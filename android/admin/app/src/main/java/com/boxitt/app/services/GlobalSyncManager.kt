package com.boxitt.app.services

import com.boxitt.app.Location
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

sealed class SyncEvent {
    object NotificationsUpdated : SyncEvent()
}

/**
 * a singleton to coordinate state synchronization across different UI components.
 */
@Singleton
class GlobalSyncManager @Inject constructor() {
    private val _events = MutableSharedFlow<SyncEvent>(extraBufferCapacity = 10)
    val events = _events.asSharedFlow()

    suspend fun notifyNotificationsUpdated() {
        _events.emit(SyncEvent.NotificationsUpdated)
    }

    fun notifyNotificationsUpdatedSync() {
        _events.tryEmit(SyncEvent.NotificationsUpdated)
    }

    companion object {
        private val _locations = MutableStateFlow<List<Location>>(emptyList())
        val locations = _locations.asStateFlow()

        private val _isInitialSyncComplete = MutableStateFlow(false)
        val isInitialSyncComplete = _isInitialSyncComplete.asStateFlow()

        private val syncScope = CoroutineScope(Dispatchers.IO)

        fun syncAllData(userId: String?) {
            syncScope.launch {
                try {
                    val locs = LocationService.getLocations()
                    _locations.value = locs
                    _isInitialSyncComplete.value = true
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        fun startRealtimeSync(userId: String?) {
            // Placeholder for realtime sync if needed for locations
        }
    }
}
