package com.pantone.fam.data.repository

import com.pantone.fam.data.api.ApiService
import com.pantone.fam.data.model.Asset

class AssetRepository(private val api: ApiService) {

    suspend fun getAssets(search: String? = null, status: String? = null): Result<List<Asset>> {
        return try {
            val res = api.getAssets(search = search, status = status)
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Failed to load assets"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getAssetDetail(id: String): Result<Asset> {
        return try {
            val res = api.getAssetDetail(id)
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Asset not found"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
