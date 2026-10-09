package com.boxitt.app.hooks

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.boxitt.app.BookingStatus
import com.boxitt.app.LocationNameOnly
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class BookingWithArena(
    val id: String,
    val name: String,
    val phone: String,
    val date: String,
    val locationId: String,
    val slotId: String,
    val slotTime: String,
    val startHour: Double,
    val endHour: Double,
    val duration: String,
    val amount: Double,
    val advancePaid: Double,
    val status: BookingStatus,
    val paymentMethod: String,
    val paymentType: String,
    val checkedIn: Boolean,
    val createdAt: String,
    val bookedBy: String,
    val userId: String? = null,
    val isJoinable: Boolean,
    val maxPlayers: Int,
    val currentPlayers: Int,
    val joinRequests: List<com.boxitt.app.JoinRequest> = emptyList(),
    val sport: String,
    val arenaName: String = "Unknown Arena",
    val courtName: String = "Unknown Court",
    val courtId: String? = null,
    val paymentId: String? = null,
    val ticketIndex: Int = 0
)

@Serializable
private data class DbBookingWithLocations(
    val id: String,
    val name: String = "",
    val phone: String = "",
    val date: String = "",
    val location_id: String,
    val court_id: String? = null,
    val slot_id: String = "",
    val slot_time: String = "",
    val start_hour: Double = 0.0,
    val end_hour: Double = 0.0,
    val duration: String = "1",
    val amount: Double = 0.0,
    val advance_paid: Double? = null,
    val status: String = "pending",
    val payment_method: String = "Cash",
    val payment_type: String = "advance",
    val checked_in: Boolean = false,
    val created_at: String = "",
    val booked_by: String = "",
    val user_id: String? = null,
    val is_joinable: Boolean = false,
    val max_players: Int = 1,
    val current_players: Int = 1,
    val join_requests: List<com.boxitt.app.JoinRequest>? = null,
    val sport: String = ""
)

@Serializable
private data class CourtNameOnly(
    val id: String,
    val name: String? = null,
    val court_number: Int
)

@Serializable
private data class DbUserPayment(
    val id: String = "",
    val booking_id: String = "",
    val user_id: String? = null,
    val amount: Double = 0.0,
    val payment_type: String = "full",
    val payment_method: String = "Online",
    val created_at: String = ""
)

class TransactionsViewModel(private val scope: CoroutineScope) {
    var transactionsList by mutableStateOf<List<BookingWithArena>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMsg by mutableStateOf<String?>(null)
        private set

