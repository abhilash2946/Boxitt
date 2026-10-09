package com.boxitt.app.services

import com.boxitt.app.GameZonePlatform
import com.boxitt.app.GameZoneResource
import com.boxitt.app.GameZoneGame
import com.boxitt.app.GameZoneBlockout
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order

object GameZoneService {

    suspend fun getPlatforms(locationId: String): List<GameZonePlatform> {
        if (locationId.isBlank()) return emptyList()
        return try {
            Supabase.client.postgrest["game_zone_platforms"].select {
                filter { eq("location_id", locationId) }
                order("name", Order.ASCENDING)
            }.decodeList<GameZonePlatform>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getResources(locationId: String, platformId: String? = null): List<GameZoneResource> {
        if (locationId.isBlank()) return emptyList()
        return try {
            Supabase.client.postgrest["game_zone_resources"].select {
                filter {
                    eq("location_id", locationId)
                    if (!platformId.isNullOrBlank()) {
                        eq("platform_id", platformId)
                    }
                }
                order("name", Order.ASCENDING)
            }.decodeList<GameZoneResource>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getGames(locationId: String): List<GameZoneGame> {
        if (locationId.isBlank()) return emptyList()
        return try {
            Supabase.client.postgrest["game_zone_games"].select {
                filter { eq("location_id", locationId) }
                order("title", Order.ASCENDING)
            }.decodeList<GameZoneGame>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getBlockouts(locationId: String): List<GameZoneBlockout> {
        if (locationId.isBlank()) return emptyList()
        return try {
            Supabase.client.postgrest["game_zone_blockouts"].select {
                filter { eq("location_id", locationId) }
            }.decodeList<GameZoneBlockout>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun createPlatform(platform: Map<String, Any?>): GameZonePlatform? {
        return try {
            Supabase.client.postgrest["game_zone_platforms"].insert(platform) {
                select()
                single()
            }.decodeAs<GameZonePlatform>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun updatePlatform(platformId: String, updates: Map<String, Any?>): Boolean {
        return try {
            Supabase.client.postgrest["game_zone_platforms"].update(updates) {
                filter { eq("id", platformId) }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun deletePlatform(platformId: String): Boolean {
        return try {
            Supabase.client.postgrest["game_zone_platforms"].delete {
                filter { eq("id", platformId) }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun createResource(resource: Map<String, Any?>): GameZoneResource? {
        return try {
            Supabase.client.postgrest["game_zone_resources"].insert(resource) {
                select()
                single()
            }.decodeAs<GameZoneResource>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun updateResource(resourceId: String, updates: Map<String, Any?>): Boolean {
        return try {
            Supabase.client.postgrest["game_zone_resources"].update(updates) {
                filter { eq("id", resourceId) }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun deleteResource(resourceId: String): Boolean {
        return try {
            Supabase.client.postgrest["game_zone_resources"].delete {
                filter { eq("id", resourceId) }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun createGame(game: Map<String, Any?>): GameZoneGame? {
        return try {
            Supabase.client.postgrest["game_zone_games"].insert(game) {
                select()
                single()
            }.decodeAs<GameZoneGame>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun deleteGame(gameId: String): Boolean {
        return try {
            Supabase.client.postgrest["game_zone_games"].delete {
                filter { eq("id", gameId) }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
