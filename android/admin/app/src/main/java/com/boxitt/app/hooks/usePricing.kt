package com.boxitt.app.hooks

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.boxitt.app.Pricing
import com.boxitt.app.services.PricingService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class PricingViewModel(private val scope: CoroutineScope) {
    var pricingList by mutableStateOf<List<Pricing>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMsg by mutableStateOf<String?>(null)
        private set

    fun fetchPricing(locationId: String) {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                pricingList = PricingService.getPricingForLocation(locationId)
            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to fetch pricing"
            } finally {
                isLoading = false
            }
        }
    }

    fun upsertPricing(pricing: Pricing, onComplete: (Boolean) -> Unit = {}) {
        scope.launch {
            try {
                PricingService.upsertPricing(pricing)
                fetchPricing(pricing.location_id)
                onComplete(true)
            } catch (e: Exception) {
                e.printStackTrace()
                onComplete(false)
            }
        }
    }

    fun deletePricing(id: String, locationId: String, onComplete: (Boolean) -> Unit = {}) {
        scope.launch {
            try {
                PricingService.deletePricing(id)
                fetchPricing(locationId)
                onComplete(true)
            } catch (e: Exception) {
                e.printStackTrace()
                onComplete(false)
            }
        }
    }
}




