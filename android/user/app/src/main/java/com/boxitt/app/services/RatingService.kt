package com.boxitt.app.services

import io.github.jan.supabase.postgrest.postgrest

@kotlinx.serialization.Serializable
private data class RatingRow(val rating: Int)

data class RatingsBreakdown(
    val oneStar: Int = 0,
    val twoStar: Int = 0,
    val threeStar: Int = 0,
    val fourStar: Int = 0,
    val fiveStar: Int = 0
)

object RatingService {

    /**
     * Get average rating for a specific location.
     */
    suspend fun getLocationAverageRating(locationId: String): Double {
        if (locationId.isBlank()) return 0.0
        return try {
            val data = Supabase.client.postgrest["reviews"].select {
                filter {
                    eq("location_id", locationId)
                }
            }.decodeList<RatingRow>()
            if (data.isEmpty()) return 0.0
            val total = data.sumOf { it.rating }
            String.format("%.1f", total / data.size).toDouble()
        } catch (e: Exception) {
            e.printStackTrace()
            0.0
        }
    }

    /**
     * Recalculate and store the average rating in the locations table.
     */
    suspend fun syncLocationRating(locationId: String) {
        try {
            val avg = getLocationAverageRating(locationId)
            Supabase.client.postgrest["locations"].update({
                set("average_rating", avg)
            }) {
                filter {
                    eq("id", locationId)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Get average rating for a specific match.
     */
    suspend fun getMatchAverageRating(matchId: String): Double {
        if (matchId.isBlank()) return 0.0
        return try {
            val data = Supabase.client.postgrest["reviews"].select {
                filter {
                    eq("match_id", matchId)
                }
            }.decodeList<RatingRow>()
            if (data.isEmpty()) return 0.0
            val total = data.sumOf { it.rating }
            String.format("%.1f", total / data.size).toDouble()
        } catch (e: Exception) {
            e.printStackTrace()
            0.0
        }
    }

    /**
     * Get rating count for a specific location.
     */
    suspend fun getLocationRatingCount(locationId: String): Int {
        if (locationId.isBlank()) return 0
        return try {
            val data = Supabase.client.postgrest["reviews"].select {
                filter {
                    eq("location_id", locationId)
                }
            }.decodeList<RatingRow>()
            data.size
        } catch (e: Exception) {
            e.printStackTrace()
            0
        }
    }

    /**
     * Check if user has already rated a specific match.
     */
    suspend fun hasUserRatedMatch(matchId: String, userId: String): Boolean {
        if (matchId.isBlank() || userId.isBlank()) return false
        return try {
            val data = Supabase.client.postgrest["reviews"].select {
                filter {
                    eq("match_id", matchId)
                    eq("user_id", userId)
                }
            }.decodeList<RatingRow>()
            data.isNotEmpty()
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Get ratings breakdown for a location (count of each star rating).
     */
    suspend fun getLocationRatingsBreakdown(locationId: String): RatingsBreakdown {
        if (locationId.isBlank()) return RatingsBreakdown()
        return try {
            val data = Supabase.client.postgrest["reviews"].select {
                filter {
                    eq("location_id", locationId)
                }
            }.decodeList<RatingRow>()

            var oneStar = 0; var twoStar = 0; var threeStar = 0; var fourStar = 0; var fiveStar = 0
            for (row in data) {
                when (row.rating.toInt()) {
                    1 -> oneStar++
                    2 -> twoStar++
                    3 -> threeStar++
                    4 -> fourStar++
                    5 -> fiveStar++
                }
            }
            RatingsBreakdown(oneStar, twoStar, threeStar, fourStar, fiveStar)
        } catch (e: Exception) {
            e.printStackTrace()
            RatingsBreakdown()
        }
    }
}




