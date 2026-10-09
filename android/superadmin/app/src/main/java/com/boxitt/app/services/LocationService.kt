package com.boxitt.app.services

import com.boxitt.app.Location
import com.boxitt.app.Court
import com.boxitt.app.Pricing
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.rpc
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable
data class LocationWithAdmin(
    val id: String,
    val name: String,
    val address: String,
    val email: String = "",
    val image_urls: List<String> = emptyList(),
    val min_advance: Double = 0.0,
    val supported_sports: List<String> = emptyList(),
    val latitude: Double? = null,
    val longitude: Double? = null,
    val open_hour: Int = 6,
    val close_hour: Int = 23,
    val morning_start: Int = 6,
    val morning_end: Int = 18,
    val night_start: Int = 18,
    val night_end: Int = 24,
    val description: String? = null,
    val rating: Double? = null,
    val timings: String? = null,
    val contact: String? = null,
    val advance_booking_required: Boolean? = null,
    val adminUsername: String? = null,
    val is_open: Boolean = true
)

@Serializable
data class AdminAccountRow(
    val username: String
)

@Serializable
private data class LocationRow(
    val id: String,
    val name: String,
    val address: String,
    val email: String? = null,
    val image_urls: List<String>? = null,
    val min_advance: Int? = null,
    val supported_sports: List<String>? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val open_hour: Int? = null,
    val close_hour: Int? = null,
    val morning_start: Int? = null,
    val morning_end: Int? = null,
    val night_start: Int? = null,
    val night_end: Int? = null,
    val description: String? = null,
    val rating: Double? = null,
    val timings: String? = null,
    val contact: String? = null,
    val advance_booking_required: Boolean? = null,
    val created_at: String? = null,
    val box_pricing: List<Pricing>? = null,
    val courts: List<Court>? = null,
    val admin_accounts: List<AdminAccountRow>? = null,
    val default_price: Double? = null,
    val default_advance: Double? = null,
    val is_open: Boolean? = null,
    val number_of_courts: Int? = null
)

@Serializable
private data class LocationInsert(
    val id: String,
    val name: String,
    val address: String,
    val email: String? = null,
    val image_urls: List<String>? = null,
    val min_advance: Int? = null,
    val supported_sports: List<String>? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val open_hour: Int = 6,
    val close_hour: Int = 23,
    val morning_start: Int = 6,
    val morning_end: Int = 18,
    val night_start: Int = 18,
    val night_end: Int = 24,
    val description: String? = null,
    val rating: Double? = null,
    val timings: String? = null,
    val contact: String? = null,
    val advance_booking_required: Boolean? = null,
    val is_open: Boolean = true,
    val number_of_courts: Int = 1
)

@Serializable
private data class AdminAccountInsert(
    val username: String,
    val password: String,
    val email: String,
    val location_id: String,
    val is_superadmin: Boolean = false
)

@Serializable
private data class AdminCredentialsUpsert(
    val location_id: String,
    val username: String,
    val password: String,
    val email: String,
    val is_superadmin: Boolean = false
)

@Serializable
private data class LocationNameAddress(
    val name: String,
    val address: String
)

@Serializable
private data class LocationEmail(
    val email: String? = null
)

private fun LocationRow.toDomain(): Location {
    val defaultPricing = box_pricing?.firstOrNull { p ->
        p.duration_hours == 1.0 && p.rule_type == "default" && p.category == "morning"
    } ?: box_pricing?.firstOrNull { p ->
        p.duration_hours == 1.0 && p.rule_type == "default"
    }
    val validAdvances = box_pricing?.mapNotNull { it.advance_price }?.filter { it > 0 } ?: emptyList()
    val lowestAdvance = if (validAdvances.isNotEmpty()) validAdvances.minOrNull() ?: 0.0 else 0.0

    return Location(
        id = id,
        name = name,
        address = address,
        email = email ?: "",
        image_urls = image_urls ?: emptyList(),
        min_advance = min_advance?.toDouble() ?: 0.0,
        supported_sports = supported_sports ?: emptyList(),
        latitude = latitude,
        longitude = longitude,
        open_hour = open_hour ?: 6,
        close_hour = close_hour ?: 23,
        morning_start = morning_start ?: 6,
        morning_end = morning_end ?: 18,
        night_start = night_start ?: 18,
        night_end = night_end ?: 24,
        description = description,
        rating = rating,
        timings = timings,
        contact = contact,
        advance_booking_required = advance_booking_required,
        default_price = defaultPricing?.price ?: 0.0,
        default_advance = lowestAdvance,
        is_open = is_open ?: true,
        number_of_courts = number_of_courts ?: 1,
        courts = courts?.sortedBy { it.courtNumber }
    )
}

