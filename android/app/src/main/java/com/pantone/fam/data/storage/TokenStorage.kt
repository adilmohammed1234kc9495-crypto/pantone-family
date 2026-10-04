package com.pantone.fam.data.storage

import com.pantone.fam.data.model.UserProfile

interface TokenStorage {
    fun saveTokens(accessToken: String, refreshToken: String)
    fun getAccessToken(): String?
    fun getRefreshToken(): String?
    fun saveUser(user: UserProfile)
    fun getUser(): UserProfile?
    fun setScopedCompanyId(companyId: String?)
    fun getScopedCompanyId(): String?
    fun isLoggedIn(): Boolean
    fun getServerBaseUrl(): String?
    fun setServerBaseUrl(url: String)
    fun clear()
}