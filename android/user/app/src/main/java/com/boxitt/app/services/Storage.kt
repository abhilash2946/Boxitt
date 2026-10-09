package com.boxitt.app.services

import android.content.Context
import android.content.SharedPreferences
import com.boxitt.app.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.contentOrNull
import java.text.SimpleDateFormat
import java.util.Locale

fun getNotificationExpirationTime(notif: LocalNotification): Long {
    val TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000L
    val now = System.currentTimeMillis()

    if (!notif.data.isNullOrBlank()) {
        try {
            val json = Storage.json.parseToJsonElement(notif.data).jsonObject
            val dateStr = json["date"]?.jsonPrimitive?.contentOrNull
                ?: json["booking_date"]?.jsonPrimitive?.contentOrNull
                ?: json["challenge_date"]?.jsonPrimitive?.contentOrNull

            val slotTimeStr = json["slot_time"]?.jsonPrimitive?.contentOrNull
                ?: json["booking_slot_time"]?.jsonPrimitive?.contentOrNull

            val endHour = json["end_hour"]?.jsonPrimitive?.doubleOrNull

            if (!dateStr.isNullOrBlank()) {
                val sdfDate = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                val parsedDate = sdfDate.parse(dateStr)
                if (parsedDate != null) {
                    val cal = java.util.Calendar.getInstance()
                    cal.time = parsedDate

                    if (endHour != null) {
                        val hours = endHour.toInt()
                        val mins = Math.round((endHour - hours) * 60).toInt()
                        cal.set(java.util.Calendar.HOUR_OF_DAY, hours)
                        cal.set(java.util.Calendar.MINUTE, mins)
                        return cal.timeInMillis + TWENTY_FOUR_HOURS
                    } else if (!slotTimeStr.isNullOrBlank()) {
                        val parts = slotTimeStr.split("-")
                        val endPart = (if (parts.size > 1) parts[1] else parts[0]).trim()
                        val isPM = endPart.lowercase().contains("pm")
                        val isAM = endPart.lowercase().contains("am")
                        val digits = endPart.replace(Regex("[^0-9:]"), "").split(":")
                        if (digits.isNotEmpty()) {
                            var h = digits[0].toIntOrNull() ?: 0
                            val m = if (digits.size > 1) digits[1].toIntOrNull() ?: 0 else 0
                            if (isPM && h < 12) h += 12
                            if (isAM && h == 12) h = 0
                            cal.set(java.util.Calendar.HOUR_OF_DAY, h)
                            cal.set(java.util.Calendar.MINUTE, m)

                            if (parts[0].lowercase().contains("pm") && isAM) {
                                cal.add(java.util.Calendar.DAY_OF_MONTH, 1)
                            }
                            return cal.timeInMillis + TWENTY_FOUR_HOURS
                        }
                    }
                }
            }
        } catch (e: Exception) {
            // Fallback
        }
    }

    val createdMs = try {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(notif.created_at)?.time ?: now
    } catch (e: Exception) { now }

    return createdMs + TWENTY_FOUR_HOURS
}

@Serializable
data class NavState(
    val currentPage: String,
    val selectedSport: SportType? = null,
    val selectedLocation: Location? = null
)

@Serializable
data class LocalNotification(
    val id: String,
    val title: String,
    val message: String,
    val created_at: String,
    val is_read: Boolean,
    val data: String? = null
)

@Serializable
data class PermissionState(
    val camera: String? = null,
    val notifications: String? = null,
    val files: String? = null,
    val location: String? = null,
    val lastPrompted: Long? = null
)

@Serializable
data class AdminAuth(
    val role: String,
    val locationId: String? = null,
    val email: String
)

