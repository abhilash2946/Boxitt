package com.boxitt.app.services

import io.ktor.client.*
import io.ktor.client.engine.okhttp.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

data class Coordinates(
    val latitude: Double,
    val longitude: Double
)

@Serializable
private data class NominatimResult(
    val lat: String,
    val lon: String
)

@Serializable
private data class NominatimReverseResult(
    val display_name: String,
    val address: NominatimAddress,
    val lat: String,
    val lon: String
)

@Serializable
private data class NominatimAddress(
    val house_number: String? = null,
    val road: String? = null,
    val neighbourhood: String? = null,
    val suburb: String? = null,
    val village: String? = null,
    val hamlet: String? = null,
    val town: String? = null,
    val city_district: String? = null,
    val county: String? = null,
    val city: String? = null,
    val state: String? = null,
    val country: String? = null,
    val locality: String? = null
)

object GeocodingService {

    private val httpClient = HttpClient(OkHttp) {
        // Accept-Language and User-Agent are set per-request
    }

    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Geocodes an address string into latitude and longitude using Nominatim (OpenStreetMap).
     */
    suspend fun getCoordinates(address: String, location: String): Coordinates? {
        val fullAddress = if (location.isNotBlank()) "$address, $location" else address
        return try {
            val result = fetchCoordinates(fullAddress)
            if (result != null) return result

            // Fallback: try location only
            if (location.isNotBlank()) {
                fetchCoordinates(location)
            } else {
                null
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private suspend fun fetchCoordinates(query: String): Coordinates? {
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        val response: HttpResponse = httpClient.get(
            "https://nominatim.openstreetmap.org/search?format=json&q=$encoded&limit=1"
        ) {
            header("Accept-Language", "en")
            header("User-Agent", "Boxit-App")
        }

        val body = response.bodyAsText()
        val results = json.decodeFromString<List<NominatimResult>>(body)

        return if (results.isNotEmpty()) {
            Coordinates(
                latitude = results[0].lat.toDouble(),
                longitude = results[0].lon.toDouble()
            )
        } else {
            null
        }
    }

    suspend fun reverseGeocode(lat: Double, lon: Double): Pair<String, String>? {
        return try {
            val response: HttpResponse = httpClient.get(
                "https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lon&zoom=18&addressdetails=1"
            ) {
                header("Accept-Language", "en")
                header("User-Agent", "Boxit-App")
            }

            val body = response.bodyAsText()
            val data = json.decodeFromString<NominatimReverseResult>(body)
            
            val addr = data.address
            val parts = mutableListOf<String>()
            
            val village = addr.village ?: addr.suburb ?: addr.neighbourhood ?: addr.hamlet
            val mandal = addr.city_district ?: addr.county ?: addr.town
            
            if (!village.isNullOrEmpty()) parts.add(village)
            if (!mandal.isNullOrEmpty()) {
                val m = if (mandal.lowercase().contains("mandal")) mandal else "$mandal Mandal"
                parts.add(m)
            }

            val newAddress = parts.distinct().joinToString(", ")
            val newLocation = village ?: addr.locality ?: addr.city ?: ""
            
            Pair(newAddress, newLocation)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getCurrentAddress(context: android.content.Context): String? {
        // This remains a placeholder or calls reverseGeocode if we have coordinates.
        // For a more complete implementation, we'd use FusedLocationProviderClient here.
        return null
    }
}





