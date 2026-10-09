package com.boxitt.app.services

import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

// ── Audit action types ──────────────────────────────────────────────────────

enum class AuditAction(val value: String) {
    ROLE_CHANGE("ROLE_CHANGE"),
    ADMIN_CREATE_BOOKING("ADMIN_CREATE_BOOKING"),
    ADMIN_MODIFY_BOOKING("ADMIN_MODIFY_BOOKING"),
    ADMIN_DELETE_BOOKING("ADMIN_DELETE_BOOKING"),
    ADMIN_DELETE_USER("ADMIN_DELETE_USER"),
    ADMIN_SUSPEND_USER("ADMIN_SUSPEND_USER"),
    CLOSURE_CREATE("CLOSURE_CREATE"),
    CLOSURE_DELETE("CLOSURE_DELETE"),
    LOCATION_UPDATE("LOCATION_UPDATE"),
    LOCATION_DELETE("LOCATION_DELETE")
}

// ── AuditLogEntry data class ─────────────────────────────────────────────────

@Serializable
data class AuditLogEntry(
    val id: String? = null,
    val actor_id: String,
    val action: String,
    val resource_type: String,
    val resource_id: String? = null,
    val old_values: JsonObject? = null,
    val new_values: JsonObject? = null,
    val ip_address: String? = null,
    val user_agent: String? = null,
    val status: String,            // "success" | "failure"
    val error_message: String? = null,
    val created_at: String? = null
)

// ── AuditLogFilters ───────────────────────────────────────────────────────────

data class AuditLogFilters(
    val actor_id: String? = null,
    val action: AuditAction? = null,
    val resource_type: String? = null,
    val resource_id: String? = null,
    val startDate: String? = null,
    val endDate: String? = null,
    val limit: Int = 100
)

// ── AuditLogService ───────────────────────────────────────────────────────────

object AuditLogService {

    /**
     * Log an admin action to audit trail.
     * @param action     Type of action performed
     * @param resourceType  What was modified (e.g., 'user', 'booking', 'closure')
     * @param resourceId    ID of the resource (optional)
     * @param oldValues     Previous values before change (optional)
     * @param newValues     New values after change (optional)
     * @param error         Error message if operation failed (optional)
     */
    suspend fun logAuditAction(
        action: AuditAction,
        resourceType: String,
        resourceId: String? = null,
        oldValues: JsonObject? = null,
        newValues: JsonObject? = null,
        error: String? = null
    ): Result<Unit> {
        return try {
            val user = Supabase.client.auth.retrieveUserForCurrentSession()

            val entry = AuditLogEntry(
                actor_id = user.id,
                action = action.value,
                resource_type = resourceType,
                resource_id = resourceId,
                old_values = oldValues,
                new_values = newValues,
                status = if (error == null) "success" else "failure",
                error_message = error
            )

            Supabase.client.postgrest["audit_logs"].insert(entry)
            Result.success(Unit)
        } catch (e: Exception) {
            val appError = handleError(e)
            Result.failure(appError)
        }
    }

    /**
     * Query audit logs (superadmin only).
     */
    suspend fun getAuditLogs(filters: AuditLogFilters = AuditLogFilters()): Result<List<AuditLogEntry>> {
        return try {
            val data = Supabase.client.postgrest["audit_logs"].select {
                filter {
                    filters.actor_id?.let { eq("actor_id", it) }
                    filters.action?.let { eq("action", it.value) }
                    filters.resource_type?.let { eq("resource_type", it) }
                    filters.resource_id?.let { eq("resource_id", it) }
                    filters.startDate?.let { gte("created_at", it) }
                    filters.endDate?.let { lte("created_at", it) }
                }
                order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(filters.limit.toLong())
            }.decodeList<AuditLogEntry>()
            Result.success(data)
        } catch (e: Exception) {
            val appError = handleError(e)
            Result.failure(appError)
        }
    }

    /**
     * Log a role change.
     */
    suspend fun logRoleChange(
        targetUserId: String,
        oldRole: String,
        newRole: String
    ): Result<Unit> {
        val oldValues = kotlinx.serialization.json.buildJsonObject {
            put("role", kotlinx.serialization.json.JsonPrimitive(oldRole))
        }
        val newValues = kotlinx.serialization.json.buildJsonObject {
            put("role", kotlinx.serialization.json.JsonPrimitive(newRole))
        }
        return logAuditAction(
            action = AuditAction.ROLE_CHANGE,
            resourceType = "user",
            resourceId = targetUserId,
            oldValues = oldValues,
            newValues = newValues
        )
    }

    /**
     * Log an admin booking action.
     */
    suspend fun logAdminBookingAction(
        action: AuditAction,
        bookingId: String,
        oldValues: JsonObject? = null,
        newValues: JsonObject? = null
    ): Result<Unit> {
        return logAuditAction(
            action = action,
            resourceType = "booking",
            resourceId = bookingId,
            oldValues = oldValues,
            newValues = newValues
        )
    }
}




