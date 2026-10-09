package com.boxitt.app.hooks

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.boxitt.app.Review
import com.boxitt.app.services.ReviewService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class ReviewsViewModel(private val scope: CoroutineScope) {
    var reviewsList by mutableStateOf<List<Review>>(emptyList())
        private set
    var userReview by mutableStateOf<Review?>(null)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMsg by mutableStateOf<String?>(null)
        private set

    fun fetchReviews(locationId: String) {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                reviewsList = ReviewService.getReviews(locationId)
            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to fetch reviews"
            } finally {
                isLoading = false
            }
        }
    }

    fun fetchUserReview(locationId: String, userId: String) {
        scope.launch {
            try {
                userReview = ReviewService.getUserReview(locationId, userId)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun saveReview(locationId: String, userId: String, rating: Int, comment: String, onComplete: (Boolean) -> Unit = {}) {
        scope.launch {
            try {
                val saved = ReviewService.saveReview(locationId, userId, rating, comment)
                userReview = saved
                fetchReviews(locationId)
                onComplete(true)
            } catch (e: Exception) {
                e.printStackTrace()
                onComplete(false)
            }
        }
    }
}




