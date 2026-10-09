package com.boxitt.app.services

import com.boxitt.app.Booking
import com.boxitt.app.BookingStatus

data class BookingValidationResult(
    val valid: Boolean,
    val error: String? = null,
    val conflictingBooking: Booking? = null
)

data class BookingSlotConflict(
    val bookingId: String,
    val playerName: String,
    val timeRange: String,
    val status: BookingStatus
)

/**
 * Check if a time slot is already booked.
 */
suspend fun checkSlotConflicts(
    locationId: String,
    date: String,
    startHour: Double,
    endHour: Double,
    courtId: String? = null,
    excludeBookingId: String? = null
): List<BookingSlotConflict> {
    return try {
        val bookings = BookingService.getBookings(locationId, date)
        val conflicts = mutableListOf<BookingSlotConflict>()

        for (booking in bookings) {
            if (excludeBookingId != null && booking.id == excludeBookingId) continue
            if (courtId != null && booking.courtId != courtId) continue
            if (booking.status == BookingStatus.CANCELLED || 
                booking.status == BookingStatus.REJECTED ||
                booking.status == BookingStatus.DECLINED ||
                booking.status == BookingStatus.TIMED_OUT
            ) continue

            val bookingStart = booking.startHour
            val bookingEnd = booking.endHour

            if (startHour < bookingEnd && endHour > bookingStart) {
                conflicts.add(
                    BookingSlotConflict(
                        bookingId = booking.id,
                        playerName = booking.name,
                        timeRange = booking.slotTime,
                        status = booking.status
                    )
                )
            }
        }
        conflicts
    } catch (e: Exception) {
        e.printStackTrace()
        emptyList()
    }
}

/**
 * Validate a booking before creation/update.
 */
suspend fun validateBookingSlot(
    locationId: String,
    date: String,
    startHour: Double,
    endHour: Double,
    userRole: String = "user",
    courtId: String? = null,
    excludeBookingId: String? = null,
    requestedTickets: Int = 1,
    maxCapacity: Int = 50,
    sport: String? = null
): BookingValidationResult {
    return try {
        if (locationId.isBlank() || date.isBlank()) {
            return BookingValidationResult(valid = false, error = "Missing booking parameters")
        }

        val bookings = BookingService.getBookings(locationId, date)
        val isSwimming = sport == "Swimming" || sport == "SWIMMING"
        val capacityLimit = if (maxCapacity > 0) maxCapacity else if (isSwimming) 50 else 10

        var bookedCount = 0

        for (booking in bookings) {
            if (excludeBookingId != null && booking.id == excludeBookingId) continue
            if (courtId != null && booking.courtId != courtId) continue
            if (booking.status == BookingStatus.CANCELLED || 
                booking.status == BookingStatus.REJECTED ||
                booking.status == BookingStatus.DECLINED ||
                booking.status == BookingStatus.TIMED_OUT
            ) continue

            val bookingStart = booking.startHour
            val bookingEnd = booking.endHour

            if (startHour < bookingEnd && endHour > bookingStart) {
                bookedCount += booking.currentPlayers.coerceAtLeast(1)
            }
        }

        if (bookedCount + requestedTickets > capacityLimit) {
            if (userRole == "admin" || userRole == "superadmin") {
                return BookingValidationResult(valid = true)
            }

            val spotsLeft = (capacityLimit - bookedCount).coerceAtLeast(0)
            if (spotsLeft == 0) {
                return BookingValidationResult(valid = false, error = "This slot is fully booked ($bookedCount/$capacityLimit).")
            }
            return BookingValidationResult(
                valid = false,
                error = "Only $spotsLeft ticket(s) left in this slot ($bookedCount/$capacityLimit booked)."
            )
        }

        BookingValidationResult(valid = true)
    } catch (e: Exception) {
        BookingValidationResult(valid = false, error = "Database verification failed. Please try again.")
    }
}
