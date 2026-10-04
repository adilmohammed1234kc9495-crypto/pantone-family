package com.pantone.fam.data.repository

import com.pantone.fam.data.api.ApiService
import com.pantone.fam.data.model.LoginRequest
import com.pantone.fam.data.model.RefreshTokenRequest
import com.pantone.fam.data.model.UserProfile
import com.pantone.fam.data.storage.TokenStorage

class AuthRepository(
    private val api: ApiService,
    private val storage: TokenStorage
) {

    suspend fun login(username: String, password: String): Result<UserProfile> {
        return try {
            val response = api.login(LoginRequest(username, password))
            if (response.isSuccessful && response.body() != null) {
                val envelope = response.body()!!
                if (envelope.success && envelope.data != null) {
                    val data = envelope.data
                    storage.saveTokens(data.accessToken, data.refreshToken)
                    storage.saveUser(data.user)
                    Result.success(data.user)
                } else {
                    Result.failure(Exception(envelope.message ?: "Authentication failed"))
                }
            } else {
                val errorMsg = when (response.code()) {
                    401 -> "Invalid credentials provided"
                    403 -> "Account is inactive or disabled"
                    429 -> "Too many failed attempts. Please try again later."
                    else -> "Server error (${response.code()})"
                }
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            val friendlyMsg = when (e) {
                is java.net.UnknownHostException -> "Unable to reach server. Please check your internet connection or verify DNS."
                is java.net.SocketTimeoutException -> "Connection timed out. Server is not responding."
                is java.net.ConnectException -> "Could not connect to server. Please verify server is operational."
                is javax.net.ssl.SSLException -> "SSL/TLS connection error. Ensure the server has a valid HTTPS certificate."
                else -> e.message ?: "Network error occurred"
            }
            Result.failure(Exception(friendlyMsg))
        }
    }

    suspend fun logout(): Result<Unit> {
        return try {
            val refreshToken = storage.getRefreshToken()
            if (!refreshToken.isNullOrBlank()) {
                api.logout(RefreshTokenRequest(refreshToken))
            }
            storage.clear()
            Result.success(Unit)
        } catch (e: Exception) {
            storage.clear() // Clear locally even if offline
            Result.success(Unit)
        }
    }

    fun getCurrentUser(): UserProfile? = storage.getUser()

    fun isLoggedIn(): Boolean = storage.isLoggedIn()

    fun setCompanyScope(companyId: String?) {
        storage.setScopedCompanyId(companyId)
    }

    fun getCompanyScope(): String? = storage.getScopedCompanyId()
}
