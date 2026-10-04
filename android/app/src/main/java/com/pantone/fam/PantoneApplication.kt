package com.pantone.fam

import android.app.Application
import com.pantone.fam.data.api.ApiClient
import com.pantone.fam.data.storage.SecureTokenStorage

class PantoneApplication : Application() {

    lateinit var tokenStorage: SecureTokenStorage
        private set

    lateinit var apiClient: ApiClient
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        tokenStorage = SecureTokenStorage(this)
        apiClient = ApiClient(tokenStorage)
    }

    companion object {
        lateinit var instance: PantoneApplication
            private set
    }
}
