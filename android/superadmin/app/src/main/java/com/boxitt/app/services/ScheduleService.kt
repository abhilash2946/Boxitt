package com.boxitt.app.services

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DaySchedule(
    val id: String? = null,
    val location_id: String,
    val date: String, // YYYY-MM-DD
    val status: String, // "green" | "red" | "normal"
    val closed_option: String? = null, // "one_time" | "weekly" | "monthly" | "yearly"
    val closure_type: String? = null, // "full" | "partial"
    val start_time: String? = null,
    val end_time: String? = null,
    val note: String? = null
)

@Serializable
private data class DayScheduleInsert(
    val location_id: String,
    val date: String,
    val status: String,
    val closed_option: String? = null,
    val closure_type: String? = null,
    val start_time: String? = null,
    val end_time: String? = null,
    val note: String? = null
)

object ScheduleService {
    suspend fun getSchedules(locationId: String): List<DaySchedule> {
        return try {
            Supabase.client.postgrest.from("box_schedules")
                .select {
                    filter {
                        eq("location_id", locationId)
                    }
                }
                .decodeList<DaySchedule>()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun saveSchedulesBatch(locationId: String, schedules: List<DaySchedule>): Boolean {
        return try {
            // 1. Clear existing schedules for this location
            Supabase.client.postgrest.from("box_schedules")
                .delete {
                    filter {
                        eq("location_id", locationId)
                    }
                }

            // 2. Insert new batch if not empty
            if (schedules.isNotEmpty()) {
                val payload = schedules.map { s ->
                    DayScheduleInsert(
                        location_id = locationId,
                        date = s.date,
                        status = s.status,
                        closed_option = if (s.status == "red") s.closed_option ?: "one_time" else null,
                        closure_type = if (s.status == "red") s.closure_type ?: "full" else null,
                        start_time = if (s.status == "red" && s.closure_type == "partial") s.start_time else null,
                        end_time = if (s.status == "red" && s.closure_type == "partial") s.end_time else null,
                        note = s.note
                    )
                }

                Supabase.client.postgrest.from("box_schedules")
                    .insert(payload)
            }
            true
        } catch (e: Exception) {
            throw e
        }
    }
}
