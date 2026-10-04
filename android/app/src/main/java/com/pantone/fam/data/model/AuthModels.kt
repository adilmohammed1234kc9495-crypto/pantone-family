package com.pantone.fam.data.model

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String
)

data class LoginResponseData(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String,
    @SerializedName("user") val user: UserProfile
)

data class RefreshTokenRequest(
    @SerializedName("refreshToken") val refreshToken: String
)

data class RefreshResponseData(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String
)

data class UserProfile(
    @SerializedName("id") val id: String,
    @SerializedName("username") val username: String,
    @SerializedName("email") val email: String? = null,
    @SerializedName("companyId") val companyId: String? = null,
    @SerializedName("companyCode") val companyCode: String? = null,
    @SerializedName("companyName") val companyName: String? = null,
    @SerializedName("roleId") val roleId: String? = null,
    @SerializedName("roleCode") val roleCode: String? = null,
    @SerializedName("roleName") val roleName: String? = null,
    @SerializedName("isCommonAdmin") val isCommonAdmin: Boolean = false,
    @SerializedName("permissions") val permissions: List<String> = emptyList()
)
