package com.pantone.fam.data.api

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.pantone.fam.data.model.ApiResponse
import com.pantone.fam.data.model.RefreshResponseData
import com.pantone.fam.data.storage.TokenStorage
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

class AuthAuthenticator(
    private val storage: TokenStorage,
    private val baseUrlProvider: () -> String
) : Authenticator {

    constructor(storage: TokenStorage, fixedBaseUrl: String) : this(storage, { fixedBaseUrl })

    private val gson = Gson()

    override fun authenticate(route: Route?, response: Response): Request? {
        // Prevent infinite loops if refresh endpoint itself failed with 401
        if (response.request.url.encodedPath.endsWith("auth/refresh") ||
            response.request.url.encodedPath.endsWith("auth/login")
        ) {
            return null
        }

        val currentRefreshToken = storage.getRefreshToken() ?: return null

        synchronized(this) {
            // Check if another thread already refreshed the token
            val latestAccessToken = storage.getAccessToken()
            val requestToken = response.request.header("Authorization")?.removePrefix("Bearer ")

            if (latestAccessToken != null && latestAccessToken != requestToken) {
                // Token was already refreshed by another concurrent request; retry with latest
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $latestAccessToken")
                    .build()
            }

            // Perform synchronous refresh call
            val client = OkHttpClient.Builder().build()
            val jsonBody = """{"refreshToken":"$currentRefreshToken"}"""
            val currentBaseUrl = baseUrlProvider()
            val refreshUrl = if (currentBaseUrl.endsWith("/")) "${currentBaseUrl}auth/refresh" else "$currentBaseUrl/auth/refresh"
            val refreshRequest = Request.Builder()
                .url(refreshUrl)
                .post(jsonBody.toRequestBody("application/json".toMediaType()))
                .build()

            try {
                val refreshResponse = client.newCall(refreshRequest).execute()
                if (refreshResponse.isSuccessful && refreshResponse.body != null) {
                    val responseStr = refreshResponse.body!!.string()
                    val type = object : TypeToken<ApiResponse<RefreshResponseData>>() {}.type
                    val apiResponse: ApiResponse<RefreshResponseData> = gson.fromJson(responseStr, type)

                    if (apiResponse.success && apiResponse.data != null) {
                        val newAccess = apiResponse.data.accessToken
                        val newRefresh = apiResponse.data.refreshToken

                        storage.saveTokens(newAccess, newRefresh)

                        return response.request.newBuilder()
                            .header("Authorization", "Bearer $newAccess")
                            .build()
                    }
                }
            } catch (e: Exception) {
                // Network error during refresh
            }

            // Refresh failed or was rejected; clear storage to trigger logout
            storage.clear()
            return null
        }
    }
}
