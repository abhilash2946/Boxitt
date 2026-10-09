package com.boxitt.app

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.json.JsonElement

// ─── Enums ───────────────────────────────────────────────────────────────────

@Serializable
enum class BookingStatus(val value: String) {
    @SerialName("pending") PENDING("pending"),
    @SerialName("approved") APPROVED("approved"),
    @SerialName("rejected") REJECTED("rejected"),
    @SerialName("cancelled") CANCELLED("cancelled"),
    @SerialName("completed") COMPLETED("completed"),
    @SerialName("booked") BOOKED("booked"),
    @SerialName("confirmed") CONFIRMED("confirmed"),
    @SerialName("timed_out") TIMED_OUT("timed_out"),
    @SerialName("declined") DECLINED("declined")
}

@Serializable
enum class PaymentMethod(val value: String) {
    CASH("Cash"),
    ONLINE("Online")
}

@Serializable
enum class PaymentTypeGlobal(val value: String) {
    FULL("full"),
    ADVANCE("advance")
}

typealias PaymentType = PaymentTypeGlobal

@Serializable
enum class SportType(val value: String) {
    @SerialName("Box Cricket") CRICKET("Box Cricket"),
    @SerialName("Box Football") FOOTBALL("Box Football"),
    @SerialName("Box Tennis") TENNIS("Box Tennis"),
    @SerialName("Box Basketball") BASKETBALL("Box Basketball"),
    @SerialName("Box Badminton") BADMINTON("Box Badminton"),
    @SerialName("Box Pickleball") PICKLEBALL("Box Pickleball"),
    @SerialName("Swimming") SWIMMING("Swimming"),
    @SerialName("Game Zone") GAME_ZONE("Game Zone");

    companion object {
        fun parseSportParam(param: String?): SportType {
            if (param.isNullOrBlank()) return CRICKET
            val clean = param.lowercase().replace(Regex("[-_ ]"), "")
            if (clean.contains("pickle") || clean.contains("pickel")) return PICKLEBALL
            if (clean.contains("game") || clean.contains("zone")) return GAME_ZONE
            if (clean.contains("swim")) return SWIMMING
            if (clean.contains("badminton")) return BADMINTON
            if (clean.contains("tennis") || clean.contains("ten")) return TENNIS
            if (clean.contains("basket") || clean.contains("harsh")) return BASKETBALL
            if (clean.contains("foot") || clean.contains("futsal") || clean.contains("soccer") || clean.contains("cr7")) return FOOTBALL
            if (clean.contains("cricket") || clean.contains("ball")) return CRICKET
            for (type in values()) {
                val keyClean = type.name.lowercase().replace(Regex("[-_ ]"), "")
                val valClean = type.value.lowercase().replace(Regex("[-_ ]"), "")
                if (keyClean == clean || valClean == clean || clean.contains(keyClean) || keyClean.contains(clean)) {
                    return type
                }
            }
            return CRICKET
        }
    }
}

@Serializable
enum class ImageSize(val value: String) {
    SIZE_1K("1K"),
    SIZE_2K("2K"),
    SIZE_4K("4K")
}

@Serializable
enum class AdminTab { BOOKINGS, LOCATIONS, REPORTS, SECURITY, TIMING, PRICING, ABOUT }

@Serializable
enum class TimeFilter { DAY, MONTH, YEAR }

@Serializable
enum class RuleType { DEFAULT, DAY, DATE }

// ─── UserProfile ─────────────────────────────────────────────────────────────

