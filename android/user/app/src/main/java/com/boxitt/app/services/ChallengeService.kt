package com.boxitt.app.services

import com.boxitt.app.ChallengeItem
import com.boxitt.app.ChallengeRequest
import com.boxitt.app.Location
import com.boxitt.app.User
import com.boxitt.app.UserProfile
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.json.*

@Serializable
data class ChallengesAndMatchesResult(
    val items: List<ChallengeItem>,
    val userSentRequests: Set<String>,
    val userAcceptedChallenges: Set<String>,
    val userSentMatchRequests: Set<String>,
    val userAcceptedMatches: Set<String>
)

object ChallengeService {

    /** Fetch all challenges + joinable matches visible to the user */
    suspend fun fetchChallengesAndMatches(
        userId: String?,
        locationId: String? = null,
        sport: String? = null,
        limit: Int = 50,
        offset: Int = 0
    ): ChallengesAndMatchesResult {
        return try {
            // Cleanup: best effort (Parity with Web)
            try {
                Supabase.client.postgrest.rpc("cleanup_expired_matchmaking")
            } catch (e: Exception) { e.printStackTrace() }

            // Fetch challenges
            var challenges = Supabase.client.postgrest["challenges"].select {
                filter {
                    if (locationId != null) eq("box_id", locationId)
                    if (sport != null) {
                        ilike("sport", "%$sport%")
                    }
                }
                order("created_at", Order.DESCENDING)
                range(offset.toLong(), (offset + limit - 1).toLong())
            }.decodeList<RawChallenge>()

            // Fetch joinable bookings (matches)
            var matches = Supabase.client.postgrest["bookings"].select(io.github.jan.supabase.postgrest.query.Columns.raw("*, join_requests(*)")) {
                filter {
                    eq("is_joinable", true)
                    if (locationId != null) eq("location_id", locationId)
                    if (sport != null) {
                        ilike("sport", "%$sport%")
                    }
                }
                order("date", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
                range(offset.toLong(), (offset + limit - 1).toLong())
            }.decodeList<RawMatch>()

            // --- Hydration (Parity with Web fetchItems) ---
            
            // 1. Fetch relevant user profiles
            val allUserIds = mutableSetOf<String>()
            challenges.forEach {
                it.challenger_id?.let { id -> allUserIds.add(id) }
                it.accepted_by?.let { id -> allUserIds.add(id) }
            }
            matches.forEach { 
                it.user_id?.let { id -> allUserIds.add(id) }
            }

            // Also collect requester IDs from matches
            matches.forEach { m ->
                m.join_requests?.forEach { r ->
                    r.requesterId?.let { allUserIds.add(it) }
                }
            }
            
            val userProfiles = if (allUserIds.isNotEmpty()) {
                Supabase.client.postgrest["user_profiles"].select {
                    filter {
                        isIn("id", allUserIds.toList())
                    }
                }.decodeList<UserProfile>()
            } else emptyList()
            val userMap = userProfiles.associateBy { it.id }

            // 2. Fetch relevant locations and bookings
            val allLocationIds = (challenges.mapNotNull { it.box_id } + 
                                matches.mapNotNull { it.location_id }).distinct()
            val locations = if (allLocationIds.isNotEmpty()) {
                Supabase.client.postgrest["locations"].select {
                    filter {
                        isIn("id", allLocationIds)
                    }
                }.decodeList<Location>()
            } else emptyList()
            val locationMap = locations.associateBy { it.id }

            val allBookingIds = challenges.mapNotNull { it.booking_id }.distinct()
            val challengeBookings = if (allBookingIds.isNotEmpty()) {
                Supabase.client.postgrest["bookings"].select {
                    filter {
                        isIn("id", allBookingIds)
                    }
                }.decodeList<JsonObject>()
            } else emptyList()
            val bookingMap = challengeBookings.associateBy { it["id"]?.jsonPrimitive?.content ?: "" }

            // 3. Track state from notifications (Parity with Web)
            val userSentRequests = mutableSetOf<String>()
            val userAcceptedChallenges = mutableSetOf<String>()
            val userSentMatchRequests = mutableSetOf<String>()
            val userAcceptedMatches = mutableSetOf<String>()
            val challengeRequesters = mutableMapOf<String, MutableList<ChallengeRequest>>()

            if (userId != null) {
                val notifs = Supabase.client.postgrest["notifications"].select {
                    filter {
                        eq("user_id", userId)
                    }
                    order("created_at", Order.DESCENDING)
                    limit(200)
                }.decodeList<JsonObject>()

                notifs.forEach { n ->
                    val data = n["data"]?.jsonObject ?: return@forEach
                    val type = data["type"]?.jsonPrimitive?.content ?: return@forEach
                    val reqId = data["requester_id"]?.jsonPrimitive?.content ?: ""

                    when (type) {
                        "challenge_request_sent" -> {
                            if (reqId == userId) {
                                data["challenge_id"]?.jsonPrimitive?.content?.let { userSentRequests.add(it) }
                            }
                        }
                        "challenge_confirmed" -> {
                            data["challenge_id"]?.jsonPrimitive?.content?.let {
                                userSentRequests.add(it)
                                userAcceptedChallenges.add(it)
                            }
                        }
                        "challenge_request" -> {
                            val cId = data["challenge_id"]?.jsonPrimitive?.content ?: return@forEach
                            val requesterId = data["requester_id"]?.jsonPrimitive?.content ?: return@forEach
                            
                            val profile = userMap[requesterId]
                            val req = ChallengeRequest(
                                requesterId = requesterId,
                                requesterUsername = profile?.displayName ?: data["requester_details"]?.jsonObject?.get("display_name")?.jsonPrimitive?.content,
                                requesterPhone = profile?.phoneNumber ?: data["requester_details"]?.jsonObject?.get("phone_number")?.jsonPrimitive?.content,
                                requesterAvatarUrl = profile?.avatar_url ?: data["requester_details"]?.jsonObject?.get("avatar_url")?.jsonPrimitive?.content,
                                groupSize = 1
                            )
                            if (challengeRequesters[cId]?.any { it.requesterId == requesterId } != true) {
                                challengeRequesters.getOrPut(cId) { mutableListOf() }.add(req)
                            }
                        }
                    }
                }
            }

            // Also include challenges where current user was accepted
            challenges.forEach { c ->
                if (userId != null && c.accepted_by == userId) {
                    userSentRequests.add(c.id)
                    userAcceptedChallenges.add(c.id)
                }
            }

            val challengeItems = challenges.map { c ->
                val profile = userMap[c.challenger_id]
                val loc = locationMap[c.box_id]
                val linkedBooking = bookingMap[c.booking_id ?: ""]
                val bookingSport = linkedBooking?.get("sport")?.jsonPrimitive?.contentOrNull
                
                c.toChallengeItem().copy(
                    challengerUsername = profile?.displayName,
                    challengerAvatarUrl = profile?.avatar_url,
                    challengerPhone = profile?.phoneNumber,
                    box = loc,
                    sport = c.sport ?: bookingSport ?: loc?.supportedSports?.firstOrNull()?.name,
                    requests = (challengeRequesters[c.id] ?: (if (c.accepted_by != null) listOf(ChallengeRequest(requesterId = c.accepted_by, requesterUsername = userMap[c.accepted_by]?.displayName, requesterPhone = userMap[c.accepted_by]?.phoneNumber, requesterAvatarUrl = userMap[c.accepted_by]?.avatar_url)) else emptyList()))
                )
            }

            val matchItems = matches.map { m ->
                val profile = userMap[m.user_id]
                val loc = locationMap[m.location_id]
                
                var userPendingMembers = 0
                var userAcceptedMembers = 0

                if (userId != null) {
                    val requests = m.join_requests ?: emptyList()
                    val ownPending = requests.any { it.requesterId == userId && it.status?.lowercase() == "pending" }
                    val ownAccepted = requests.any { it.requesterId == userId && it.status?.lowercase() == "accepted" }
                    if (ownPending) userSentMatchRequests.add(m.id)
                    if (ownAccepted) userAcceptedMatches.add(m.id)

                    requests.forEach { r ->
                        if (r.requesterId == userId) {
                            val count = r.groupSize ?: 1
                            if (r.status?.lowercase() == "pending") {
                                userPendingMembers += count
                            } else if (r.status?.lowercase() == "accepted") {
                                userAcceptedMembers += count
                            }
                        }
                    }
                }

                val mRequesters = m.join_requests?.filter { it.status?.lowercase() == "pending" }?.map { r ->
                    val rProfile = userMap[r.requesterId]
                    val details = r.requesterDetails ?: buildJsonObject {}
                    ChallengeRequest(
                        requesterId = r.requesterId,
                        requesterUsername = rProfile?.displayName ?: r.playerName ?: details["display_name"]?.jsonPrimitive?.contentOrNull,
                        requesterPhone = rProfile?.phoneNumber ?: r.phone ?: details["phone_number"]?.jsonPrimitive?.contentOrNull,
                        requesterAvatarUrl = rProfile?.avatar_url ?: details["avatar_url"]?.jsonPrimitive?.contentOrNull,
                        groupSize = r.groupSize ?: 1,
                        playerName = r.playerName,
                        phone = r.phone
                    )
                } ?: emptyList()
                
                m.toMatchItem().copy(
                    challengerUsername = profile?.displayName,
                    challengerAvatarUrl = profile?.avatar_url,
                    challengerPhone = profile?.phoneNumber,
                    box = loc,
                    sport = m.sport ?: loc?.supportedSports?.firstOrNull()?.name,
                    requests = mRequesters,
                    userPendingMembers = userPendingMembers,
                    userAcceptedMembers = userAcceptedMembers
                )
            }

            ChallengesAndMatchesResult(
                items = (challengeItems + matchItems),
                userSentRequests = userSentRequests,
                userAcceptedChallenges = userAcceptedChallenges,
                userSentMatchRequests = userSentMatchRequests,
                userAcceptedMatches = userAcceptedMatches
            )
        } catch (e: Exception) {
            e.printStackTrace()
            ChallengesAndMatchesResult(
                items = emptyList(),
                userSentRequests = emptySet(),
                userAcceptedChallenges = emptySet(),
                userSentMatchRequests = emptySet(),
                userAcceptedMatches = emptySet()
            )
        }
    }

    /** Send a join request to a challenge */
    suspend fun sendChallengeRequest(item: ChallengeItem, user: User) {
        val userId = user.id ?: throw Exception("User not logged in")
        
        val requesterDetails = buildJsonObject {
            put("username", user.username ?: "")
            put("display_name", user.displayName ?: "")
            put("phone_number", user.phoneNumber ?: "")
            put("avatar_url", user.avatar_url ?: "")
        }

        // Parity with Web: Insert two notifications
        Supabase.client.postgrest["notifications"].insert(listOf(
            buildJsonObject {
                put("user_id", item.challengerId ?: "")
                put("title", "NEW CHALLENGE REQUEST")
                put("message", "${user.displayName ?: user.email} (${user.phoneNumber ?: "N/A"}) requested to accept your challenge at ${item.box?.name ?: "Arena"} for ${item.date} at ${item.slotTime}.")
                put("is_read", false)
                put("data", buildJsonObject {
                    put("type", "challenge_request")
                    put("challenge_id", item.id)
                    put("requester_id", userId)
                    put("date", item.date)
                    put("slot_time", item.slotTime)
                    put("start_hour", item.startHour ?: 0.0)
                    put("end_hour", item.endHour ?: 0.0)
                    put("sport", item.sport ?: "")
                    put("requester_details", requesterDetails)
                })
            },
            buildJsonObject {
                put("user_id", userId)
                put("title", "Request Sent")
                put("message", "Request sent to ${item.challengerUsername ?: "challenger"} (${item.challengerPhone ?: "N/A"}) for ${item.box?.name ?: "Arena"} on ${item.date} at ${item.slotTime}.")
                put("is_read", false)
                put("data", buildJsonObject {
                    put("type", "challenge_request_sent")
                    put("challenge_id", item.id)
                    put("requester_id", userId)
                    put("challenger_id", item.challengerId ?: "")
                    put("date", item.date)
                    put("slot_time", item.slotTime)
                    put("sport", item.sport ?: "")
                })
            }
        ))
    }

    /** Send a join request to a joinable match */
    @Serializable
    private data class SubmitJoinParams(
        val p_booking_id: String,
        val p_requester_id: String,
        val p_player_name: String,
        val p_phone: String,
        val p_group_size: Int,
        val p_requester_details: JsonElement
    )

    suspend fun sendMatchJoinRequest(item: ChallengeItem, user: User, groupSize: Int = 1) {
        val userId = user.id ?: throw Exception("User not logged in")

        val requesterDetails = buildJsonObject {
            put("username", user.username ?: "")
            put("display_name", user.displayName ?: "")
            put("phone_number", user.phoneNumber ?: "")
            put("avatar_url", user.avatar_url ?: "")
            put("email", user.email ?: "")
        }

        // 1. Submit join request RPC
        Supabase.client.postgrest.rpc("submit_match_join_request", SubmitJoinParams(
            p_booking_id = item.id,
            p_requester_id = userId,
            p_player_name = user.displayName ?: user.username ?: user.email ?: "User",
            p_phone = user.phoneNumber ?: "N/A",
            p_group_size = groupSize,
            p_requester_details = requesterDetails
        ))

        // 2. Insert notifications
        Supabase.client.postgrest["notifications"].insert(listOf(
            buildJsonObject {
                put("user_id", item.userId ?: item.challengerId ?: "")
                put("title", "NEW JOINABLE REQUEST")
                put("message", "${user.displayName ?: user.email ?: "A player"} (${user.phoneNumber ?: "N/A"}) requested to join with $groupSize player(s) for your match on ${item.date} at ${item.slotTime}.")
                put("is_read", false)
                put("data", buildJsonObject {
                    put("type", "match_join_request")
                    put("booking_id", item.id)
                    put("requester_id", userId)
                    put("groupSize", groupSize)
                    put("playerName", user.displayName ?: user.username ?: user.email)
                    put("phone", user.phoneNumber)
                    put("sport", item.sport ?: "")
                })
            },
            buildJsonObject {
                put("user_id", userId)
                put("title", "Request Sent")
                put("message", "Your join request for the match at ${item.box?.name ?: "Arena"} on ${item.date} at ${item.slotTime} has been sent.")
                put("is_read", false)
                put("data", buildJsonObject {
                    put("type", "match_join_request_sent")
                    put("booking_id", item.id)
                    put("host_id", item.userId ?: item.challengerId ?: "")
                    put("sport", item.sport ?: "")
                })
            }
        ))
    }

    /** Accept a challenge join request (challenger calls this) */
    suspend fun acceptChallengeRequest(item: ChallengeItem, requesterId: String, user: User) {
        val isAdvance = item.paymentType == "advance" || ((item.box?.minAdvance ?: 0) > 0)
        val initialStatus = if (isAdvance) "pending_payment" else "booked"
        val acceptorPaymentStatus = if (isAdvance) "pending" else "paid"

        @Serializable
        data class AcceptChallengeParams(val p_challenge_id: String, val p_requester_id: String)

        val rpcSuccess = try {
            Supabase.client.postgrest.rpc("accept_challenge_request", AcceptChallengeParams(item.id, requesterId))
            true
        } catch (e: Exception) {
            println("RPC accept_challenge_request failed, using direct update fallback: ${e.message}")
            false
        }

        if (!rpcSuccess) {
            // 1. Fallback update challenge status
            Supabase.client.postgrest["challenges"].update({
                set("accepted_by", requesterId)
                set("status", initialStatus)
                set("acceptor_payment_status", acceptorPaymentStatus)
            }) { 
                filter { eq("id", item.id) }
            }

            val requesterProfile = try {
                Supabase.client.postgrest["user_profiles"].select {
                    filter { eq("id", requesterId) }
                    single()
                }.decodeAs<UserProfile>()
            } catch (e: Exception) {
                null
            }

            val notifTypeRequester = if (isAdvance) "challenge_payment_pending" else "challenge_confirmed"
            val notifTypeHost = if (isAdvance) "challenge_waiting_payment" else "challenge_confirmed_host"

            val titleRequester = if (isAdvance) "CHALLENGE REQUEST ACCEPTED - PAYMENT REQUIRED" else "Challenge Request Accepted!"
            val titleHost = if (isAdvance) "WAITING FOR ACCEPTOR PAYMENT" else "Challenge Request Accepted!"

            val msgRequester = if (isAdvance) "${user.displayName ?: user.email ?: "Host"} accepted your request. Please pay the advance to confirm the match." else "${user.displayName ?: user.email} accepted your challenge request. Match confirmed for ${item.box?.name ?: "Arena"} at ${item.slotTime}!"
            val msgHost = if (isAdvance) "You accepted ${requesterProfile?.displayName ?: requesterProfile?.email ?: "a player"}. Match will be confirmed once they pay the advance." else "You have accepted the request from ${requesterProfile?.displayName ?: requesterProfile?.email ?: "a player"} for ${item.box?.name ?: "Arena"} at ${item.slotTime}. Match confirmed!"

            // 2. Parity with Web: Insert confirmation notifications
            Supabase.client.postgrest["notifications"].insert(listOf(
                buildJsonObject {
                    put("user_id", requesterId)
                    put("title", titleRequester)
                    put("message", msgRequester)
                    put("is_read", false)
                    put("data", buildJsonObject {
                        put("type", notifTypeRequester)
                        put("challenge_id", item.id)
                        put("challenger_id", user.id ?: "")
                        put("requester_id", requesterId)
                        put("date", item.date)
                        put("slot_time", item.slotTime)
                        put("sport", item.sport ?: "")
                        put("challenger_details", buildJsonObject {
                            put("username", user.username ?: "")
                            put("display_name", user.displayName ?: "")
                            put("phone_number", user.phoneNumber ?: "")
                            put("avatar_url", user.avatar_url ?: "")
                        })
                    })
                },
                buildJsonObject {
                    put("user_id", user.id ?: "")
                    put("title", titleHost)
                    put("message", msgHost)
                    put("is_read", false)
                    put("data", buildJsonObject {
                        put("type", notifTypeHost)
                        put("challenge_id", item.id)
                        put("requester_id", requesterId)
                        put("challenger_id", user.id ?: "")
                        put("date", item.date)
                        put("slot_time", item.slotTime)
                        put("sport", item.sport ?: "")
                    })
                }
            ))
        }
    }

    /** Accept a match join request */
    suspend fun acceptMatchJoinRequest(item: ChallengeItem, requesterId: String, user: User) {
        @Serializable
        data class AcceptParams(val p_booking_id: String, val p_requester_id: String)
        
        Supabase.client.postgrest.rpc("accept_match_join_request", AcceptParams(item.id, requesterId))

        // Parity with Web: Insert notifications
        val req = try {
            Supabase.client.postgrest["join_requests"].select {
                filter {
                    eq("booking_id", item.id)
                    eq("requester_id", requesterId)
                }
                single()
            }.decodeAs<RawRequest>()
        } catch (e: Exception) { null }

        Supabase.client.postgrest["notifications"].insert(listOf(
            buildJsonObject {
                put("user_id", requesterId)
                put("title", "JOINABLE REQUEST ACCEPTED!")
                put("message", "${user.displayName ?: user.email} (${user.phoneNumber ?: "N/A"}) accepted your join request for the match at ${item.box?.name ?: "Arena"} on ${item.date} at ${item.slotTime}.")
                put("is_read", false)
                put("data", buildJsonObject {
                    put("type", "match_join_confirmed")
                    put("booking_id", item.id)
                    put("requester_id", requesterId)
                    put("date", item.date)
                    put("slot_time", item.slotTime)
                    put("sport", item.sport ?: "")
                })
            },
            buildJsonObject {
                put("user_id", user.id ?: "")
                put("title", "JOINABLE REQUEST ACCEPTED!")
                put("message", "You have accepted the request from ${req?.playerName ?: "a player"} for the match at ${item.box?.name ?: "Arena"} on ${item.date} at ${item.slotTime}.")
                put("is_read", false)
                put("data", buildJsonObject {
                    put("type", "match_join_confirmed_host")
                    put("booking_id", item.id)
                    put("requester_id", requesterId)
                    put("date", item.date)
                    put("slot_time", item.slotTime)
                    put("sport", item.sport ?: "")
                })
            }
        ))
    }

    /** Cancel a sent join request */
    suspend fun cancelJoinRequest(itemId: String, userId: String, hostId: String, user: User, itemName: String? = null, itemDate: String? = null, slotTime: String? = null, itemSport: String? = null) {
        @Serializable
        data class CancelParams(val p_booking_id: String, val p_requester_id: String)

        try {
            Supabase.client.postgrest.rpc("cancel_match_join_request", CancelParams(itemId, userId))
        } catch (e: Exception) { e.printStackTrace() }

        // 2. Send Cancellation Notifications
        try {
            val cancelNotifs = listOf(
                buildJsonObject {
                    put("user_id", hostId)
                    put("title", "REQUEST CANCELLED")
                    put("message", "${user.displayName ?: user.email} cancelled their request for ${itemName ?: "Arena"} on ${itemDate ?: ""} at ${slotTime ?: "Scheduled Time"}.")
                    put("is_read", false)
                    put("data", buildJsonObject {
                        put("type", "request_cancelled")
                        put("booking_id", itemId)
                        put("challenge_id", itemId)
                        put("requester_id", userId)
                        put("date", itemDate ?: "")
                        put("slot_time", slotTime ?: "")
                        put("sport", itemSport ?: "")
                    })
                },
                buildJsonObject {
                    put("user_id", userId)
                    put("title", "REQUEST CANCELLED")
                    put("message", "Your request for ${itemName ?: "Arena"} on ${itemDate ?: ""} at ${slotTime ?: "Scheduled Time"} has been cancelled.")
                    put("is_read", false)
                    put("data", buildJsonObject {
                        put("type", "request_cancelled_self")
                        put("booking_id", itemId)
                        put("challenge_id", itemId)
                        put("host_id", hostId)
                        put("date", itemDate ?: "")
                        put("slot_time", slotTime ?: "")
                        put("sport", itemSport ?: "")
                    })
                }
            )
            Supabase.client.postgrest["notifications"].insert(cancelNotifs)
        } catch (e: Exception) { e.printStackTrace() }

        // 3. Delete existing "Request Sent" / "New Request" notifications to clear UI state
        try {
            val oldNotifs = Supabase.client.postgrest["notifications"].select {
                filter {
                    or {
                        eq("user_id", hostId)
                        eq("user_id", userId)
                    }
                }
            }.decodeList<JsonObject>()

            val idsToDelete = oldNotifs.filter { n ->
                val d = n["data"]?.jsonObject
                val isMatch = d?.get("booking_id")?.jsonPrimitive?.content == itemId || d?.get("challenge_id")?.jsonPrimitive?.content == itemId
                val type = d?.get("type")?.jsonPrimitive?.content
                val isRelevantType = type in listOf("challenge_request", "challenge_request_sent", "match_join_request", "match_join_request_sent")
                isMatch && isRelevantType
            }.map { it["id"]?.jsonPrimitive?.content ?: "" }.filter { it.isNotBlank() }

            if (idsToDelete.isNotEmpty()) {
                Supabase.client.postgrest["notifications"].delete {
                    filter {
                        isIn("id", idsToDelete)
                    }
                }
            }
        } catch (e: Exception) { e.printStackTrace() }
    }

    /** Reject/decline a challenge join request */
    suspend fun rejectChallengeRequest(item: ChallengeItem, requesterId: String, user: User) {
        @Serializable
        data class RejectParams(val p_challenge_id: String, val p_requester_id: String)

        try {
            Supabase.client.postgrest.rpc("reject_challenge_request", RejectParams(item.id, requesterId))
        } catch (e: Exception) { e.printStackTrace() }

        // Send rejection notification to requester
        try {
            Supabase.client.postgrest["notifications"].insert(listOf(
                buildJsonObject {
                    put("user_id", requesterId)
                    put("title", "CHALLENGE REQUEST REJECTED")
                    put("message", "${user.displayName ?: user.username ?: "The challenger"} declined your request for the match at ${item.box?.name ?: "Arena"} on ${item.date}.")
                    put("is_read", false)
                    put("data", buildJsonObject {
                        put("type", "challenge_rejected")
                        put("challenge_id", item.id)
                        put("challenger_id", user.id ?: "")
                        put("date", item.date)
                        put("slot_time", item.slotTime)
                        put("sport", item.sport ?: "")
                    })
                }
            ))
        } catch (e: Exception) { e.printStackTrace() }
    }
}

// ─── Raw DB models ────────────────────────────────────────────────────────────

@Serializable
private data class RawRequest(
    val id: String? = null,
    @SerialName("requester_id") val requesterId: String? = null,
    @SerialName("player_name") val playerName: String? = null,
    val phone: String? = null,
    @SerialName("group_size") val groupSize: Int? = null,
    val status: String? = "pending",
    @SerialName("requester_details") val requesterDetails: JsonObject? = null,
    @SerialName("requested_at") val requestedAt: String? = null
) {
    fun toChallengeRequest(): ChallengeRequest {
        val details = requesterDetails ?: buildJsonObject {}
        return ChallengeRequest(
            requesterId = requesterId,
            requesterUsername = playerName ?: details["display_name"]?.jsonPrimitive?.contentOrNull,
            requesterPhone = phone ?: details["phone_number"]?.jsonPrimitive?.contentOrNull,
            requesterAvatarUrl = details["avatar_url"]?.jsonPrimitive?.contentOrNull,
            groupSize = groupSize,
            playerName = playerName,
            phone = phone
        )
    }
}

@Serializable
private data class RawChallenge(
    val id: String,
    val status: String = "active",
    val challenger_id: String? = null,
    val accepted_by: String? = null,
    val box_id: String? = null,
    val slot_time: String = "",
    val date: String = "",
    val is_expired: Boolean = false,
    val created_at: String? = null,
    val auto_delete_at: String? = null,
    val start_hour: Double? = null,
    val end_hour: Double? = null,
    val booking_id: String? = null,
    val sport: String? = null,
    val max_players: Int? = null,
    val current_players: Int? = null
) {
    fun toChallengeItem() = ChallengeItem(
        id = id, type = "challenge", status = status,
        challengerId = challenger_id, acceptedBy = accepted_by,
        locationId = box_id, slotTime = slot_time, date = date,
        isExpired = is_expired,
        createdAt = created_at,
        autoDeleteAt = auto_delete_at,
        startHour = start_hour,
        endHour = end_hour,
        sport = sport,
        maxPlayers = max_players,
        currentPlayers = current_players
    )
}

@Serializable
private data class RawMatch(
    val id: String,
    val user_id: String? = null,
    val location_id: String? = null,
    val slot_time: String = "",
    val date: String = "",
    val is_expired: Boolean = false,
    val current_players: Int? = null,
    val max_players: Int? = null,
    val join_requests: List<RawRequest>? = null,
    val is_joinable: Boolean = false,
    val start_hour: Double? = null,
    val end_hour: Double? = null,
    val sport: String? = null
) {
    fun toMatchItem() = ChallengeItem(
        id = id, type = "match", status = "active",
        challengerId = user_id, userId = user_id,
        locationId = location_id, slotTime = slot_time, date = date,
        currentPlayers = current_players, maxPlayers = max_players,
        isExpired = is_expired,
        startHour = start_hour,
        endHour = end_hour,
        sport = sport
    )
}
