package com.boxitt.app.services

import java.net.UnknownHostException
import java.net.SocketTimeoutException
import java.net.ConnectException

data class UserFriendlyError(
    val title: String,
    val userMessage: String,
    val technicalDetail: String
)

/**
 * Error handling utility for consistent error management across the app.
 */

// ── Error codes ──────────────────────────────────────────────────────────────

object ErrorCode {
    // Auth errors
    const val INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    const val USER_NOT_FOUND = "USER_NOT_FOUND"
    const val EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS"
    const val WEAK_PASSWORD = "WEAK_PASSWORD"
    const val AUTH_REQUIRED = "AUTH_REQUIRED"

    // Validation errors
    const val INVALID_INPUT = "INVALID_INPUT"
    const val MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD"
    const val INVALID_EMAIL = "INVALID_EMAIL"
    const val INVALID_DATE_RANGE = "INVALID_DATE_RANGE"

    // Database errors
    const val DATABASE_ERROR = "DATABASE_ERROR"
    const val NOT_FOUND = "NOT_FOUND"
    const val DUPLICATE_ENTRY = "DUPLICATE_ENTRY"

    // Server errors
    const val INTERNAL_ERROR = "INTERNAL_ERROR"
    const val NETWORK_ERROR = "NETWORK_ERROR"
    const val TIMEOUT = "TIMEOUT"
}

// ── AppError class ───────────────────────────────────────────────────────────

class AppError(
    val code: String,
    val statusCode: Int = 500,
    override val message: String = "An error occurred"
) : Exception(message)

// ── ErrorHandler ─────────────────────────────────────────────────────────────

object ErrorHandler {
    fun handle(throwable: Throwable): UserFriendlyError {
        val message = throwable.message ?: "Unknown error"
        
        return when {
            throwable is UnknownHostException || message.contains("Unable to resolve host") -> {
                UserFriendlyError(
                    title = "NO INTERNET",
                    userMessage = "Please check your internet connection and try again.",
                    technicalDetail = message
                )
            }
            throwable is SocketTimeoutException || message.contains("timeout") || message.contains("timed out") -> {
                UserFriendlyError(
                    title = "CONNECTION TIMEOUT",
                    userMessage = "The server is taking too long to respond. Please try again in a moment.",
                    technicalDetail = message
                )
            }
            throwable is ConnectException || message.contains("Failed to connect") -> {
                UserFriendlyError(
                    title = "CONNECTION FAILED",
                    userMessage = "Could not connect to our servers. Please ensure you are online.",
                    technicalDetail = message
                )
            }
            message.contains("ACCESS_FINE_LOCATION") || message.contains("ACCESS_COARSE_LOCATION") -> {
                UserFriendlyError(
                    title = "LOCATION PERMISSION",
                    userMessage = "The app needs permission to access your device's location. Please enable it in Settings.",
                    technicalDetail = message
                )
            }
            message.contains("row-level security policy", ignoreCase = true) -> {
                UserFriendlyError(
                    title = "ACCESS DENIED",
                    userMessage = "You do not have administrative permission to perform this database action.",
                    technicalDetail = message
                )
            }
            message.contains("coroutine scope left the composition", ignoreCase = true) -> {
                UserFriendlyError(
                    title = "REQUEST CANCELLED",
                    userMessage = "The request was cancelled because the screen was closed.",
                    technicalDetail = message
                )
            }
            message.contains("permission", ignoreCase = true) -> {
                UserFriendlyError(
                    title = "PERMISSION REQUIRED",
                    userMessage = "The app needs additional permissions to perform this action. Please check your device settings.",
                    technicalDetail = message
                )
            }
            message.contains("invalid credentials", ignoreCase = true) || message.contains("invalid login credentials", ignoreCase = true) -> {
                UserFriendlyError(
                    title = "LOGIN FAILED",
                    userMessage = "Invalid email or password. Please try again.",
                    technicalDetail = message
                )
            }
            // If the error message is short and likely user-friendly, show it directly
            message.length < 60 && !message.lowercase().contains("http") && !message.lowercase().contains("exception") && !message.lowercase().contains("coroutine") -> {
                UserFriendlyError(
                    title = "ERROR",
                    userMessage = message,
                    technicalDetail = message
                )
            }
            else -> {
                UserFriendlyError(
                    title = "UNEXPECTED ERROR",
                    userMessage = "We encountered an unexpected error. Please try again.",
                    technicalDetail = message
                )
            }
        }
    }
}

// ── handleError ──────────────────────────────────────────────────────────────

fun handleError(error: Throwable): AppError {
    if (error is AppError) return error

    val rawMessage = error.message?.trim()?.takeIf { it.isNotEmpty() }
        ?: return AppError(ErrorCode.INTERNAL_ERROR, 500, "An unexpected error occurred")

    var message = rawMessage
    var code = ErrorCode.INVALID_INPUT
    var statusCode = 400

    val lower = rawMessage.lowercase()

    when {
        lower.contains("invalid login credentials") -> {
            message = "Invalid email or password"
            code = ErrorCode.INVALID_CREDENTIALS
            statusCode = 401
        }
        lower.contains("gateway timeout") || lower.contains("timeout") || lower.contains("timed out") -> {
            message = "Server timeout. Please retry in a minute."
            code = ErrorCode.TIMEOUT
            statusCode = 504
        }
        lower.contains("already registered") || lower.contains("user already exists") -> {
            message = "Email already registered. Please sign in instead."
            code = ErrorCode.EMAIL_ALREADY_EXISTS
            statusCode = 409
        }
        lower.contains("weak password") -> {
            message = "Password is too weak"
            code = ErrorCode.WEAK_PASSWORD
        }
        lower.contains("rate limit") || lower.contains("too many requests") -> {
            message = "Too many requests. Please try again later."
            statusCode = 429
        }
        lower.contains("network") || lower.contains("fetch") -> {
            message = "Network error. Please check your connection."
            code = ErrorCode.NETWORK_ERROR
        }
        lower.contains("database") || lower.contains("postgres") || lower.contains("row-level security") -> {
            message = "A database error occurred. Please try again."
            code = ErrorCode.DATABASE_ERROR
            statusCode = 500
        }
    }

    return AppError(code, statusCode, message)
}

// ── Validation helpers ───────────────────────────────────────────────────────

fun validateEmail(email: String): Boolean {
    val emailRegex = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
    return emailRegex.matches(email)
}

fun validatePassword(password: String): Boolean {
    // Minimum 6 characters
    return password.length >= 6
}

fun validateDateRange(start: Long, end: Long): Boolean {
    return start < end
}