@Serializable
data class UserProfile(
    val id: String? = null,
    val email: String = "",
    val email_address: String? = null,
    val display_name: String? = null,
    val phone_number: String? = null,
    val avatar_url: String? = null,
    val created_at: String? = null,
    val role: String? = null,
    val role_status: String? = null,
    val requested_role: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val username: String? = null,
    val phone: String? = null,
    val dob: String? = null,
    val date_of_birth: String? = null,
    val gender: String? = null,
    val address: String? = null,
    val profileImage: String? = null,
    val location: String? = null,
    val joinedDate: String? = null,
    val joined_date: String? = null
) {
    val displayName: String? get() = display_name ?: username
    val phoneNumber: String? get() = phone_number ?: phone
    val profileImageUrl: String? get() = profileImage ?: avatar_url
    val dateOfBirth: String? get() = date_of_birth ?: dob

    val isComplete: Boolean get() = 
        !email.isNullOrEmpty() &&
        !displayName.isNullOrEmpty() &&
        !phoneNumber.isNullOrEmpty() &&
        !dateOfBirth.isNullOrEmpty() &&
        !gender.isNullOrEmpty() &&
        !role.isNullOrEmpty() &&
        !address.isNullOrEmpty()
}

@Serializable
data class UserProfileUpdate(
    val id: String,
    val email: String? = null,
    val display_name: String? = null,
    val username: String? = null,
    val phone_number: String? = null,
    val dob: String? = null,
    val gender: String? = null,
    val address: String? = null,
    val location: String? = null,
    val avatar_url: String? = null,
    val role: String? = null,
    val role_status: String? = null,
    val requested_role: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null
)

// ─── User ────────────────────────────────────────────────────────────────────

@Serializable
data class User(
    val id: String? = null,
    val email: String = "",
    val email_address: String? = null,
    val username: String? = null,
    val isLoggedIn: Boolean = true,
    val display_name: String? = null,
    val phone_number: String? = null,
    val avatar_url: String? = null,
    val role: String? = null,
    val role_status: String? = null,
    val requested_role: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val address: String? = null,
    val selectedLocationId: String? = null,
    val profileImage: String? = null,
    val joined_date: String? = null,
    val date_of_birth: String? = null,
    val dob: String? = null,
    val gender: String? = null,
    val phone: String? = null,
    val location: String? = null
) {
    val dateOfBirth: String? get() = date_of_birth ?: dob
    val displayName: String? get() = display_name ?: username
    val phoneNumber: String? get() = phone_number ?: phone
    val profileImageUrl: String? get() = profileImage ?: avatar_url

    val isComplete: Boolean get() = 
        !email.isNullOrEmpty() &&
        !displayName.isNullOrEmpty() &&
        !phoneNumber.isNullOrEmpty() &&
        !dateOfBirth.isNullOrEmpty() &&
        !gender.isNullOrEmpty() &&
        !role.isNullOrEmpty() &&
        !address.isNullOrEmpty()

    fun toUserProfile() = UserProfile(
        id = id,
        email = email,
        display_name = display_name,
        phone_number = phone_number,
        avatar_url = avatar_url,
        role = role,
        role_status = role_status,
        requested_role = requested_role,
        latitude = latitude,
        longitude = longitude,
        profileImage = profileImage,
        joined_date = joined_date,
        location = location,
        date_of_birth = date_of_birth,
        dob = dob,
        gender = gender
    )
}

// ─── Location ────────────────────────────────────────────────────────────────

@Serializable
data class Location(
    val id: String,
    val name: String,
    val address: String,
    val email: String = "",
    val image_urls: List<String>? = null,
    val min_advance: Double? = null,
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
    @SerialName("rating_count") val rating_count: Int? = null,
    val timings: String? = null,
    val contact: String? = null,
    val advance_booking_required: Boolean? = null,
    val default_price: Double? = null,
    val default_advance: Double? = null,
    val is_open: Boolean? = null,
    val number_of_courts: Int? = null,
    val max_capacity: Int? = null,
    val courts: List<Court>? = null
) {
    val imageUrls: List<String> get() = image_urls ?: emptyList()
    val minAdvance: Double get() = min_advance ?: 0.0
    val ratingCount: Int get() = rating_count ?: 0
    val supportedSports: List<SportType> get() = supported_sports?.mapNotNull { s ->
        SportType.values().firstOrNull { it.value == s || it.name == s }
    } ?: emptyList()
    val openHour: Int? get() = open_hour
    val closeHour: Int? get() = close_hour
    val morningStart: Int? get() = morning_start
    val morningEnd: Int? get() = morning_end
    val nightStart: Int? get() = night_start
    val nightEnd: Int? get() = night_end
    val advanceBookingRequired: Boolean? get() = advance_booking_required
    val defaultPrice: Double? get() = default_price
    val defaultAdvance: Double? get() = default_advance
    val isOpen: Boolean get() = is_open ?: true
    val numberOfCourts: Int get() = number_of_courts ?: 1
    val maxCapacity: Int get() = max_capacity ?: 50
}

