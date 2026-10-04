package com.pantone.fam.data.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.google.gson.Gson
import com.pantone.fam.data.model.UserProfile

class SecureTokenStorage(context: Context) : TokenStorage {

    private val prefs: SharedPreferences = try {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        EncryptedSharedPreferences.create(
            "pantone_secure_session",
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        // Fallback for JVM unit tests or devices with broken Keystore provider
        context.getSharedPreferences("pantone_session_fallback", Context.MODE_PRIVATE)
    }

    private val gson = Gson()

    override fun saveTokens(accessToken: String, refreshToken: String) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .apply()
    }

    override fun getAccessToken(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)

    override fun getRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    override fun saveUser(user: UserProfile) {
        prefs.edit()
            .putString(KEY_USER_PROFILE, gson.toJson(user))
            .apply()
    }

    override fun getUser(): UserProfile? {
        val json = prefs.getString(KEY_USER_PROFILE, null) ?: return null
        return try {
            gson.fromJson(json, UserProfile::class.java)
        } catch (e: Exception) {
            null
        }
    }

    override fun setScopedCompanyId(companyId: String?) {
        prefs.edit().putString(KEY_SCOPED_COMPANY_ID, companyId).apply()
    }

    override fun getScopedCompanyId(): String? = prefs.getString(KEY_SCOPED_COMPANY_ID, null)

    override fun isLoggedIn(): Boolean = !getAccessToken().isNullOrBlank()

    override fun getServerBaseUrl(): String? = prefs.getString(KEY_SERVER_BASE_URL, null)

    override fun setServerBaseUrl(url: String) {
        prefs.edit().putString(KEY_SERVER_BASE_URL, url).apply()
    }

    override fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_ACCESS_TOKEN = "jwt_access_token"
        private const val KEY_REFRESH_TOKEN = "jwt_refresh_token"
        private const val KEY_USER_PROFILE = "user_profile_json"
        private const val KEY_SCOPED_COMPANY_ID = "scoped_company_id"
        private const val KEY_SERVER_BASE_URL = "server_base_url"
    }
}
