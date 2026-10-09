package com.boxitt.app.services

import com.boxitt.app.*
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class Contact(
    val id: String,
    val user_id: String,
    val contact_id: String,
    val nickname: String? = null,
    val is_blocked: Boolean,
    val created_at: String,
    val contact_profile: UserProfile? = null
)

object UserService {
    suspend fun searchUsers(query: String, searchType: String = "all"): Result<List<UserProfile>> {
        return try {
            if (query.trim().length < 2) {
                return Result.failure(Exception("Search query must be at least 2 characters"))
            }
            val searchQuery = query.lowercase().trim()
            val columns = Columns.ALL
            
            val postgrestQuery = Supabase.client.postgrest["user_profiles"].select(columns) {
                filter {
                    when (searchType) {
                        "displayName" -> ilike("display_name", "%$searchQuery%")
                        "email" -> ilike("email", "%$searchQuery%")
                        "phone" -> ilike("phone_number", "%$searchQuery%")
                        else -> or {
                            ilike("display_name", "%$searchQuery%")
                            ilike("email", "%$searchQuery%")
                            ilike("phone_number", "%$searchQuery%")
                        }
                    }
                }
                limit(20)
            }
            val profiles = postgrestQuery.decodeList<UserProfile>()
            Result.success(profiles)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getUserProfile(userId: String): Result<UserProfile?> {
        return try {
            if (userId.isEmpty()) return Result.failure(Exception("User ID is required"))
            val profile = Supabase.client.postgrest["user_profiles"]
                .select {
                    filter {
                        eq("id", userId)
                    }
                    single()
                }.decodeAs<UserProfile>()
            Result.success(profile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    @OptIn(DelicateCoroutinesApi::class)
    suspend fun getCurrentUserProfile(): Result<UserProfile?> {
        return try {
            val user = Supabase.client.auth.retrieveUserForCurrentSession()
            val profile = Supabase.client.postgrest["user_profiles"]
                .select {
                    filter {
                        eq("id", user.id)
                    }
                    single()
                }.decodeAs<UserProfile>()
            
            // Auto-repair missing coordinates in background
            if (!profile.address.isNullOrBlank() && profile.latitude == null) {
                GlobalScope.launch {
                    try {
                        val coords = GeocodingService.getCoordinates(profile.address!!, profile.location ?: "")
                        if (coords != null) {
                            Supabase.client.postgrest["user_profiles"].update({
                                set("latitude", coords.latitude)
                                set("longitude", coords.longitude)
                            }) {
                                filter { eq("id", profile.id!!) }
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
            
            Result.success(profile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getCurrentUserRole(): Result<String> {
        return try {
            val user = Supabase.client.auth.retrieveUserForCurrentSession()
            val profile = Supabase.client.postgrest["user_profiles"]
                .select {
                    filter {
                        eq("id", user.id)
                    }
                    single()
                }.decodeAs<UserProfile>()
            Result.success(profile.role ?: "user")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun listUserProfiles(): Result<List<UserProfile>> {
        return try {
            val profiles = Supabase.client.postgrest["user_profiles"]
                .select {
                    order(column = "created_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                }.decodeList<UserProfile>()
            Result.success(profiles)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateUserRole(userId: String, role: String): Result<UserProfile> {
        return try {
            if (userId.isEmpty()) return Result.failure(Exception("User ID is required"))
            val roleStatus = when (role) {
                "user" -> "approved"
                "admin", "superadmin" -> "pending"
                else -> "approved"
            }
            val requestedRole = if (role == "admin" || role == "superadmin") role else null
            
            val updated = Supabase.client.postgrest["user_profiles"].update({
                set("role", role)
                set("role_status", roleStatus)
                set("requested_role", requestedRole)
            }) {
                filter {
                    eq("id", userId)
                }
                select()
                single()
            }.decodeAs<UserProfile>()
            Result.success(updated)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun addContact(contactId: String, nickname: String? = null): Result<Contact> {
        return try {
            if (contactId.isEmpty()) return Result.failure(Exception("Contact ID is required"))
            val currentUser = Supabase.client.auth.retrieveUserForCurrentSession()
            if (currentUser.id == contactId) {
                return Result.failure(Exception("Cannot add yourself as a contact"))
            }
            
            val existing = Supabase.client.postgrest["contacts"].select {
                filter {
                    eq("user_id", currentUser.id)
                    eq("contact_id", contactId)
                }
            }.decodeList<Contact>()
            if (existing.isNotEmpty()) {
                return Result.failure(Exception("Contact already added"))
            }

            @Serializable
            data class ContactInsert(
                val user_id: String,
                val contact_id: String,
                val nickname: String?,
                val is_blocked: Boolean
            )

            val inserted = Supabase.client.postgrest["contacts"].insert(
                ContactInsert(currentUser.id, contactId, nickname, false)
            ) {
                select()
                single()
            }.decodeAs<Contact>()
            Result.success(inserted)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getContacts(includeBlocked: Boolean = false): Result<List<Contact>> {
        return try {
            val currentUser = Supabase.client.auth.retrieveUserForCurrentSession()
            val contacts = Supabase.client.postgrest["contacts"].select {
                filter {
                    eq("user_id", currentUser.id)
                    if (!includeBlocked) {
                        eq("is_blocked", false)
                    }
                }
            }.decodeList<Contact>()
            Result.success(contacts)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun blockContact(contactId: String, block: Boolean): Result<Contact> {
        return try {
            if (contactId.isEmpty()) return Result.failure(Exception("Contact ID is required"))
            val currentUser = Supabase.client.auth.retrieveUserForCurrentSession()
            val updated = Supabase.client.postgrest["contacts"].update({
                set("is_blocked", block)
            }) {
                filter {
                    eq("user_id", currentUser.id)
                    eq("contact_id", contactId)
                }
                select()
                single()
            }.decodeAs<Contact>()
            Result.success(updated)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun removeContact(contactId: String): Result<Unit> {
        return try {
            if (contactId.isEmpty()) return Result.failure(Exception("Contact ID is required"))
            val currentUser = Supabase.client.auth.retrieveUserForCurrentSession()
            Supabase.client.postgrest["contacts"].delete {
                filter {
                    eq("user_id", currentUser.id)
                    eq("contact_id", contactId)
                }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteUserProfile(userId: String): Result<Boolean> {
        return try {
            if (userId.isEmpty()) return Result.failure(Exception("User ID is required"))
            Supabase.client.postgrest["user_profiles"].delete {
                filter {
                    eq("id", userId)
                }
            }
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun isUserBlocked(userId: String): Result<Boolean> {
        return try {
            if (userId.isEmpty()) return Result.failure(Exception("User ID is required"))
            val currentUser = Supabase.client.auth.retrieveUserForCurrentSession()
            
            val blocked1 = Supabase.client.postgrest["contacts"].select {
                filter {
                    eq("user_id", userId)
                    eq("contact_id", currentUser.id)
                    eq("is_blocked", true)
                }
            }.decodeList<Contact>()

            val blocked2 = Supabase.client.postgrest["contacts"].select {
                filter {
                    eq("user_id", currentUser.id)
                    eq("contact_id", userId)
                    eq("is_blocked", true)
                }
            }.decodeList<Contact>()

            Result.success(blocked1.isNotEmpty() || blocked2.isNotEmpty())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateContactNickname(contactId: String, nickname: String): Result<Contact> {
        return try {
            if (contactId.isEmpty()) return Result.failure(Exception("Contact ID is required"))
            val currentUser = Supabase.client.auth.retrieveUserForCurrentSession()
            val updated = Supabase.client.postgrest["contacts"].update({
                set("nickname", nickname.ifEmpty { null })
            }) {
                filter {
                    eq("user_id", currentUser.id)
                    eq("contact_id", contactId)
                }
                select()
                single()
            }.decodeAs<Contact>()
            Result.success(updated)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateUserLocation(latitude: Double, longitude: Double): Result<Boolean> {
        return try {
            val currentUser = Supabase.client.auth.retrieveUserForCurrentSession()
            Supabase.client.postgrest["user_profiles"].update({
                set("latitude", latitude)
                set("longitude", longitude)
                set("location_updated_at", java.time.Instant.now().toString())
            }) {
                filter {
                    eq("id", currentUser.id)
                }
            }
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}