@Serializable
data class Court(
    val id: String,
    @SerialName("location_id") val locationId: String,
    @SerialName("court_number") val courtNumber: Int,
    val name: String? = null,
    val description: String? = null,
    @SerialName("image_urls") val image_urls: List<String>? = null,
    val open_hour: Int? = null,
    val close_hour: Int? = null,
    val morning_start: Int? = null,
    val morning_end: Int? = null,
    val night_start: Int? = null,
    val night_end: Int? = null,
    val max_capacity: Int? = null
) {
    val imageUrls: List<String> get() = image_urls ?: emptyList()
    val maxCapacity: Int get() = max_capacity ?: 50
}

// ─── JoinRequest ─────────────────────────────────────────────────────────────

@Serializable
data class JoinRequest(
    val id: String? = null,
    @SerialName("booking_id") val bookingId: String? = null,
    @SerialName("requester_id") val requesterId: String? = null,
    @SerialName("player_name") val playerName: String? = null,
    val phone: String? = null,
    val status: String = "pending",
    @SerialName("requester_username") val requesterUsername: String? = null,
    @SerialName("requester_phone") val requesterPhone: String? = null,
    @SerialName("requester_avatar_url") val requesterAvatarUrl: String? = null,
    @SerialName("group_size") val groupSize: Int? = null,
    @SerialName("requested_at") val requestedAt: String? = null,
    @SerialName("accepted_at") val acceptedAt: String? = null
)

// ─── Booking ─────────────────────────────────────────────────────────────────

@Serializable
data class Booking(
    val id: String = "",
    val name: String = "",
    val phone: String = "",
    val date: String = "",
    @SerialName("location_id")
    val locationId: String = "",
    @SerialName("court_id")
    val courtId: String? = null,
    @SerialName("resource_id")
    val resourceId: String? = null,
    @SerialName("platform_id")
    val platformId: String? = null,
    @SerialName("game_id")
    val gameId: String? = null,
    @SerialName("selected_game")
    val selectedGame: String? = null,
    @SerialName("slot_id")
    val slotId: String = "",
    @SerialName("slot_time")
    val slotTime: String = "",
    @SerialName("start_hour")
    val startHour: Double = 0.0,
    @SerialName("end_hour")
    val endHour: Double = 0.0,
    val duration: String = "1",
    val amount: Double = 0.0,
    @SerialName("advance_paid")
    val advancePaid: Double = 0.0,
    val status: BookingStatus = BookingStatus.PENDING,
    @SerialName("payment_method")
    val paymentMethod: String = "Cash",
    @SerialName("payment_type")
    val paymentType: String = "advance",
    val utr: String? = null,
    @SerialName("checked_in")
    val checkedIn: Boolean = false,
    @SerialName("checked_time")
    val checkedTime: String? = null,
    @SerialName("created_at")
    val createdAt: String = "",
    @SerialName("booked_by")
    val bookedBy: String = "User",
    val sport: String = SportType.CRICKET.name,
    @SerialName("user_id")
    val userId: String? = null,
    @SerialName("is_joinable")
    val isJoinable: Boolean = false,
    @SerialName("max_players")
    val maxPlayers: Int = 10,
    @SerialName("current_players")
    val currentPlayers: Int = 1,
    val auto_delete_at: String? = null,
    @SerialName("join_requests")
    val joinRequests: List<JoinRequest> = emptyList()
)

// ─── Game Zone Models ─────────────────────────────────────────────────────────

