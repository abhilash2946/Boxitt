package com.boxitt.app.services

import com.boxitt.app.*
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

@Serializable
data class BookingInsert(
    val id: String,
    val name: String,
    val phone: String,
    val date: String,
    val location_id: String,
    val court_id: String? = null,
    val slot_id: String,
    val slot_time: String,
    val start_hour: Double,
    val end_hour: Double,
    val duration: String,
    val amount: Double,
    val advance_paid: Double,
    val status: String,
    val payment_method: String,
    val payment_type: String,
    val checked_in: Boolean,
    val created_at: String,
    val booked_by: String,
    val is_joinable: Boolean,
    val max_players: Int,
    val current_players: Int,
    val sport: String,
    val user_id: String? = null,
    val auto_delete_at: String? = null
)

@Serializable
data class ChallengeDetails(
    val id: String,
    val challenger_id: String,
    val accepted_by: String? = null,
    val box_id: String,
    val slot_time: String = "",
    val date: String = "",
    val location_id: String? = null,
    val status: String = "pending",
    val challenger: UserProfile? = null,
    val acceptor: UserProfile? = null,
    val location: Location? = null
) {
    val slotTime: String get() = slot_time
    val locationId: String? get() = location_id
}

@Serializable
private data class ChallengeRawMinimal(
    val id: String,
    val challenger_id: String? = null,
    val accepted_by: String? = null,
    val box_id: String? = null,
    val location_id: String? = null,
    val slot_time: String? = null,
    val date: String? = null,
    val status: String? = null
)

object BookingService {

