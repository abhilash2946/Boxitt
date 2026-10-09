package com.boxitt.app.services

import com.boxitt.app.AppNotification
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

object NotificationService {

    // Session-level resilience (Parity with Web notificationsUnavailableRef)
    var notificationsUnavailable: Boolean = false

    suspend fun insertNotificationsSafely(notifications: List<Map<String, Any?>>): Int {
        if (notifications.isEmpty() || notificationsUnavailable) return 0
        
        return try {
            val validNotifications = notifications.filter { it["user_id"] != null }
            if (validNotifications.isEmpty()) return 0

            val payload = validNotifications.map { map ->
                buildJsonObject {
                    map.forEach { (key, value) ->
                        when (value) {
                            is String -> put(key, value)
                            is Number -> put(key, value)
                            is Boolean -> put(key, value)
                            is Map<*, *> -> {
                                // Handle nested maps (like the 'data' field)
                                put(key, buildJsonObject {
                                    value.forEach { (k, v) ->
                                        if (k is String) {
                                            when (v) {
                                                is String -> put(k, v)
                                                is Number -> put(k, v)
                                                is Boolean -> put(k, v)
                                                null -> put(k, JsonNull)
                                            }
                                        }
                                    }
                                })
                            }
                            null -> put(key, JsonNull)
                        }
                    }
                }
            }

            Supabase.client.postgrest["notifications"].insert(payload)
            payload.size
        } catch (e: Exception) {
            e.printStackTrace()
            val msg = e.message?.lowercase() ?: ""
            // Detect if table is missing or type mismatch (Parity with Web)
            if (msg.contains("404") || msg.contains("42p01") || msg.contains("pgrst205") || msg.contains("text = uuid")) {
                notificationsUnavailable = true
            }
            0
        }
    }