object Storage {
    private const val PREFS_NAME = "boxitt_prefs"
    private const val AUTH_KEY = "boxitt_auth"
    private const val ADMIN_AUTH_KEY = "boxitt_admin_auth"
    private const val SUPER_ADMIN_SESSION_KEY = "boxitt_super_admin_active"
    private const val NAV_KEY = "boxitt_nav_state"
    private const val SESSION_FLAG = "boxitt_session_active"
    @PublishedApi
    internal const val PAGE_DATA_KEY = "boxitt_page_data_"
    private const val SESSION_PAGE_DATA_KEY = "boxitt_session_page_data_"
    private const val NOTIFICATIONS_KEY = "boxitt_notifications"
    private const val PERMISSIONS_KEY = "boxitt_permissions"
    const val MAX_LOCAL_NOTIFICATIONS = 200

    lateinit var prefs: SharedPreferences
    private var sessionActive: Boolean = false
    val sessionPageData = mutableMapOf<String, String>()

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!sessionActive) {
            sessionActive = true
            sessionPageData.clear()
            // Fresh start: Clear persistent page data to force re-sync from profile
            prefs.edit().apply {
                prefs.all.keys.forEach { key ->
                    if (key.startsWith(PAGE_DATA_KEY)) {
                        remove(key)
                    }
                }
                apply()
            }
        }
    }

    val json = Json { ignoreUnknownKeys = true }

    fun getUser(): User? {
        val data = prefs.getString(AUTH_KEY, null) ?: return null
        return try {
            json.decodeFromString<User>(data)
        } catch (e: Exception) {
            null
        }
    }

    fun setUser(user: User) {
        val data = json.encodeToString(user)
        prefs.edit().putString(AUTH_KEY, data).apply()
    }

    fun getAdminAuth(): AdminAuth? {
        val data = prefs.getString(ADMIN_AUTH_KEY, null) ?: return null
        return try {
            json.decodeFromString<AdminAuth>(data)
        } catch (e: Exception) {
            null
        }
    }

    fun setAdminAuth(auth: AdminAuth) {
        val data = json.encodeToString(auth)
        prefs.edit().putString(ADMIN_AUTH_KEY, data).apply()
    }

    fun setSuperAdminSession(isActive: Boolean) {
        prefs.edit().putBoolean(SUPER_ADMIN_SESSION_KEY, isActive).apply()
    }

    fun isSuperAdminSession(): Boolean {
        return prefs.getBoolean(SUPER_ADMIN_SESSION_KEY, false)
    }

    fun logout() {
        prefs.edit().apply {
            remove(AUTH_KEY)
            remove(ADMIN_AUTH_KEY)
            remove(SUPER_ADMIN_SESSION_KEY)
            remove(NAV_KEY)
            remove(NOTIFICATIONS_KEY)
            remove(PERMISSIONS_KEY)
            prefs.all.keys.forEach { key ->
                if (key.startsWith(PAGE_DATA_KEY)) {
                    remove(key)
                }
            }
            apply()
        }
        sessionActive = false
    }

    fun getNavState(): NavState? {
        val data = prefs.getString(NAV_KEY, null) ?: return null
        return try {
            json.decodeFromString<NavState>(data)
        } catch (e: Exception) {
            null
        }
    }

    fun setNavState(state: NavState) {
        val data = json.encodeToString(state)
        prefs.edit().putString(NAV_KEY, data).apply()
    }

    fun clearNavState() {
        prefs.edit().remove(NAV_KEY).apply()
    }

    inline fun <reified T> getPageState(pageId: String): T? {
        val persistentData = prefs.getString(PAGE_DATA_KEY + pageId, null)
        val sessionDataRaw = sessionPageData[pageId]
        
        val pMap = try {
            if (persistentData != null) Json.decodeFromString<Map<String, String>>(persistentData) else emptyMap()
        } catch (e: Exception) { emptyMap() }
        
        val sMap = try {
            if (sessionDataRaw != null) Json.decodeFromString<Map<String, String>>(sessionDataRaw) else emptyMap()
        } catch (e: Exception) { emptyMap() }
        
        val combined = pMap + sMap
        if (combined.isEmpty()) return null
        
        return try {
            // Convert combined map back to T
            Json.decodeFromString<T>(Json.encodeToString(combined))
        } catch (e: Exception) {
            null
        }
    }

    inline fun <reified T> setPageState(pageId: String, data: T) {
        // We need to know which keys are session-only. 
        // For simplicity, we'll handle this at the caller level or define a convention.
        // But since this is a reified function, we'll just save everything to persistent for now
        // and handle specific session overrides in the BookingPage.
        val dataStr = Json.encodeToString(data)
        prefs.edit().putString(PAGE_DATA_KEY + pageId, dataStr).apply()
    }

    fun setSessionPageState(pageId: String, data: Map<String, String>) {
        sessionPageData[pageId] = Json.encodeToString(data)
    }

    fun clearPageState(pageId: String) {
        prefs.edit().remove(PAGE_DATA_KEY + pageId).apply()
        sessionPageData.remove(pageId)
    }

    fun getNotifications(): List<LocalNotification> {
        val data = prefs.getString(NOTIFICATIONS_KEY, null) ?: return emptyList()
        val parsed = try {
            json.decodeFromString<List<LocalNotification>>(data)
        } catch (e: Exception) {
            emptyList()
        }
        val now = System.currentTimeMillis()
        val valid = parsed.filter { notif -> now <= getNotificationExpirationTime(notif) }
        if (valid.size != parsed.size) {
            val capped = valid.take(MAX_LOCAL_NOTIFICATIONS)
            prefs.edit().putString(NOTIFICATIONS_KEY, json.encodeToString(capped)).apply()
        }
        return valid
    }

    fun saveNotifications(notifs: List<LocalNotification>) {
        val now = System.currentTimeMillis()
        val valid = notifs.filter { notif -> now <= getNotificationExpirationTime(notif) }
        val deduped = mutableListOf<LocalNotification>()
        valid.forEach { notif ->
            if (deduped.none { it.id == notif.id }) {
                deduped.add(notif)
            }
        }
        val capped = deduped.take(MAX_LOCAL_NOTIFICATIONS)
        val data = json.encodeToString(capped)
        prefs.edit().putString(NOTIFICATIONS_KEY, data).apply()
    }

    fun addLocalNotification(notif: LocalNotification) {
        val current = getNotifications()
        if (current.any { it.id == notif.id }) return
        val updated = (listOf(notif) + current).take(MAX_LOCAL_NOTIFICATIONS)
        saveNotifications(updated)
    }

    fun getPermissions(): PermissionState {
        val data = prefs.getString(PERMISSIONS_KEY, null) ?: return PermissionState()
        return try {
            json.decodeFromString<PermissionState>(data)
        } catch (e: Exception) {
            PermissionState()
        }
    }

    fun setPermission(key: String, choice: String) {
        val current = getPermissions()
        val updated = when (key) {
            "camera" -> current.copy(camera = choice, lastPrompted = System.currentTimeMillis())
            "notifications" -> current.copy(notifications = choice, lastPrompted = System.currentTimeMillis())
            "files" -> current.copy(files = choice, lastPrompted = System.currentTimeMillis())
            "location" -> current.copy(location = choice, lastPrompted = System.currentTimeMillis())
            else -> current.copy(lastPrompted = System.currentTimeMillis())
        }
        val data = json.encodeToString(updated)
        prefs.edit().putString(PERMISSIONS_KEY, data).apply()
    }

    fun get(key: String, defaultValue: String? = null): String? {
        return prefs.getString(key, defaultValue)
    }

    fun set(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    // --- FAVORITES STORAGE ---
    fun getFavorites(): Set<String> {
        val data = prefs.getString("boxitt_favorites", null) ?: return emptySet()
        return try {
            json.decodeFromString<Set<String>>(data)
        } catch (e: Exception) {
            emptySet()
        }
    }

    fun toggleFavorite(id: String): Set<String> {
        val current = getFavorites()
        val updated = if (current.contains(id)) current - id else current + id
        val data = json.encodeToString(updated)
        prefs.edit().putString("boxitt_favorites", data).apply()
        return updated
    }
}



