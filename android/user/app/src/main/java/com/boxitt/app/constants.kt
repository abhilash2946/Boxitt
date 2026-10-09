
package com.boxitt.app

object Constants {
    val DURATIONS = listOf("1 hr", "1.5 hr", "2 hr", "3 hr")

    // Defines the start and end of the booking day
    const val DAY_START_HOUR = 6 // 6 AM
    const val DAY_END_HOUR = 23  // 11 PM

    val INITIAL_PRICING: List<PricingRule> = listOf(
        PricingRule(duration = "1 hr", basePricePeak = 800.0, basePriceOffPeak = 600.0, active = true),
        PricingRule(duration = "1.5 hr", basePricePeak = 1100.0, basePriceOffPeak = 850.0, active = true),
        PricingRule(duration = "2 hr", basePricePeak = 1400.0, basePriceOffPeak = 1100.0, active = true),
        PricingRule(duration = "3 hr", basePricePeak = 2000.0, basePriceOffPeak = 1600.0, active = true)
    )

    data class SportSpec(
        val capacityOptions: List<Int>,
        val squadSizeOptions: List<Int>,
        val defaultCapacity: Int
    )

    val SPORT_CONFIG = mapOf(
        "Box Cricket" to SportSpec(
            capacityOptions = listOf(6, 8, 10, 12, 14, 16),
            squadSizeOptions = listOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
            defaultCapacity = 10
        ),
        "Box Football" to SportSpec(
            capacityOptions = listOf(10, 12, 14, 16),
            squadSizeOptions = listOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
            defaultCapacity = 10
        ),
        "Box Badminton" to SportSpec(
            capacityOptions = listOf(2, 4),
            squadSizeOptions = listOf(1, 2, 3),
            defaultCapacity = 4
        ),
        "Box Pickleball" to SportSpec(
            capacityOptions = listOf(2, 4),
            squadSizeOptions = listOf(1, 2, 3),
            defaultCapacity = 4
        ),
        "Box Tennis" to SportSpec(
            capacityOptions = listOf(2, 4),
            squadSizeOptions = listOf(1, 2, 3),
            defaultCapacity = 2
        ),
        "Box Basketball" to SportSpec(
            capacityOptions = listOf(6, 8, 10),
            squadSizeOptions = listOf(1, 2, 3, 4, 5, 6),
            defaultCapacity = 10
        ),
        "Swimming" to SportSpec(
            capacityOptions = listOf(1, 2, 4, 6, 8, 10),
            squadSizeOptions = listOf(1, 2, 3, 4, 5),
            defaultCapacity = 1
        ),
        "Game Zone" to SportSpec(
            capacityOptions = listOf(1, 2, 3, 4, 6, 8, 10),
            squadSizeOptions = listOf(1, 2, 3, 4),
            defaultCapacity = 4
        )
    )

    fun getLocalISODate(): String = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date())
    fun getLocalISODatetime(): String = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
}