private fun normalizeUsername(str: String): String {
    return str.lowercase().replace(Regex("[^a-z0-9]+"), "_").trim('_')
}

object LocationService {

    @OptIn(DelicateCoroutinesApi::class)
    suspend fun getLocations(): List<Location> {
        val data = Supabase.client.postgrest["locations"].select(Columns.raw("*, box_pricing(*), courts(*)")) {
            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        }.decodeList<LocationRow>()
        
        return data.map { row ->
            val domain = row.toDomain()
            
            // Auto-repair missing coordinates in background
            if (domain.address.isNotBlank() && domain.latitude == null) {
                GlobalScope.launch {
                    try {
                        val coords = GeocodingService.getCoordinates(domain.address, "")
                        if (coords != null) {
                            Supabase.client.postgrest["locations"].update({
                                set("latitude", coords.latitude)
                                set("longitude", coords.longitude)
                            }) {
                                filter { eq("id", domain.id) }
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
            
            domain
        }
    }

    suspend fun getLocationById(id: String): Location? {
        return try {
            val data = Supabase.client.postgrest["locations"].select(Columns.raw("*, box_pricing(*), courts(*)")) {
                filter {
                    eq("id", id)
                }
                single()
            }.decodeAs<LocationRow>()
            data.toDomain()
        } catch (e: Exception) {
            null
        }
    }

    suspend fun getLocationsWithAdmins(): List<LocationWithAdmin> {
        val data = Supabase.client.postgrest["locations"].select(Columns.raw("*, admin_accounts(username), courts(*)")) {
            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        }.decodeList<LocationRow>()

        return data.map { loc ->
            LocationWithAdmin(
                id = loc.id,
                name = loc.name,
                address = loc.address,
                email = loc.email ?: "",
                image_urls = loc.image_urls ?: emptyList(),
                min_advance = loc.min_advance?.toDouble() ?: 0.0,
                supported_sports = loc.supported_sports ?: emptyList(),
                latitude = loc.latitude,
                longitude = loc.longitude,
                open_hour = loc.open_hour ?: 6,
                close_hour = loc.close_hour ?: 23,
                morning_start = loc.morning_start ?: 6,
                morning_end = loc.morning_end ?: 18,
                night_start = loc.night_start ?: 18,
                night_end = loc.night_end ?: 24,
                description = loc.description,
                rating = loc.rating,
                timings = loc.timings,
                contact = loc.contact,
                advance_booking_required = loc.advance_booking_required,
                adminUsername = loc.admin_accounts?.firstOrNull()?.username,
                is_open = loc.is_open ?: true
            )
        }
    }

    suspend fun addCourt(court: Court): Court {
        return Supabase.client.postgrest["courts"].insert(court) {
            select()
            single()
        }.decodeAs<Court>()
    }

    suspend fun updateCourt(id: String, updates: Map<String, Any?>) {
        Supabase.client.postgrest["courts"].update({
            updates.forEach { (key, value) ->
                when (value) {
                    is String -> set(key, value)
                    is Int -> set(key, value)
                    is Double -> set(key, value)
                    is Boolean -> set(key, value)
                    is List<*> -> set(key, value)
                    else -> set(key, value.toString())
                }
            }
        }) {
            filter { eq("id", id) }
        }
    }

    suspend fun deleteCourt(id: String) {
        Supabase.client.postgrest["courts"].delete {
            filter { eq("id", id) }
        }
    }

    suspend fun addLocation(loc: Location): Location {
        val newId = UUID.randomUUID().toString()

        // Auto-calculate coordinates if not provided
        var finalLat = loc.latitude
        var finalLng = loc.longitude

        if (finalLat == null || finalLng == null) {
            val coords = GeocodingService.getCoordinates(loc.address, "")
            if (coords != null) {
                if (finalLat == null) finalLat = coords.latitude
                if (finalLng == null) finalLng = coords.longitude
            }
        }

        val insert = LocationInsert(
            id = newId,
            name = loc.name,
            address = loc.address,
            email = loc.email,
            image_urls = loc.imageUrls,
            min_advance = loc.min_advance?.toInt(),
            supported_sports = loc.supportedSports.map { it.value },
            latitude = finalLat,
            longitude = finalLng,
            open_hour = loc.open_hour ?: 6,
            close_hour = loc.close_hour ?: 23,
            morning_start = loc.morning_start ?: 6,
            morning_end = loc.morning_end ?: 18,
            night_start = loc.night_start ?: 18,
            night_end = loc.night_end ?: 24,
            description = loc.description,
            rating = loc.rating,
            timings = loc.timings,
            contact = loc.contact,
            advance_booking_required = loc.advanceBookingRequired,
            is_open = loc.isOpen,
            number_of_courts = loc.numberOfCourts
        )

        val locationData = Supabase.client.postgrest["locations"].insert(insert) {
            select()
            single()
        }.decodeAs<LocationRow>()

        // Create default Court 1
        val court1 = try {
            Supabase.client.postgrest["courts"].insert(mapOf(
                "location_id" to locationData.id,
                "court_number" to 1,
                "name" to "Court 1",
                "image_urls" to emptyList<String>()
            )) {
                select()
            }.decodeAs<List<Court>>().firstOrNull()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }

        // If more than 1 court requested
        if (loc.numberOfCourts > 1) {
            val extraCourts = (2..loc.numberOfCourts).map { i ->
                mapOf(
                    "location_id" to locationData.id,
                    "court_number" to i,
                    "name" to "Court $i",
                    "image_urls" to emptyList<String>()
                )
            }
            try {
                Supabase.client.postgrest["courts"].insert(extraCourts)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // Add default pricing rules for the new arena
        val defaultPricingList = listOf(
            Pricing(location_id = locationData.id, court_id = court1?.id, duration_hours = 1.0, price = 1000.0, advance_price = 500.0, category = "morning", rule_type = "default"),
            Pricing(location_id = locationData.id, court_id = court1?.id, duration_hours = 1.0, price = 1200.0, advance_price = 600.0, category = "night", rule_type = "default"),
            Pricing(location_id = locationData.id, court_id = court1?.id, duration_hours = 1.5, price = 1500.0, advance_price = 750.0, category = "morning", rule_type = "default"),
            Pricing(location_id = locationData.id, court_id = court1?.id, duration_hours = 1.5, price = 1800.0, advance_price = 900.0, category = "night", rule_type = "default")
        )
        try {
            Supabase.client.postgrest["box_pricing"].insert(defaultPricingList)
        } catch (e: Exception) {
            System.err.println("Default pricing creation failed: ${e.message}")
        }

        // Create username from name and the first part of the address
        val firstAddressPart = loc.address.split(",").firstOrNull()?.trim() ?: ""
        val arenaUsername = normalizeUsername("${loc.name} $firstAddressPart")

        try {
            Supabase.client.postgrest["admin_accounts"].insert(
                AdminAccountInsert(
                    username = arenaUsername,
                    password = "1234",
                    email = loc.email,
                    location_id = locationData.id
                )
            )
        } catch (e: Exception) {
            System.err.println("Admin account creation failed: ${e.message}")
        }

        return locationData.toDomain()
    }

    suspend fun deleteLocation(id: String) {
        Supabase.client.postgrest["locations"].delete {
            filter {
                eq("id", id)
            }
        }
    }

    suspend fun updateLocation(id: String, updates: Location) {
        // Recalculate coordinates if address changed and lat/lng not explicitly provided
        val needsGeocode = updates.address.isNotBlank() &&
                updates.latitude == null && updates.longitude == null

        val finalLat: Double?
        val finalLng: Double?

        if (needsGeocode) {
            val coords = GeocodingService.getCoordinates(updates.address, "")
            finalLat = coords?.latitude
            finalLng = coords?.longitude
        } else {
            finalLat = updates.latitude
            finalLng = updates.longitude
        }

        Supabase.client.postgrest["locations"].update({
            if (updates.name.isNotBlank()) set("name", updates.name)
            if (updates.address.isNotBlank()) set("address", updates.address)
            if (updates.email.isNotBlank()) set("email", updates.email)
            set("image_urls", updates.imageUrls)
            set("min_advance", updates.minAdvance.toInt())
            set("supported_sports", updates.supportedSports.map { it.value })
            if (finalLat != null) set("latitude", finalLat)
            if (finalLng != null) set("longitude", finalLng)
            set("open_hour", updates.open_hour ?: 6)
            set("close_hour", updates.close_hour ?: 23)
            set("morning_start", updates.morning_start ?: 6)
            set("morning_end", updates.morning_end ?: 18)
            set("night_start", updates.night_start ?: 18)
            set("night_end", updates.night_end ?: 24)
            if (updates.description != null) set("description", updates.description)
            if (updates.rating != null) set("rating", updates.rating)
            if (updates.timings != null) set("timings", updates.timings)
            if (updates.contact != null) set("contact", updates.contact)
            if (updates.advanceBookingRequired != null) set("advance_booking_required", updates.advanceBookingRequired)
            set("is_open", updates.isOpen)
            set("number_of_courts", updates.numberOfCourts)
        }) {
            filter {
                eq("id", id)
            }
        }
        
        // Handle adding/removing courts if number changed
        if (updates.numberOfCourts != 0) {
            try {
                val currentCourts = Supabase.client.postgrest["courts"].select {
                    filter { eq("location_id", id) }
                }.decodeList<Court>()
                val maxExisting = currentCourts.maxOfOrNull { it.courtNumber } ?: 0
                
                if (updates.numberOfCourts > maxExisting) {
                    val newCourts = (maxExisting + 1..updates.numberOfCourts).map { i ->
                        mapOf(
                            "location_id" to id,
                            "court_number" to i,
                            "name" to "Court $i"
                        )
                    }
                    Supabase.client.postgrest["courts"].insert(newCourts)
                } else if (updates.numberOfCourts < maxExisting) {
                    Supabase.client.postgrest["courts"].delete {
                        filter { 
                            eq("location_id", id)
                            gt("court_number", updates.numberOfCourts)
                        }
                    }
                }
            } catch (e: Exception) {}
        }
    }

    suspend fun updateLocation(id: String, updates: Map<String, Any?>) {
        Supabase.client.postgrest["locations"].update({
            updates.forEach { (key, value) ->
                val dbKey = when (key) {
                    "imageUrls" -> "image_urls"
                    "minAdvance" -> "min_advance"
                    "supportedSports" -> "supported_sports"
                    "openHour" -> "open_hour"
                    "closeHour" -> "close_hour"
                    "morningStart" -> "morning_start"
                    "morningEnd" -> "morning_end"
                    "nightStart" -> "night_start"
                    "nightEnd" -> "night_end"
                    "advanceBookingRequired" -> "advance_booking_required"
                    "defaultPrice" -> "default_price"
                    "defaultAdvance" -> "default_advance"
                    "isOpen" -> "is_open"
                    "numberOfCourts" -> "number_of_courts"
                    else -> key
                }
                if (value != null) {
                    val finalValue = if ((dbKey == "min_advance" || dbKey == "default_price" || dbKey == "default_advance") && value is Double) {
                        value.toInt()
                    } else value

                    when (finalValue) {
                        is String -> set(dbKey, finalValue)
                        is Int -> set(dbKey, finalValue)
                        is Double -> set(dbKey, finalValue)
                        is Boolean -> set(dbKey, finalValue)
                        is List<*> -> set(dbKey, finalValue)
                        else -> set(dbKey, finalValue.toString())
                    }
                } else {
                    set(dbKey, null as String?)
                }
            }
        }) {
            filter {
                eq("id", id)
            }
        }

        // Handle adding/removing courts
        val numCourts = updates["numberOfCourts"] as? Int ?: updates["number_of_courts"] as? Int ?: 0
        if (numCourts > 0) {
            try {
                val currentCourts = Supabase.client.postgrest["courts"].select {
                    filter { eq("location_id", id) }
                }.decodeList<Court>()
                val maxExisting = currentCourts.maxOfOrNull { it.courtNumber } ?: 0
                
                if (numCourts > maxExisting) {
                    val newCourts = (maxExisting + 1..numCourts).map { i ->
                        mapOf(
                            "location_id" to id,
                            "court_number" to i,
                            "name" to "Court $i",
                            "image_urls" to emptyList<String>()
                        )
                    }
                    Supabase.client.postgrest["courts"].insert(newCourts)
                } else if (numCourts < maxExisting) {
                    Supabase.client.postgrest["courts"].delete {
                        filter { 
                            eq("location_id", id)
                            gt("court_number", numCourts)
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    suspend fun resetAdminPassword(locId: String): Pair<String, String> {
        val location = Supabase.client.postgrest["locations"].select {
            filter {
                eq("id", locId)
            }
            single()
        }.decodeAs<LocationNameAddress>()

        val firstAddressPart = location.address.split(",").firstOrNull()?.trim() ?: ""
        val newUsername = normalizeUsername("${location.name} $firstAddressPart")
        val newPassword = "1234"

        Supabase.client.postgrest["admin_accounts"].update({
            set("username", newUsername)
            set("password", newPassword)
        }) {
            filter {
                eq("location_id", locId)
            }
        }

        return newUsername to newPassword
    }

    suspend fun resetAdminCredentials(locId: String, username: String, password: String): Result<Unit> {
        return try {
            val response = Supabase.client.postgrest.rpc(
                "update_admin_credentials",
                mapOf(
                    "p_location_id" to locId,
                    "p_new_username" to username.lowercase().trim(),
                    "p_new_password" to password.trim()
                )
            )

            val rpcResult = response.decodeAs<SuperAdminRpcResult>()
            if (rpcResult.success) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(rpcResult.message))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}



