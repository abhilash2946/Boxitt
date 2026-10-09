package com.boxitt.app.providers

/**
 * Android Equivalent of QueryProvider configurations.
 * Holds cache and retry settings for API calls.
 */
object QueryClient {
    const val STALE_TIME: Long = 0 // Always fetch fresh data
    const val GC_TIME: Long = 0 // Remove cache immediately
    const val REFETCH_ON_WINDOW_FOCUS: Boolean = false
    const val RETRY_COUNT: Int = 1 // Retry failed requests once
    const val REFETCH_ON_RECONNECT: Boolean = true
}




