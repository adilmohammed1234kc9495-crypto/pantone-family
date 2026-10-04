package com.pantone.fam.data.repository

import com.pantone.fam.data.api.ApiService
import com.pantone.fam.data.model.DashboardStats

class DashboardRepository(private val api: ApiService) {

    suspend fun getStats(): Result<DashboardStats> {
        return try {
            val res = api.getDashboardStats()
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Failed to load dashboard metrics"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
