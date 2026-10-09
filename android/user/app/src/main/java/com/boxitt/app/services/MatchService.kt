package com.boxitt.app.services

import android.content.Context
import com.boxitt.app.SportType
import org.json.JSONArray
import org.json.JSONObject

data class MatchSummary(
    val id: String,
    val sport: SportType,
    val teamA: String,
    val teamB: String,
    val scoreA: String,
    val scoreB: String,
    val status: String,
    val date: String,
    val locationId: String? = null
)

object MatchService {
    private const val SCORER_PREFS = "scorer"
    
    fun loadAllMatches(context: Context): List<MatchSummary> {
        val matches = mutableListOf<MatchSummary>()
        
        matches.addAll(loadCricket(context))
        matches.addAll(loadFootball(context))
        matches.addAll(loadBasketball(context))
        matches.addAll(loadTennis(context))
        matches.addAll(loadBadminton(context))
        
        return matches.sortedByDescending { it.date }
    }

    private fun loadCricket(context: Context): List<MatchSummary> {
        return try {
            val raw = context.getSharedPreferences(SCORER_PREFS, Context.MODE_PRIVATE).getString("cricket_matches", null) ?: return emptyList()
            val arr = JSONArray(raw)
            (0 until arr.length()).map { 
                val obj = arr.getJSONObject(it)
                val innings = obj.optJSONArray("innings")
                val scoreA = if (innings != null && innings.length() > 0) "${innings.getJSONObject(0).optInt("runs")}/${innings.getJSONObject(0).optJSONArray("batsmen")?.let { b -> (0 until b.length()).count { i -> b.getJSONObject(i).optBoolean("isOut") } } ?: 0}" else "0/0"
                val scoreB = if (innings != null && innings.length() > 1) "${innings.getJSONObject(1).optInt("runs")}/${innings.getJSONObject(1).optJSONArray("batsmen")?.let { b -> (0 until b.length()).count { i -> b.getJSONObject(i).optBoolean("isOut") } } ?: 0}" else "0/0"
                MatchSummary(
                    id = obj.getString("id"),
                    sport = SportType.CRICKET,
                    teamA = obj.getString("teamA"),
                    teamB = obj.getString("teamB"),
                    scoreA = scoreA,
                    scoreB = scoreB,
                    status = obj.optString("status", "Live"),
                    date = obj.optString("createdAt", ""),
                    locationId = obj.optString("locationId")
                )
            }
        } catch (e: Exception) { emptyList() }
    }

    private fun loadFootball(context: Context): List<MatchSummary> {
        return try {
            val raw = context.getSharedPreferences(SCORER_PREFS, Context.MODE_PRIVATE).getString("football_matches", null) ?: return emptyList()
            val arr = JSONArray(raw)
            (0 until arr.length()).map { 
                val obj = arr.getJSONObject(it)
                MatchSummary(
                    id = obj.getString("id"),
                    sport = SportType.FOOTBALL,
                    teamA = obj.getString("teamA"),
                    teamB = obj.getString("teamB"),
                    scoreA = obj.optInt("scoreA").toString(),
                    scoreB = obj.optInt("scoreB").toString(),
                    status = obj.optString("status", "Live"),
                    date = obj.optString("createdAt", ""),
                    locationId = obj.optString("locationId")
                )
            }
        } catch (e: Exception) { emptyList() }
    }

    private fun loadBasketball(context: Context): List<MatchSummary> {
        return try {
            val raw = context.getSharedPreferences(SCORER_PREFS, Context.MODE_PRIVATE).getString("basketball_matches", null) ?: return emptyList()
            val arr = JSONArray(raw)
            (0 until arr.length()).map { 
                val obj = arr.getJSONObject(it)
                MatchSummary(
                    id = obj.getString("id"),
                    sport = SportType.BASKETBALL,
                    teamA = obj.getString("teamA"),
                    teamB = obj.getString("teamB"),
                    scoreA = obj.optInt("scoreA").toString(),
                    scoreB = obj.optInt("scoreB").toString(),
                    status = obj.optString("status", "Live"),
                    date = obj.optString("createdAt", ""),
                    locationId = obj.optString("locationId")
                )
            }
        } catch (e: Exception) { emptyList() }
    }

    private fun loadTennis(context: Context): List<MatchSummary> {
        return try {
            val raw = context.getSharedPreferences(SCORER_PREFS, Context.MODE_PRIVATE).getString("tennis_matches", null) ?: return emptyList()
            val arr = JSONArray(raw)
            (0 until arr.length()).map { 
                val obj = arr.getJSONObject(it)
                MatchSummary(
                    id = obj.getString("id"),
                    sport = SportType.TENNIS,
                    teamA = obj.getString("playerA"),
                    teamB = obj.getString("playerB"),
                    scoreA = "Sets: ${obj.optInt("setsA")}",
                    scoreB = "Sets: ${obj.optInt("setsB")}",
                    status = obj.optString("status", "Live"),
                    date = obj.optString("createdAt", ""),
                    locationId = obj.optString("locationId")
                )
            }
        } catch (e: Exception) { emptyList() }
    }

    private fun loadBadminton(context: Context): List<MatchSummary> {
        return try {
            val raw = context.getSharedPreferences(SCORER_PREFS, Context.MODE_PRIVATE).getString("badminton_matches", null) ?: return emptyList()
            val arr = JSONArray(raw)
            (0 until arr.length()).map { 
                val obj = arr.getJSONObject(it)
                MatchSummary(
                    id = obj.getString("id"),
                    sport = SportType.BADMINTON,
                    teamA = obj.getString("playerA"),
                    teamB = obj.getString("playerB"),
                    scoreA = "Games: ${obj.optInt("gamesA")}",
                    scoreB = "Games: ${obj.optInt("gamesB")}",
                    status = obj.optString("status", "Live"),
                    date = obj.optString("createdAt", ""),
                    locationId = obj.optString("locationId")
                )
            }
        } catch (e: Exception) { emptyList() }
    }
}
