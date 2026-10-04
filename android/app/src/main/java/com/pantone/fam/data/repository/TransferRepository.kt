package com.pantone.fam.data.repository

import com.pantone.fam.data.api.ApiService
import com.pantone.fam.data.model.AssetTransfer

class TransferRepository(private val api: ApiService) {

    suspend fun getTransfers(status: String? = null): Result<List<AssetTransfer>> {
        return try {
            val res = api.getTransfers(status)
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Failed to load transfers"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun confirmReceipt(transferId: String): Result<Unit> {
        return try {
            val res = api.confirmTransferReceipt(transferId)
            if (res.isSuccessful) {
                Result.success(Unit)
            } else {
                val errorMsg = when (res.code()) {
                    403 -> "Anti-Self-Clearance: Only the destination company administrator may confirm transfer receipt."
                    else -> res.body()?.message ?: "Transfer confirmation failed"
                }
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