@Serializable
data class GameZonePlatform(
    val id: String = "",
    @SerialName("game_zone_id") val gameZoneId: String? = null,
    @SerialName("location_id") val locationId: String = "",
    val name: String = "",
    val icon: String? = null,
    val description: String? = null
)

@Serializable
data class GameZoneResource(
    val id: String = "",
    @SerialName("game_zone_id") val gameZoneId: String? = null,
    @SerialName("platform_id") val platformId: String? = null,
    @SerialName("location_id") val locationId: String = "",
    @SerialName("platform_type") val platform_type: String = "PlayStation",
    val name: String = "",
    val price: Double = 200.0,
    @SerialName("pricing_unit") val pricingUnit: String = "per hour",
    @SerialName("max_players") val max_players: Int = 4,
    val status: String = "ACTIVE",
    val description: String? = null
)

@Serializable
data class GameZoneGame(
    val id: String = "",
    @SerialName("location_id") val location_id: String = "",
    val title: String = "",
    @SerialName("platform_type") val platform_type: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    val description: String? = null
)

@Serializable
data class GameZoneBlockout(
    val id: String = "",
    @SerialName("resource_id") val resourceId: String = "",
    @SerialName("location_id") val locationId: String = "",
    @SerialName("start_time") val startTime: String = "",
    @SerialName("end_time") val endTime: String = "",
    val reason: String? = null
)

// ─── Pricing ─────────────────────────────────────────────────────────────────

@Serializable
data class PricingRule(
    val duration: String,
    val basePricePeak: Double,
    val basePriceOffPeak: Double,
    val active: Boolean
)

@Serializable
data class Pricing(
    val id: String? = null,
    val location_id: String,
    val court_id: String? = null,
    val duration_hours: Double,
    val price: Double,
    val advance_price: Double? = null,
    val label: String? = null,
    val category: String? = null,       // "morning" | "night"
    val rule_type: String? = null,      // "default" | "day" | "date"
    val day_of_week: Int? = null,
    val specific_date: String? = null
)

// ─── Cricket types ───────────────────────────────────────────────────────────

@Serializable
data class CricketPlayer(
    val name: String,
    val runs: Int,
    val balls: Int,
    val fours: Int,
    val sixes: Int,
    val isOut: Boolean
)

@Serializable
data class CricketBowler(
    val name: String,
    val overs: Double,
    val maidens: Int,
    val runs: Int,
    val wickets: Int
)

@Serializable
data class CricketExtras(
    val wides: Int,
    val noBalls: Int,
    val byes: Int,
    val legByes: Int
)

@Serializable
data class CricketInnings(
    val battingTeam: String,
    val runs: Int,
    val wickets: Int,
    val balls: Int,
    val overs: Int,
    val isFreeHit: Boolean,
    val isNoBallRunPending: Boolean,
    val extras: CricketExtras,
    val batsmen: List<CricketPlayer>,
    val bowlers: List<CricketBowler>,
    val strikerIdx: Int,
    val nonStrikerIdx: Int,
    val currentBowlerIdx: Int,
    val ballByBall: List<String>,
    val nextBatsmanIdx: Int
)

@Serializable
data class CricketMatch(
    val id: String,
    val locationId: String,
    val teamA: String,
    val teamB: String,
    val tossWinner: String,
    val optedTo: String,
    val overs: Int,
    val innings: List<CricketInnings>,
    val currentInningsIdx: Int,
    val status: String,
    val createdAt: String,
    val finishedAt: String? = null,
    val isExpired: Boolean? = null,
    val sport: SportType = SportType.CRICKET,
    val teamASize: Int,
    val teamBSize: Int,
    val teamAPlayers: List<String>,
    val teamBPlayers: List<String>
)

data class SportCapability(
    val scorerAvailable: Boolean,
    val supportsChallenge: Boolean,
    val supportsJoinable: Boolean
)