    suspend fun updateNotificationMessage(userId: String, title: String, newMessage: String) {
        if (notificationsUnavailable) return
        try {
            // Find the latest notification matching criteria
            val latest = Supabase.client.postgrest["notifications"].select {
                filter {
                    eq("user_id", userId)
                    eq("title", title)
                }
                order("created_at", Order.DESCENDING)
                limit(1)
            }.decodeList<Map<String, String>>().firstOrNull()

            latest?.get("id")?.let { id ->
                Supabase.client.postgrest["notifications"].update({
                    set("message", newMessage)
                }) {
                    filter {
                        eq("id", id)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun broadcastNewChallenge(
        userId: String,
        userName: String,
        userPhone: String,
        locationId: String,
        locationName: String,
        latitude: Double,
        longitude: Double,
        slotTime: String,
        date: String,
        bookingId: String,
        isChallenge: Boolean,
        isJoinable: Boolean,
        startHour: Double = 0.0,
        endHour: Double = 0.0
    ) {
        try {
            // Helper to broadcast one type of notification (Parity with Web)
            suspend fun broadcast(type: String) {
                val isTypeChallenge = type == "challenge"
                val creatorTitle = if (isTypeChallenge) "CHALLENGE CREATED!" else "JOINABLE CREATED!"
                val broadcastTitle = if (isTypeChallenge) "NEW CHALLENGE NEARBY!" else "NEW JOINABLE NEARBY!"
                val creatorMsgType = if (isTypeChallenge) "challenge" else "joinable match"
                val broadcastMsgVerb = if (isTypeChallenge) "challenged others" else "shared a joinable match"

                val creatorNote = mapOf(
                    "user_id" to userId,
                    "title" to creatorTitle,
                    "message" to "Your $creatorMsgType at $locationName on $date for $slotTime has been created and is being shared with nearby players...",
                    "is_read" to false,
                    "data" to mapOf(
                        "type" to if (isTypeChallenge) "challenge_created" else "joinable_created",
                        "booking_id" to bookingId,
                        "location_name" to locationName,
                        "date" to date,
                        "slot_time" to slotTime,
                        "start_hour" to startHour.toString(),
                        "end_hour" to endHour.toString()
                    )
                )
                insertNotificationsSafely(listOf(creatorNote))

                // 2. Fetch nearby users
                val nearbyUsers = try {
                    val params = buildJsonObject {
                        put("lat", latitude)
                        put("lng", longitude)
                        put("radius_km", 5)
                    }
                    Supabase.client.postgrest.rpc("get_nearby_users", params).decodeList<Map<String, String>>()
                } catch (e: Exception) {
                    try {
                        Supabase.client.postgrest["user_profiles"].select(io.github.jan.supabase.postgrest.query.Columns.list("id")).decodeList<Map<String, String>>()
                    } catch (e2: Exception) {
                        emptyList<Map<String, String>>()
                    }
                }

                val otherUsers = nearbyUsers.filter { it["id"] != userId }

                if (otherUsers.isNotEmpty()) {
                    val broadcastNotes = otherUsers.map { u ->
                        mapOf(
                            "user_id" to u["id"],
                            "title" to broadcastTitle,
                            "message" to "$userName ($userPhone) has $broadcastMsgVerb at $locationName on $date for the $slotTime slots",
                            "is_read" to false,
                            "data" to mapOf(
                                "type" to if (isTypeChallenge) "challenge" else "joinable_match",
                                "booking_id" to bookingId,
                                "challenger_id" to userId,
                                "location_name" to locationName,
                                "date" to date,
                                "slot_time" to slotTime,
                                "start_hour" to startHour.toString(),
                                "end_hour" to endHour.toString()
                            )
                        )
                    }
                    val sentCount = insertNotificationsSafely(broadcastNotes)

                    if (sentCount > 0) {
                        val updateMsg = "Your $creatorMsgType at $locationName on $date for $slotTime has been created and shared with nearby $sentCount players."
                        updateNotificationMessage(userId, creatorTitle, updateMsg)
                    }
                } else {
                    val updateMsg = "Your $creatorMsgType at $locationName on $date for $slotTime has been created, but no other players were found nearby."
                    updateNotificationMessage(userId, creatorTitle, updateMsg)
                }
            }

            if (isChallenge) broadcast("challenge")
            if (isJoinable) broadcast("joinable")

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun sendJoinRequestNotifications(
        hostId: String,
        joinerId: String,
        joinerName: String,
        joinerPhone: String,
        groupSize: Int,
        locationName: String,
        date: String,
        slotTime: String,
        bookingId: String
    ) {
        val notes = listOf(
            mapOf(
                "user_id" to hostId,
                "title" to "New joinable Request",
                "message" to "$joinerName ($joinerPhone) requested to join with $groupSize player(s) for your match on $date at $slotTime.",
                "is_read" to false,
                "data" to mapOf(
                    "type" to "match_join_request",
                    "booking_id" to bookingId,
                    "requester_id" to joinerId,
                    "groupSize" to groupSize.toString(),
                    "playerName" to joinerName,
                    "phone" to joinerPhone
                )
            ),
            mapOf(
                "user_id" to joinerId,
                "title" to "Request Sent",
                "message" to "Your join request for the match at $locationName on $date has been sent.",
                "is_read" to false,
                "data" to mapOf(
                    "type" to "match_join_request_sent",
                    "booking_id" to bookingId,
                    "host_id" to hostId
                )
            )
        )
        insertNotificationsSafely(notes)
    }

    suspend fun getNotifications(userId: String): Result<List<AppNotification>> = withContext(Dispatchers.IO) {
        try {
            val result = Supabase.client.postgrest["notifications"].select {
                filter {
                    eq("user_id", userId)
                }
                order("created_at", Order.DESCENDING)
            }.decodeList<AppNotification>()
            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteNotification(id: String) = withContext(Dispatchers.IO) {
        Supabase.client.postgrest["notifications"].delete {
            filter {
                eq("id", id)
            }
        }
    }

    suspend fun clearAllNotifications(userId: String) = withContext(Dispatchers.IO) {
        Supabase.client.postgrest["notifications"].delete {
            filter {
                eq("user_id", userId)
            }
        }
    }
}
