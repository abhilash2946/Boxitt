package com.boxitt.app.services

import com.boxitt.app.Location
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

data class AdminLoginResult(
    val success: Boolean,
    val role: String = "user",
    val location: Location? = null
)

object AdminService {
    suspend fun loginAdmin(email: String, username: String, password: String): AdminLoginResult {
        return try {
            val cleanUsername = username.trim()
            
            // 1. Check Superadmin
            val superadmins = Supabase.client.postgrest["admin_accounts"].select {
                filter {
                    ilike("username", "superadmin")
                    eq("password", password)
                    eq("is_superadmin", true)
                }
            }.decodeList<JsonObject>()
            
            if (superadmins.isNotEmpty()) {
                return AdminLoginResult(true, "superadmin", null)
            }

            // 2. Check Regular Admin (Strict username + password)
            val admins = Supabase.client.postgrest["admin_accounts"].select {
                filter {
                    eq("username", cleanUsername)
                    eq("password", password)
                    eq("is_superadmin", false)
                }
            }.decodeList<JsonObject>()

            if (admins.isEmpty()) return AdminLoginResult(false)

            val admin = admins[0]
            val locationId = admin["location_id"]?.jsonPrimitive?.content ?: return AdminLoginResult(false)

            val location = LocationService.getLocationById(locationId)
            if (location == null) return AdminLoginResult(false)

            AdminLoginResult(true, "admin", location)
        } catch (e: Exception) {
            e.printStackTrace()
            AdminLoginResult(false)
        }
    }

    suspend fun verifyAndUpdate(usernameQuery: String, currentPwd: String, newUsername: String, newPassword: String): Boolean {
        return try {
            val admins = Supabase.client.postgrest["admin_accounts"].select {
                filter {
                    ilike("username", usernameQuery)
                    eq("password", currentPwd)
                }
            }.decodeList<JsonObject>()

            if (admins.isEmpty()) return false

            val adminId = admins[0]["id"]?.jsonPrimitive?.content ?: return false
            val oldPassword = admins[0]["password"]?.jsonPrimitive?.content ?: return false

            Supabase.client.postgrest["admin_accounts"].update({
                set("username", newUsername)
                set("password", if (newPassword.isNotBlank()) newPassword else oldPassword)
            }) {
                filter {
                    eq("id", adminId)
                }
            }
            true
        } catch (e: Exception) {
            false
        }
    }
}



