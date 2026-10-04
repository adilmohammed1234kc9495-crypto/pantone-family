package com.pantone.fam.data.api

import com.pantone.fam.data.storage.TokenStorage
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val storage: TokenStorage) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()

        // Attach Authorization header if access token exists
        storage.getAccessToken()?.let { token ->
            builder.header("Authorization", "Bearer $token")
        }

        // Attach X-Company-Id if Common Admin has selected a specific company scope
        storage.getScopedCompanyId()?.let { companyId ->
            builder.header("X-Company-Id", companyId)
        }

        builder.header("Accept", "application/json")
        return chain.proceed(builder.build())
    }
}