    suspend fun getBookings(locationId: String, date: String? = null): List<Booking> {
        if (locationId.isBlank()) return emptyList()
        return try {
            val data = Supabase.client.postgrest["bookings"].select {
                filter {
                    eq("location_id", locationId)
                    if (date != null) {
                        eq("date", date)
                    }
                }
                order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            }.decodeList<Booking>()
            data
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getBookingById(id: String): Booking? {
        return try {
            val data = Supabase.client.postgrest["bookings"].select {
                filter {
                    eq("id", id)
                }
                single()
            }.decodeAs<Booking>()
            data
        } catch (e: Exception) {
            null
        }
    }

    suspend fun getChallengeById(id: String): ChallengeDetails? {
        return try {
            val raw = Supabase.client.postgrest["challenges"].select {
                filter { eq("id", id) }
                single()
            }.decodeAs<ChallengeRawMinimal>()

            var challenger: UserProfile? = null
            var acceptor: UserProfile? = null
            var location: Location? = null

            if (!raw.challenger_id.isNullOrBlank()) {
                try {
                    challenger = Supabase.client.postgrest["user_profiles"].select {
                        filter { eq("id", raw.challenger_id) }
                        single()
                    }.decodeAs<UserProfile>()
                } catch (_: Exception) {}
            }

            if (!raw.accepted_by.isNullOrBlank()) {
                try {
                    acceptor = Supabase.client.postgrest["user_profiles"].select {
                        filter { eq("id", raw.accepted_by) }
                        single()
                    }.decodeAs<UserProfile>()
                } catch (_: Exception) {}
            }

            val locId = raw.box_id ?: raw.location_id
            if (!locId.isNullOrBlank()) {
                try {
                    location = Supabase.client.postgrest["locations"].select {
                        filter { eq("id", locId) }
                        single()
                    }.decodeAs<Location>()
                } catch (_: Exception) {}
            }

            return ChallengeDetails(
                id = raw.id,
                challenger_id = raw.challenger_id ?: "",
                accepted_by = raw.accepted_by,
                box_id = locId ?: "",
                slot_time = raw.slot_time ?: "",
                date = raw.date ?: "",
                location_id = raw.location_id,
                status = raw.status ?: "pending",
                challenger = challenger,
                acceptor = acceptor,
                location = location
            )
        } catch (e: Exception) {
            null
        }
    }

    suspend fun saveBooking(booking: Booking): Result<Booking> {
        return try {
            // Web Parity: Generate proper UUID if ID is empty or using client-side placeholder 'BK-'
            val generatedId = if (booking.id.isEmpty() || booking.id.startsWith("BK-")) {
                UUID.randomUUID().toString()
            } else {
                booking.id
            }

            val bookingData = BookingInsert(
                id = generatedId,
                name = booking.name,
                phone = booking.phone,
                date = booking.date,
                location_id = booking.locationId,
                court_id = booking.courtId?.takeIf { it.isNotBlank() },
                slot_id = booking.slotId,
                slot_time = booking.slotTime,
                start_hour = booking.startHour,
                end_hour = booking.endHour,
                duration = booking.duration,
                amount = booking.amount,
                advance_paid = booking.advancePaid,
                status = booking.status.value,
                payment_method = booking.paymentMethod,
                payment_type = booking.paymentType,
                checked_in = booking.checkedIn,
                created_at = booking.createdAt.ifBlank {
                    java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
                },
                booked_by = booking.bookedBy,
                is_joinable = booking.isJoinable,
                max_players = booking.maxPlayers,
                current_players = booking.currentPlayers,
                sport = booking.sport,
                user_id = booking.userId,
                auto_delete_at = booking.auto_delete_at
            )

            android.util.Log.d("BookingService", "Inserting booking: $bookingData")

            val inserted = Supabase.client.postgrest["bookings"].insert(bookingData) {
                select()
                single()
            }.decodeAs<Booking>()

            android.util.Log.d("BookingService", "Successfully saved: ${inserted.id}")
            Result.success(inserted)
        } catch (e: Exception) {
            android.util.Log.e("BookingService", "Failed to save booking", e)
            Result.failure(e)
        }
    }

    suspend fun checkAndApplyTimeout(booking: Booking): Booking {
        if (booking.status != BookingStatus.BOOKED &&
            booking.status != BookingStatus.APPROVED &&
            booking.status != BookingStatus.PENDING &&
            booking.status != BookingStatus.TIMED_OUT
        ) {
            return booking
        }

        try {
            val now = java.util.Calendar.getInstance()
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
            val today = sdf.format(now.time)
            
            val slotEndHour = booking.endHour
            val currentHour = now.get(java.util.Calendar.HOUR_OF_DAY) + (now.get(java.util.Calendar.MINUTE) / 60.0)

            val isToday = booking.date == today
            val isPastDate = booking.date < today

            var shouldBeTimedOut = false

            if (isPastDate) {
                shouldBeTimedOut = true
            } else if (isToday) {
                // Add 1 minute grace period
                if (currentHour > (slotEndHour + 0.0166)) {
                    shouldBeTimedOut = true
                }
            }

            if (shouldBeTimedOut && booking.status != BookingStatus.TIMED_OUT) {
                val success = updateBooking(booking.id, status = BookingStatus.TIMED_OUT)
                if (success) return booking.copy(status = BookingStatus.TIMED_OUT)
            } else if (!shouldBeTimedOut && booking.status == BookingStatus.TIMED_OUT) {
                val success = updateBooking(booking.id, status = BookingStatus.BOOKED)
                if (success) return booking.copy(status = BookingStatus.BOOKED)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return booking
    }

    suspend fun updateBooking(
        id: String,
        status: BookingStatus? = null,
        checkedIn: Boolean? = null,
        isJoinable: Boolean? = null
    ): Boolean {
        return try {
            Supabase.client.postgrest["bookings"].update({
                if (status != null) set("status", status.value)
                if (checkedIn != null) set("checked_in", checkedIn)
                if (isJoinable != null) set("is_joinable", isJoinable)
            }) {
                filter {
                    eq("id", id)
                }
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    suspend fun updateChallenge(id: String, updates: Map<String, String>): Boolean {
        return try {
            Supabase.client.postgrest["challenges"].update({
                updates.forEach { (key, value) ->
                    set(key, value)
                }
            }) {
                filter {
                    eq("id", id)
                }
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    suspend fun addJoinRequest(
        bookingId: String,
        playerName: String,
        phone: String,
        count: Int = 1,
        joinerId: String? = null
    ): Boolean {
        return try {
            val bId = bookingId.trim()
            val jId = joinerId?.trim() ?: return false
            
            @Serializable
            data class AcceptParams(
                val p_booking_id: String,
                val p_requester_id: String,
                val p_player_name: String,
                val p_phone: String,
                val p_count: Int
            )

            Supabase.client.postgrest.rpc(
                "accept_match_join_request",
                AcceptParams(bId, jId, playerName, phone, count)
            )
            true
        } catch (e: Exception) {
            false
        }
    }

    suspend fun sendJoinRequest(
        booking: Booking,
        user: User,
        count: Int = 1,
        customName: String? = null,
        customPhone: String? = null
    ): Boolean {
        return try {
            val bookingId = booking.id.trim()
            val requesterId = user.id?.trim() ?: return false
            val groupSize = count.coerceAtLeast(1)

            @Serializable
            data class SubmitParams(
                val p_booking_id: String,
                val p_requester_id: String,
                val p_player_name: String,
                val p_phone: String,
                val p_group_size: Int,
                val p_requester_details: JsonObject
            )

            val requesterDetails = buildJsonObject {
                put("username", user.display_name ?: "")
                put("display_name", customName ?: user.display_name ?: "")
                put("phone_number", customPhone ?: user.phone_number ?: "")
                put("avatar_url", user.avatar_url ?: "")
            }

            Supabase.client.postgrest.rpc(
                "submit_match_join_request",
                SubmitParams(
                    p_booking_id = bookingId,
                    p_requester_id = requesterId,
                    p_player_name = customName ?: user.displayName ?: user.email.ifBlank { null } ?: "User",
                    p_phone = customPhone ?: user.phoneNumber ?: "N/A",
                    p_group_size = groupSize,
                    p_requester_details = requesterDetails
                )
            )
            true
        } catch (e: Exception) {
            throw e
        }
    }

    suspend fun cancelJoinRequest(bookingId: String, userId: String): Boolean {
        return try {
            val bId = bookingId.trim()
            val uId = userId.trim()
            if (bId.isEmpty() || uId.isEmpty()) return false

            @Serializable
            data class CancelParams(
                val p_booking_id: String,
                val p_requester_id: String
            )

            Supabase.client.postgrest.rpc(
                "cancel_match_join_request",
                CancelParams(bId, uId)
            )
            true
        } catch (e: Exception) {
            false
        }
    }
}




