package com.boxitt.app.services

import com.boxitt.app.Pricing
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.Serializable

object PricingService {

    suspend fun getPricingForLocation(locationId: String): List<Pricing> {
        if (locationId.isBlank()) return emptyList()
        return try {
            val data = Supabase.client.postgrest["box_pricing"].select {
                filter {
                    eq("location_id", locationId)
                }
                order("duration_hours", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
            }.decodeList<Pricing>()
            android.util.Log.d("PricingService", "Fetched ${data.size} pricing rules for $locationId")
            data
        } catch (e: Exception) {
            android.util.Log.e("PricingService", "Error fetching pricing", e)
            e.printStackTrace()
            throw e
        }
    }

    suspend fun upsertPricing(pricing: Pricing): Pricing {
        return try {
            Supabase.client.postgrest["box_pricing"].upsert(
                value = pricing,
                onConflict = "location_id,court_id,duration_hours,category,rule_type,day_of_week,specific_date"
            ) {
                select()
                single()
            }.decodeAs<Pricing>()
        } catch (e: Exception) {
            e.printStackTrace()
            throw e
        }
    }

    suspend fun bulkUpsertPricing(pricingList: List<Pricing>) {
        try {
            Supabase.client.postgrest["box_pricing"].upsert(
                values = pricingList,
                onConflict = "location_id,court_id,duration_hours,category,rule_type,day_of_week,specific_date"
            )
        } catch (e: Exception) {
            e.printStackTrace()
            throw e
        }
    }

    suspend fun deletePricing(id: String) {
        try {
            Supabase.client.postgrest["box_pricing"].delete {
                filter {
                    eq("id", id)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            throw e
        }
    }

    suspend fun deletePricingByCourt(courtId: String) {
        try {
            Supabase.client.postgrest["box_pricing"].delete {
                filter {
                    eq("court_id", courtId)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            throw e
        }
    }
}




