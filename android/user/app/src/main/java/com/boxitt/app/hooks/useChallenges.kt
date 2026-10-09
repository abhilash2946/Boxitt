package com.boxitt.app.hooks

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.boxitt.app.Booking
import com.boxitt.app.Location
import com.boxitt.app.UserProfile
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Serializable
data class ChallengeFeedItem(
    val id: String,
    val challenger_id: String,
    val accepted_by: String? = null,
    val box_id: String,
    val booking_id: String? = null,
    val slot_time: String? = null,
    val date: String? = null,
    val start_hour: Double? = null,
    val end_hour: Double? = null,
    val status: String? = null,
    val created_at: String? = null,
    val auto_delete_at: String? = null,
    
    // UI details
    val type: String, // "challenge" or "match"
    val challenger: UserProfile? = null,
    val box: Location? = null,
    val requests: List<ChallengeRequestDetail> = emptyList(),
    val isExpired: Boolean = false,
    val removeAtTs: Long = 0
)

@Serializable
data class ChallengeRequestDetail(
    val requester_id: String,
    val requester: UserProfile? = null,
    val created_at: String? = null,
    val notification_id: String? = null
)

@Serializable
private data class DbChallenge(
    val id: String,
    val challenger_id: String,
    val accepted_by: String? = null,
    val box_id: String,
    val booking_id: String? = null,
    val slot_time: String? = null,
    val date: String? = null,
    val start_hour: Double? = null,
    val end_hour: Double? = null,
    val status: String? = null,
    val created_at: String? = null,
    val auto_delete_at: String? = null
)

@Serializable
private data class DbNotification(
    val id: String,
    val user_id: String,
    val created_at: String,
    val data: JsonObject? = null
)

class ChallengesViewModel(private val scope: CoroutineScope) {
    var feedItems by mutableStateOf<List<ChallengeFeedItem>>(emptyList())
        private set
    var userSentRequests by mutableStateOf<List<String>>(emptyList())
        private set
    var userAcceptedChallenges by mutableStateOf<List<String>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMsg by mutableStateOf<String?>(null)
        private set

    private fun isVisibleChallengeStatus(status: String?): Boolean {
        if (status == null) return true
        val normalized = status.trim().lowercase()
        return listOf("active", "pending_confirmation", "confirmed", "accepted", "pending", "open").contains(normalized)
    }

