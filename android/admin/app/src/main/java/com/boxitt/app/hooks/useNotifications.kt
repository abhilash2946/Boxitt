package com.boxitt.app.hooks

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.app.NotificationCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.boxitt.app.services.GlobalSyncManager
import com.boxitt.app.services.LocalNotification
import com.boxitt.app.services.Storage
import com.boxitt.app.services.SyncEvent
import com.boxitt.app.services.Supabase
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.decodeOldRecord
import io.github.jan.supabase.realtime.decodeRecord
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.encodeToJsonElement
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

@Serializable
data class DbNotificationPayload(
    val id: String,
    val user_id: String,
    val title: String,
    val message: String,
    val created_at: String,
    val is_read: Boolean = false,
    val auto_delete_at: String? = null,
    val data: JsonElement? = null
)

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val syncManager: GlobalSyncManager
) : ViewModel() {
    var notificationsList by mutableStateOf<List<LocalNotification>>(emptyList())
        private set
    var unreadCount by mutableStateOf(0)
        private set
    var permissionGranted by mutableStateOf(false)
        private set

    private var pollJob: Job? = null
    private var realtimeJob: Job? = null

    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val channelId = "default_channel_id"

    init {
        createNotificationChannel()
        syncWithLocal()
        observeSyncEvents()
    }

    private fun observeSyncEvents() {
        viewModelScope.launch {
            syncManager.events.collect { event ->
                if (event is SyncEvent.NotificationsUpdated) {
                    syncWithLocal()
                }
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Default"
            val desc = "Default notification channel"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(channelId, name, importance).apply {
                description = desc
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun syncWithLocal() {
        val local = Storage.getNotifications()
        notificationsList = local
        unreadCount = local.count { !it.is_read }
    }

    fun checkAndRequestPermission(onResult: (Boolean) -> Unit = {}) {
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        permissionGranted = granted
        onResult(granted)
    }

    fun showSystemNotification(title: String, message: String) {
        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
    }

    fun startSync(userId: String) {
        // Clear any old jobs
        pollJob?.cancel()
        realtimeJob?.cancel()

        // 1. Start polling job (every 30 seconds)
        pollJob = viewModelScope.launch(Dispatchers.IO) {
            while (true) {
                fetchAndSync(userId)
                delay(30_000)
            }
        }

        // 2. Start realtime database listener
        realtimeJob = viewModelScope.launch {
            try {
                val channel = Supabase.client.realtime.channel("notifications:$userId")
                val changeFlow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = "notifications"
                }

                changeFlow.onEach { action ->
                    when (action) {
                        is PostgresAction.Insert -> {
                            val newNotif = action.decodeRecord<DbNotificationPayload>()
                            if (newNotif.user_id.trim() == userId.trim()) {
                                val localNotif = LocalNotification(
                                    id = newNotif.id,
                                    title = newNotif.title,
                                    message = newNotif.message,
                                    created_at = newNotif.created_at,
                                    is_read = newNotif.is_read,
                                    data = newNotif.data?.let { Storage.json.encodeToString<JsonElement>(it) }
                                )
                                Storage.addLocalNotification(localNotif)
                                viewModelScope.launch(Dispatchers.Main) {
                                    syncWithLocal()
                                    showSystemNotification(localNotif.title, localNotif.message)
                                }
                            }
                        }
                        is PostgresAction.Update -> {
                            val updatedNotif = action.decodeRecord<DbNotificationPayload>()
                            if (updatedNotif.user_id.trim() == userId.trim()) {
                                val localNotifs = Storage.getNotifications().toMutableList()
                                val index = localNotifs.indexOfFirst { it.id == updatedNotif.id }
                                if (index != -1) {
                                    localNotifs[index] = localNotifs[index].copy(
                                        is_read = updatedNotif.is_read,
                                        title = updatedNotif.title,
                                        message = updatedNotif.message,
                                        data = updatedNotif.data?.let { Storage.json.encodeToString<JsonElement>(it) }
                                    )
                                    Storage.saveNotifications(localNotifs)
                                    viewModelScope.launch(Dispatchers.Main) {
                                        syncWithLocal()
                                    }
                                }
                            }
                        }
                        is PostgresAction.Delete -> {
                            try {
                                val oldRecord = action.decodeOldRecord<DbNotificationPayload>()
                                val localNotifs = Storage.getNotifications().filter { it.id != oldRecord.id }
                                Storage.saveNotifications(localNotifs)
                                viewModelScope.launch(Dispatchers.Main) {
                                    syncWithLocal()
                                }
                            } catch (e: Exception) {
                                // If decoding fails (missing old_record in payload), we might need a full fetch
                                fetchAndSync(userId)
                            }
                        }
                        else -> {}
                    }
                }.launchIn(viewModelScope)

                channel.subscribe()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun stopSync() {
        pollJob?.cancel()
        realtimeJob?.cancel()
    }

    private suspend fun fetchAndSync(userId: String) {
        try {
            val isoNow = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).format(Date())
            
            // Delete expired server notifications
            try {
                Supabase.client.postgrest["notifications"].delete {
                    filter {
                        eq("user_id", userId.trim())
                        lte("auto_delete_at", isoNow)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            // Fetch recent notifications
            val data = Supabase.client.postgrest["notifications"].select {
                filter {
                    eq("user_id", userId.trim())
                }
                order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(Storage.MAX_LOCAL_NOTIFICATIONS.toLong())
            }.decodeList<DbNotificationPayload>()

            if (data.isNotEmpty()) {
                val localNotifs = Storage.getNotifications()
                val existingIds = localNotifs.map { it.id }.toSet()
                val newToPush = mutableListOf<LocalNotification>()

                data.forEach { n ->
                    if (!existingIds.contains(n.id)) {
                        val local = LocalNotification(
                            id = n.id,
                            title = n.title,
                            message = n.message,
                            created_at = n.created_at,
                            is_read = n.is_read,
                            data = n.data?.let { Storage.json.encodeToString<JsonElement>(it) }
                        )
                        newToPush.add(local)

                        // If notification is younger than 35s, trigger system notification popup
                        val time = try {
                            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(n.created_at)?.time ?: 0L
                        } catch (e: Exception) {
                            0L
                        }
                        if (System.currentTimeMillis() - time < 35_000) {
                            showSystemNotification(n.title, n.message)
                        }
                    }
                }

                if (newToPush.isNotEmpty()) {
                    val updated = (newToPush + localNotifs).take(Storage.MAX_LOCAL_NOTIFICATIONS)
                    Storage.saveNotifications(updated)
                    viewModelScope.launch(Dispatchers.Main) {
                        syncWithLocal()
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun markAllAsRead() {
        val updated = notificationsList.map { it.copy(is_read = true) }
        Storage.saveNotifications(updated)
        syncManager.notifyNotificationsUpdatedSync()
        syncWithLocal()

        val userId = Storage.getUser()?.id
        if (userId != null) {
            viewModelScope.launch(Dispatchers.IO) {
                try {
                    Supabase.client.postgrest["notifications"].update({
                        set("is_read", true)
                    }) {
                        filter {
                            eq("user_id", userId.trim())
                            eq("is_read", false)
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun deleteNotification(id: String) {
        val updated = notificationsList.filter { it.id != id }
        Storage.saveNotifications(updated)
        syncManager.notifyNotificationsUpdatedSync()
        syncWithLocal()

        viewModelScope.launch(Dispatchers.IO) {
            try {
                Supabase.client.postgrest["notifications"].delete {
                    filter {
                        eq("id", id)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun clearAllNotifications(userId: String?) {
        Storage.saveNotifications(emptyList())
        syncManager.notifyNotificationsUpdatedSync()
        syncWithLocal()

        if (userId != null) {
            viewModelScope.launch(Dispatchers.IO) {
                try {
                    Supabase.client.postgrest["notifications"].delete {
                        filter {
                            eq("user_id", userId.trim())
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }
}




