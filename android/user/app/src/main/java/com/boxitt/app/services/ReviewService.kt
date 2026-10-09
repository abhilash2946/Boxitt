package com.boxitt.app.services

import com.boxitt.app.Review
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable


@Serializable
data class ReviewProfile(
    val full_name: String,
    val avatar_url: String
)

/**
 * Service for managing reviews.
 */
object ReviewService {
    /**
     * Fetch all reviews for a location.
     */
    suspend fun getReviews(locationId: String): List<Review> {
        return try {
            val reviewsData = Supabase.client.postgrest["reviews"].select {
                filter {
                    eq("location_id", locationId)
                }
                order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            }.decodeList<Review>()

            if (reviewsData.isEmpty()) return emptyList()

            // Fetch user profiles to get usernames
            val userIds = reviewsData.map { it.user_id }.distinct()
            val profilesData = Supabase.client.postgrest["user_profiles"].select {
                filter {
                    isIn("id", userIds)
                }
            }.decodeList<com.boxitt.app.UserProfile>()

            val profileMap = profilesData.associateBy { it.id }

            reviewsData.map { review ->
                val profile = profileMap[review.user_id]
                review.copy(name = profile?.username ?: profile?.display_name ?: "Anonymous")
            }
        } catch (e: Exception) {
            throw handleError(e)
        }
    }

    /**
     * Fetch a specific user's review for a location.
     */
    suspend fun getUserReview(locationId: String, userId: String): Review? {
        return try {
            val results = Supabase.client.postgrest["reviews"].select {
                filter {
                    eq("location_id", locationId)
                    eq("user_id", userId)
                }
            }.decodeList<Review>()
            results.firstOrNull()
        } catch (e: Exception) {
            throw handleError(e)
        }
    }

    /**
     * Create or update a review.
     */
    suspend fun saveReview(locationId: String, userId: String, rating: Int, comment: String): Review {
        return try {
            val existing = getUserReview(locationId, userId)

            val result = if (existing != null) {
                // Update existing review (Parity with reviewService.ts: refresh created_at)
                Supabase.client.postgrest["reviews"].update({
                    set("rating", rating)
                    set("comment", comment)
                    set("created_at", java.time.Instant.now().toString())
                }) {
                    filter {
                        eq("id", existing.id)
                    }
                    select()
                    single()
                }.decodeAs<Review>()
            } else {
                // Insert new review
                @Serializable
                data class ReviewInsert(
                    val location_id: String,
                    val user_id: String,
                    val rating: Int,
                    val comment: String
                )
                Supabase.client.postgrest["reviews"].insert(
                    ReviewInsert(locationId, userId, rating, comment)
                ) {
                    select()
                    single()
                }.decodeAs<Review>()
            }

            // Sync location rating in background
            GlobalScope.launch {
                RatingService.syncLocationRating(locationId)
            }

            result
        } catch (e: Exception) {
            throw handleError(e)
        }
    }
}