    private fun parseDateParts(dateStr: String): Triple<Int, Int, Int>? {
        if (dateStr.isBlank()) return null
        return try {
            if (dateStr.contains("-")) {
                val parts = dateStr.split("-").map { it.toInt() }
                Triple(parts[0], parts[1], parts[2])
            } else if (dateStr.contains("/")) {
                val parts = dateStr.split("/").map { it.toInt() }
                Triple(parts[2], parts[1], parts[0])
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun toDateStartTs(dateStr: String): Long {
        val parts = parseDateParts(dateStr) ?: return 0L
        val cal = java.util.Calendar.getInstance()
        cal.set(parts.first, parts.second - 1, parts.third, 0, 0, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    private fun getEndTime(dateStr: String, slotTime: String, startHour: Double?, endHour: Double?): Long {
        try {
            if (dateStr.isBlank()) return 0L
            if (startHour != null && endHour != null) {
                val parts = parseDateParts(dateStr) ?: return 0L
                val cal = java.util.Calendar.getInstance()
                cal.set(parts.first, parts.second - 1, parts.third, 0, 0, 0)
                cal.set(java.util.Calendar.MILLISECOND, 0)
                val startMinutes = Math.round(startHour * 60).toInt()
                var endMinutes = Math.round(endHour * 60).toInt()
                if (endMinutes <= startMinutes) endMinutes += 24 * 60
                cal.add(java.util.Calendar.MINUTE, endMinutes)
                return cal.timeInMillis
            }

            if (slotTime.isBlank() || slotTime == "TBA") return 0L
            val rangeParts = slotTime.split("-").map { it.trim() }.filter { it.isNotEmpty() }
            val lastPart = rangeParts.lastOrNull() ?: slotTime.trim()
            val pattern = Regex("(\\d{1,2})(?::(\\d{2}))?\\s*(AM|PM)", RegexOption.IGNORE_CASE)
            val match = pattern.find(lastPart) ?: return 0L
            
            var hours = match.groupValues[1].toInt()
            val minutes = if (match.groupValues[2].isNotEmpty()) match.groupValues[2].toInt() else 0
            val modifier = match.groupValues[3].uppercase()
            
            if (modifier == "PM" && hours < 12) hours += 12
            if (modifier == "AM" && hours == 12) hours = 0

            val parts = parseDateParts(dateStr) ?: return 0L
            val cal = java.util.Calendar.getInstance()
            cal.set(parts.first, parts.second - 1, parts.third, hours, minutes, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)
            return cal.timeInMillis
        } catch (e: Exception) {
            return 0L
        }
    }

    fun fetchChallengeFeed(selectedLocationId: String? = null, userId: String? = null) {
        if (userId == null) return
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

                // 1. Fetch Challenges
                val challengesDeferred = async(Dispatchers.IO) {
                    try {
                        Supabase.client.postgrest["challenges"].select {
                            filter {
                                if (selectedLocationId != null) {
                                    eq("box_id", selectedLocationId)
                                }
                            }
                            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                        }.decodeList<DbChallenge>()
                    } catch (e: Exception) {
                        emptyList<DbChallenge>()
                    }
                }

                // 2. Fetch Joinable Bookings (matches)
                val matchesDeferred = async(Dispatchers.IO) {
                    try {
                        Supabase.client.postgrest["bookings"].select {
                            filter {
                                eq("is_joinable", true)
                                if (selectedLocationId != null) {
                                    eq("location_id", selectedLocationId)
                                }
                            }
                            order("date", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
                        }.decodeList<Booking>()
                    } catch (e: Exception) {
                        emptyList<Booking>()
                    }
                }

                val rawChallenges = challengesDeferred.await().filter { isVisibleChallengeStatus(it.status) }
                val rawMatches = matchesDeferred.await()

                val ownChallengeIds = rawChallenges.filter { it.challenger_id == userId }.map { it.id }.toSet()

                // Collect unique user/location IDs
                val allUserIds = (rawChallenges.map { it.challenger_id } +
                        rawChallenges.mapNotNull { it.accepted_by } +
                        rawMatches.mapNotNull { it.userId }).filter { it.isNotBlank() }.distinct()

                val allLocationIds = (rawChallenges.map { it.box_id } +
                        rawMatches.map { it.locationId }).filter { it.isNotBlank() }.distinct()

                val challengeBookingIds = rawChallenges.mapNotNull { it.booking_id }.filter { it.isNotBlank() }.distinct()

                // 3. Fetch related details in parallel
                val usersDeferred = async(Dispatchers.IO) {
                    if (allUserIds.isEmpty()) emptyList()
                    else Supabase.client.postgrest["user_profiles"].select {
                        filter {
                            isIn("id", allUserIds)
                        }
                    }.decodeList<UserProfile>()
                }

                val locationsDeferred = async(Dispatchers.IO) {
                    if (allLocationIds.isEmpty()) emptyList()
                    else Supabase.client.postgrest["locations"].select {
                        filter {
                            isIn("id", allLocationIds)
                        }
                    }.decodeList<Location>()
                }

                val bookingsDeferred = async(Dispatchers.IO) {
                    if (challengeBookingIds.isEmpty()) emptyList()
                    else Supabase.client.postgrest["bookings"].select {
                        filter {
                            isIn("id", challengeBookingIds)
                        }
                    }.decodeList<Booking>()
                }

                val notifsDeferred = async(Dispatchers.IO) {
                    try {
                        Supabase.client.postgrest["notifications"].select {
                            filter {
                                eq("user_id", userId)
                            }
                            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                        }.decodeList<DbNotification>()
                    } catch (e: Exception) {
                        emptyList<DbNotification>()
                    }
                }

                val usersMap = usersDeferred.await().associateBy { it.id }
                val locationsMap = locationsDeferred.await().associateBy { it.id }
                val challengeBookingsMap = bookingsDeferred.await().associateBy { it.id }
                val notifications = notifsDeferred.await()

                // Requesters maps from notifications
                val requestersByChallenge = mutableMapOf<String, MutableList<ChallengeRequestDetail>>()
                val requestChallengeIds = mutableSetOf<String>()
                val acceptedChallengeIds = mutableSetOf<String>()

                notifications.forEach { notif ->
                    val type = notif.data?.get("type")?.jsonPrimitive?.contentOrNull
                    val challengeId = notif.data?.get("challenge_id")?.jsonPrimitive?.contentOrNull
                    val requesterId = notif.data?.get("requester_id")?.jsonPrimitive?.contentOrNull

                    if ((type == "challenge_request" || type == "challenge_waiting_payment" || type == "challenge_payment_pending") && challengeId != null && requesterId != null && ownChallengeIds.contains(challengeId)) {
                        val details = requestersByChallenge.getOrPut(challengeId) { mutableListOf() }
                        if (details.none { it.requester_id == requesterId }) {
                            details.add(
                                ChallengeRequestDetail(
                                    requester_id = requesterId,
                                    requester = usersMap[requesterId],
                                    created_at = notif.created_at,
                                    notification_id = notif.id
                                )
                            )
                        }
                    }

                    if ((type == "challenge_request_sent" || type == "challenge_payment_pending") && challengeId != null) {
                        requestChallengeIds.add(challengeId)
                    }
                    if ((type == "challenge_confirmed" || type == "challenge_confirmed_host" || type == "challenge_payment_pending" || type == "challenge_waiting_payment") && challengeId != null) {
                        acceptedChallengeIds.add(challengeId)
                        requestChallengeIds.add(challengeId)
                    }
                }

                rawChallenges.forEach { c ->
                    if (c.accepted_by == userId) {
                        requestChallengeIds.add(c.id)
                        acceptedChallengeIds.add(c.id)
                    }
                }

                userSentRequests = requestChallengeIds.toList()
                userAcceptedChallenges = acceptedChallengeIds.toList()

                // Format challenges
                val formattedChallenges = rawChallenges.map { c ->
                    val linkedBooking = challengeBookingsMap[c.booking_id]
                    val slotTime = c.slot_time ?: linkedBooking?.slotTime ?: "TBA"
                    val challengeDate = c.date ?: linkedBooking?.date ?: c.created_at?.split("T")?.firstOrNull() ?: todayStr
                    
                    ChallengeFeedItem(
                        id = c.id,
                        challenger_id = c.challenger_id,
                        accepted_by = c.accepted_by,
                        box_id = c.box_id,
                        booking_id = c.booking_id,
                        slot_time = slotTime,
                        date = challengeDate,
                        start_hour = c.start_hour ?: linkedBooking?.startHour?.toDouble(),
                        end_hour = c.end_hour ?: linkedBooking?.endHour?.toDouble(),
                        status = c.status,
                        created_at = c.created_at,
                        auto_delete_at = c.auto_delete_at,
                        type = "challenge",
                        challenger = usersMap[c.challenger_id],
                        box = locationsMap[c.box_id],
                        requests = requestersByChallenge[c.id] ?: (c.accepted_by?.let {
                            listOf(ChallengeRequestDetail(it, usersMap[it]))
                        } ?: emptyList())
                    )
                }

                // Format matches
                val formattedMatches = rawMatches.filter { m ->
                    val status = m.status.value.lowercase()
                    val hasSpots = m.currentPlayers < m.maxPlayers
                    val joinableState = status == "booked" || status == "confirmed" || status == "approved" || status == "pending" || status == "active" || status == "open" || status.isEmpty()
                    hasSpots && joinableState
                }.map { m ->
                    ChallengeFeedItem(
                        id = m.id,
                        challenger_id = m.userId ?: "",
                        box_id = m.locationId,
                        slot_time = m.slotTime,
                        date = m.date,
                        start_hour = m.startHour.toDouble(),
                        end_hour = m.endHour.toDouble(),
                        status = m.status.value,
                        created_at = m.createdAt,
                        auto_delete_at = m.auto_delete_at,
                        type = "match",
                        challenger = m.userId?.let { usersMap[it] },
                        box = locationsMap[m.locationId]
                    )
                }

                val combined = formattedChallenges + formattedMatches
                val now = System.currentTimeMillis()

                feedItems = combined.map { item ->
                    val endTime = getEndTime(item.date ?: "", item.slot_time ?: "", item.start_hour, item.end_hour)
                    val dateStartTs = toDateStartTs(item.date ?: "")
                    val autoDeleteTs = item.auto_delete_at?.let {
                        try {
                            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(it)?.time
                        } catch (e: Exception) {
                            null
                        }
                    } ?: 0L
                    
                    val fallbackRemoveAtTs = if (dateStartTs > 0) (dateStartTs + (26 * 60 * 60 * 1000)) else 0L
                    val removeAtTs = if (autoDeleteTs > 0) {
                        autoDeleteTs
                    } else {
                        if (endTime > 0) endTime + (2 * 60 * 60 * 1000) else fallbackRemoveAtTs
                    }

                    item.copy(
                        isExpired = endTime in 1 until now,
                        removeAtTs = removeAtTs
                    )
                }.filter { item ->
                    if (item.removeAtTs > 0) item.removeAtTs > now else true
                }.sortedWith { a, b ->
                    if (a.isExpired != b.isExpired) {
                        if (a.isExpired) 1 else -1
                    } else {
                        val isOwnA = (a.challenger_id != null && a.challenger_id == userId) || (a.user_id != null && a.user_id == userId)
                        val isOwnB = (b.challenger_id != null && b.challenger_id == userId) || (b.user_id != null && b.user_id == userId)
                        if (isOwnA != isOwnB) {
                            if (isOwnA) -1 else 1
                        } else {
                            val dateA = try { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).parse(a.date ?: "").time } catch (e: Exception) { 0L }
                            val dateB = try { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).parse(b.date ?: "").time } catch (e: Exception) { 0L }
                            if (dateA != dateB) {
                                dateA.compareTo(dateB)
                            } else {
                                val startA = a.start_hour ?: 0.0
                                val startB = b.start_hour ?: 0.0
                                startA.compareTo(startB)
                            }
                        }
                    }
                }

            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to load feed"
            } finally {
                isLoading = false
            }
        }
    }
}




