package com.pantone.fam.data.api

import com.google.gson.GsonBuilder
import com.pantone.fam.BuildConfig
import com.pantone.fam.data.storage.TokenStorage
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class ApiClient(private val storage: TokenStorage) {

    fun getBaseUrl(): String {
        val custom = storage.getServerBaseUrl()
        if (!custom.isNullOrBlank()) {
            return if (custom.endsWith("/")) custom else "$custom/"
        }
        return BuildConfig.API_BASE_URL
    }

    private val okHttpClient: OkHttpClient by lazy {
        val builder = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(AuthInterceptor(storage))
            .authenticator(AuthAuthenticator(storage) { getBaseUrl() })

        if (BuildConfig.DEBUG_LOGGING) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            builder.addInterceptor(logging)
        }

        builder.build()
    }

    private val gson = GsonBuilder()
        .setLenient()
        .create()

    @Volatile
    private var _apiService: ApiService? = null

    val apiService: ApiService
        get() {
            return _apiService ?: synchronized(this) {
                _apiService ?: createApiService().also { _apiService = it }
            }
        }

    fun updateBaseUrl(newUrl: String) {
        val formatted = if (newUrl.endsWith("/")) newUrl else "$newUrl/"
        storage.setServerBaseUrl(formatted)
        synchronized(this) {
            _apiService = createApiService()
        }
    }

    private fun createApiService(): ApiService {
        return Retrofit.Builder()
            .baseUrl(getBaseUrl())
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(ApiService::class.java)
    }
}