    fun fetchUserTransactions(userId: String?) {
        android.util.Log.d("TransactionsVM", "Fetching for userId: $userId")
        if (userId.isNullOrBlank()) {
            transactionsList = emptyList()
            return
        }
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                // 1. Fetch locations and courts map
                val locationMap = try {
                    Supabase.client.postgrest["locations"].select(Columns.raw("id, name"))
                        .decodeList<LocationNameOnly>()
                        .associate { it.id to it.name }
                } catch (e: Exception) {
                    android.util.Log.e("TransactionsVM", "Location fetch failed", e)
                    emptyMap<String, String>()
                }

                val courtMap = try {
                    Supabase.client.postgrest["courts"].select(Columns.raw("id, name, court_number"))
                        .decodeList<CourtNameOnly>()
                        .associate { it.id to (it.name ?: "Court ${it.court_number}") }
                } catch (e: Exception) {
                    android.util.Log.e("TransactionsVM", "Court fetch failed", e)
                    emptyMap<String, String>()
                }

                // 2. Fetch user payments from payments table
                val userPayments = try {
                    Supabase.client.postgrest["payments"].select {
                        filter { eq("user_id", userId) }
                        order("created_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
                    }.decodeList<DbUserPayment>()
                } catch (e: Exception) {
                    emptyList()
                }

                val userPaymentsByBooking = userPayments.groupBy { it.booking_id }

                // 3. Fetch bookings owned or joined by user
                val ownedData = try {
                    Supabase.client.postgrest["bookings"].select(Columns.raw("*, join_requests(*)")) {
                        filter {
                            or {
                                eq("user_id", userId)
                                eq("booked_by", userId)
                            }
                        }
                        order("date", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                    }.decodeList<DbBookingWithLocations>()
                } catch (e: Exception) {
                    android.util.Log.e("TransactionsVM", "Owned bookings fetch failed", e)
                    emptyList()
                }

                val joinedData = try {
                    Supabase.client.postgrest["bookings"].select(Columns.raw("*, join_requests(*)")) {
                        order("date", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                        limit(500)
                    }.decodeList<DbBookingWithLocations>().filter { b ->
                        val reqs = b.join_requests ?: emptyList()
                        reqs.any { r ->
                            val rId = (r.requesterId ?: "").toString()
                            rId.equals(userId, ignoreCase = true) && r.status.lowercase() == "accepted"
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("TransactionsVM", "Joined matches fetch failed", e)
                    emptyList()
                }

                val combined = (ownedData + joinedData).distinctBy { it.id }
                    .sortedByDescending { it.date }

                val mappedList = mutableListOf<BookingWithArena>()
                val processedBookingIds = mutableSetOf<String>()

                combined.forEach { b ->
                    if (processedBookingIds.contains(b.id)) return@forEach
                    processedBookingIds.add(b.id)

                    val isHost = b.user_id.equals(userId, ignoreCase = true) || b.booked_by.equals(userId, ignoreCase = true)
                    val userJoinReqs = (b.join_requests ?: emptyList()).filter {
                        val rId = (it.requesterId ?: "").toString()
                        rId.equals(userId, ignoreCase = true) && it.status.lowercase() == "accepted"
                    }.sortedBy { it.requestedAt }

                    val isCheckedIn = if (isHost) b.checked_in || b.status.lowercase() == "confirmed" else (userJoinReqs.firstOrNull()?.checkedIn == true || b.checked_in)
                    val itemStatus = if (isCheckedIn) BookingStatus.CONFIRMED else (try { BookingStatus.valueOf(b.status.uppercase()) } catch (_: Exception) { BookingStatus.BOOKED })

                    mappedList.add(
                        BookingWithArena(
                            id = b.id,
                            name = b.name,
                            phone = b.phone,
                            date = b.date,
                            locationId = b.location_id,
                            slotId = b.slot_id,
                            slotTime = b.slot_time,
                            startHour = b.start_hour,
                            endHour = b.end_hour,
                            duration = b.duration,
                            amount = b.amount,
                            advancePaid = b.advance_paid ?: 0.0,
                            status = itemStatus,
                            paymentMethod = b.payment_method,
                            paymentType = b.payment_type,
                            checkedIn = isCheckedIn,
                            createdAt = b.created_at,
                            bookedBy = b.booked_by,
                            userId = b.user_id,
                            isJoinable = b.is_joinable,
                            maxPlayers = b.max_players,
                            currentPlayers = b.current_players,
                            joinRequests = b.join_requests ?: emptyList(),
                            sport = b.sport,
                            arenaName = locationMap[b.location_id] ?: "Unknown Arena",
                            courtName = courtMap[b.court_id] ?: "Unknown Court",
                            courtId = b.court_id,
                            paymentId = b.id,
                            ticketIndex = 0
                        )
                    )
                }

                // Apply timeout checks in background
                transactionsList = mappedList.map { bwa ->
                    val b = com.boxitt.app.Booking(
                        id = bwa.id, name = bwa.name, phone = bwa.phone, date = bwa.date,
                        locationId = bwa.locationId, courtId = bwa.courtId, slotId = bwa.slotId,
                        slotTime = bwa.slotTime, startHour = bwa.startHour, endHour = bwa.endHour,
                        duration = bwa.duration, amount = bwa.amount, advancePaid = bwa.advancePaid,
                        status = bwa.status, paymentMethod = bwa.paymentMethod, paymentType = bwa.paymentType,
                        checkedIn = bwa.checkedIn, createdAt = bwa.createdAt, bookedBy = bwa.bookedBy,
                        sport = bwa.sport, userId = bwa.userId, isJoinable = bwa.isJoinable,
                        maxPlayers = bwa.maxPlayers, currentPlayers = bwa.currentPlayers,
                        joinRequests = bwa.joinRequests
                    )
                    val updated = com.boxitt.app.services.BookingService.checkAndApplyTimeout(b)
                    if (updated.status != bwa.status) bwa.copy(status = updated.status) else bwa
                }
            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to fetch transactions"
                android.util.Log.e("TransactionsVM", "Global fetch error", e)
            } finally {
                isLoading = false
            }
        }
    }
}
