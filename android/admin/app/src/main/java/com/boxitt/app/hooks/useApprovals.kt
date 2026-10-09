package com.boxitt.app.hooks

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class PendingRequest(
    val id: String,
    val username: String? = null,
    val email: String,
    val role: String,
    val created_at: String,
    val role_status: String
)

@Serializable
private data class RequestedRoleQuery(
    val requested_role: String? = null
)

class ApprovalsViewModel(private val scope: CoroutineScope) {
    var pendingRequests by mutableStateOf<List<PendingRequest>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMsg by mutableStateOf<String?>(null)
        private set

    fun fetchPendingApprovals() {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val data = Supabase.client.postgrest["user_profiles"].select {
                    filter {
                        eq("role_status", "pending")
                    }
                    order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                }.decodeList<PendingRequest>()
                pendingRequests = data
            } catch (e: Exception) {
                errorMsg = e.message ?: "Failed to fetch approvals"
            } finally {
                isLoading = false
            }
        }
    }

    fun handleApprovalAction(id: String, status: String, onComplete: (Boolean, String?) -> Unit = { _, _ -> }) {
        scope.launch {
            try {
                val updateData = mutableMapOf<String, String?>()
                updateData["role_status"] = status

                if (status == "approved") {
                    val profile = Supabase.client.postgrest["user_profiles"].select {
                        filter {
                            eq("id", id)
                        }
                        single()
                    }.decodeAs<RequestedRoleQuery>()

                    if (profile.requested_role != null) {
                        updateData["role"] = profile.requested_role
                        updateData["requested_role"] = null
                    }
                } else if (status == "rejected") {
                    updateData["role"] = "user"
                    updateData["requested_role"] = null
                }

                Supabase.client.postgrest["user_profiles"].update({
                    updateData.forEach { (key, value) ->
                        set(key, value)
                    }
                }) {
                    filter {
                        eq("id", id)
                    }
                }

                fetchPendingApprovals()
                onComplete(true, "User ${if (status == "approved") "approved" else "rejected"} successfully.")
            } catch (e: Exception) {
                e.printStackTrace()
                onComplete(false, e.message ?: "An error occurred. Please try again.")
            }
        }
    }
}




