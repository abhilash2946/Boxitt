package com.boxitt.app.models

import kotlinx.serialization.Serializable

@Serializable
data class AdvanceBooking(
    val required: Boolean = false,
    val amount: Double = 0.0
)

@Serializable
data class Arena(
    val id: String? = null,
    val name: String,
    val images: List<String> = emptyList(),
    val description: String? = null,
    val price: Double,
    val rating: Double = 0.0,
    val timings: String? = null,
    val location: String? = null,
    val advanceBooking: AdvanceBooking = AdvanceBooking(),
    val contact: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)



