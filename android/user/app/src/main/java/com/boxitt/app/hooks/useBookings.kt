package com.boxitt.app.hooks

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.boxitt.app.Booking
import com.boxitt.app.BookingStatus
import com.boxitt.app.services.BookingService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class BookingsViewModel(private val scope: CoroutineScope) {
    var bookingsList by mutableStateOf<List<Booking>>(emptyList())
        private set
    var currentBooking by mutableStateOf<Booking?>(null)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMsg by mutableStateOf<String?>(null)
        private set

    fun fetchBookings(locationId: String, date: String? = null) {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                bookingsList = BookingService.getBookings(locationId, date)
            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to fetch bookings"
            } finally {
                isLoading = false
            }
        }
    }

    fun fetchBookingById(id: String) {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                currentBooking = BookingService.getBookingById(id)
            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to fetch booking details"
            } finally {
                isLoading = false
            }
        }
    }

    fun createBooking(booking: Booking, onComplete: (Result<Booking>) -> Unit) {
        scope.launch {
            val result = BookingService.saveBooking(booking)
            onComplete(result)
        }
    }

    fun updateBooking(
        id: String,
        status: BookingStatus? = null,
        checkedIn: Boolean? = null,
        isJoinable: Boolean? = null,
        onComplete: (Boolean) -> Unit = {}
    ) {
        scope.launch {
            val success = BookingService.updateBooking(id, status, checkedIn, isJoinable)
            onComplete(success)
        }
    }

    fun addJoinRequest(
        bookingId: String,
        playerName: String,
        phone: String,
        count: Int = 1,
        joinerId: String? = null,
        onComplete: (Boolean) -> Unit = {}
    ) {
        scope.launch {
            val success = BookingService.addJoinRequest(bookingId, playerName, phone, count, joinerId)
            onComplete(success)
        }
    }
}




