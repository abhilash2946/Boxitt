package com.boxitt.app.models

import com.google.gson.annotations.SerializedName

data class User(
    @SerializedName("id") val id: String? = null,
    @SerializedName("email") val email: String,
    @SerializedName("display_name") val displayName: String? = null,
    @SerializedName("phone_number") val phoneNumber: String? = null,
    @SerializedName("avatar_url") val avatarUrl: String? = null,
    @SerializedName("role") val role: String? = "user",
    @SerializedName("role_status") val roleStatus: String? = "pending",
    @SerializedName("location") val location: String? = null,
    @SerializedName("address") val address: String? = null,
    @SerializedName("joined_date") val joinedDate: String? = null,
    @SerializedName("latitude") val latitude: Double? = null,
    @SerializedName("longitude") val longitude: Double? = null,
    @SerializedName("isLoggedIn") val isLoggedIn: Boolean = false,
    @SerializedName("selectedLocationId") val selectedLocationId: String? = null,
    @SerializedName("dob") val dob: String? = null,
    @SerializedName("gender") val gender: String? = null
)

data class UserProfile(
    @SerializedName("id") val id: String? = null,
    @SerializedName("email") val email: String,
    @SerializedName("phone_number") val phoneNumber: String? = null,
    @SerializedName("display_name") val displayName: String? = null,
    @SerializedName("username") val username: String? = null,
    @SerializedName("dob") val dob: String? = null,
    @SerializedName("gender") val gender: String? = null,
    @SerializedName("address") val address: String? = null,
    @SerializedName("location") val location: String? = null,
    @SerializedName("avatar_url") val avatarUrl: String? = null,
    @SerializedName("role") val role: String? = null,
    @SerializedName("role_status") val roleStatus: String? = null,
    @SerializedName("joined_date") val joinedDate: String? = null,
    @SerializedName("latitude") val latitude: Double? = null,
    @SerializedName("longitude") val longitude: Double? = null
)

fun UserProfile.toDomainProfile(): com.boxitt.app.UserProfile {
    return com.boxitt.app.UserProfile(
        id = this.id,
        email = this.email,
        display_name = this.displayName,
        phone_number = this.phoneNumber,
        avatar_url = this.avatarUrl,
        role = this.role,
        role_status = this.roleStatus,
        username = this.username,
        dob = this.dob,
        gender = this.gender,
        address = this.address,
        location = this.location,
        joined_date = this.joinedDate,
        latitude = this.latitude,
        longitude = this.longitude
    )
}

data class AuthResponse(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("refresh_token") val refreshToken: String,
    @SerializedName("user") val user: AuthUser
)

data class AuthUser(
    @SerializedName("id") val id: String,
    @SerializedName("email") val email: String
)