fun getSportCapability(sport: SportType?): SportCapability {
    if (sport == null) return SportCapability(true, true, true)
    return when (sport) {
        SportType.SWIMMING, SportType.GAME_ZONE -> SportCapability(
            scorerAvailable = false,
            supportsChallenge = false,
            supportsJoinable = false
        )
        else -> SportCapability(
            scorerAvailable = true,
            supportsChallenge = true,
            supportsJoinable = true
        )
    }
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

@Serializable
data class ReviewUser(
    val email: String
)

@Serializable
data class Review(
    val id: String,
    @SerialName("location_id")
    val location_id: String,
    @SerialName("user_id")
    val user_id: String,
    val rating: Int,
    val comment: String = "",
    val created_at: String,
    val name: String? = null,
    val user: ReviewUser? = null
) {
    val userId: String get() = user_id
}

// ─── Challenge / Match feed item ─────────────────────────────────────────────

@Serializable
data class MatchResult(
    val id: String,
    @SerialName("challenge_id") val challengeId: String,
    @SerialName("winner_id") val winnerId: String,
    @SerialName("loser_id") val loserId: String,
    @SerialName("score_summary") val scoreSummary: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class Match(
    val id: String,
    @SerialName("challenge_id") val challengeId: String? = null,
    @SerialName("booking_id") val bookingId: String? = null,
    @SerialName("location_id") val locationId: String,
    val sport: String,
    @SerialName("team_a_name") val teamAName: String = "Team A",
    @SerialName("team_b_name") val teamBName: String = "Team B",
    @SerialName("score_a") val scoreA: String = "0",
    @SerialName("score_b") val scoreB: String = "0",
    val status: String = "live",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("start_time") val startTime: String? = null,
    @SerialName("end_time") val endTime: String? = null
)

@Serializable
data class ChallengeRequest(
    val requesterId: String? = null,
    val requesterUsername: String? = null,
    val requesterPhone: String? = null,
    val requesterAvatarUrl: String? = null,
    val groupSize: Int? = null,
    val playerName: String? = null,
    val phone: String? = null
)

@Serializable
data class ChallengeItem(
    val id: String,
    val type: String,           // "challenge" | "match"
    val status: String = "active",
    val challengerId: String? = null,
    val challengerUsername: String? = null,
    val challengerPhone: String? = null,
    val challengerAvatarUrl: String? = null,
    val acceptedBy: String? = null,
    val userId: String? = null,
    val locationId: String? = null,
    val slotTime: String = "",
    val date: String = "",
    val name: String? = null,
    val currentPlayers: Int? = null,
    val maxPlayers: Int? = null,
    val requests: List<ChallengeRequest> = emptyList(),
    val box: Location? = null,
    val isExpired: Boolean = false,
    val createdAt: String? = null,
    val autoDeleteAt: String? = null,
    val startHour: Double? = null,
    val endHour: Double? = null,
    val sport: String? = null,
    val userPendingMembers: Int = 0,
    val userAcceptedMembers: Int = 0,
    @SerialName("advance_price") val advancePrice: Double? = null,
    @SerialName("challenger_payment_status") val challengerPaymentStatus: String? = null,
    @SerialName("acceptor_payment_status") val acceptorPaymentStatus: String? = null,
    @SerialName("settlement_status") val settlementStatus: String? = null,
    @SerialName("payment_type") val paymentType: String? = null
)

// ─── AppNotification ─────────────────────────────────────────────────────────

@Serializable
data class AppNotification(
    val id: String,
    val user_id: String? = null,
    val title: String = "",
    val message: String = "",
    @SerialName("is_read")
    val read: Boolean = false,
    val created_at: String? = null,
    val data: Map<String, JsonElement>? = null
) {
    val isRead: Boolean get() = read
    val createdAt: java.util.Date get() {
        return try {
            val parser = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault())
            parser.parse(created_at ?: "") ?: java.util.Date()
        } catch (_: Exception) {
            java.util.Date()
        }
    }
}

@Serializable
data class ReviewPageState(
    val rating: Int = 0,
    val comment: String = ""
)

@Serializable
data class LocationNameOnly(
    val id: String,
    val name: String
)
