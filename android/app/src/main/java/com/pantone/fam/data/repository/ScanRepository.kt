package com.pantone.fam.data.repository

import com.pantone.fam.data.api.ApiService
import com.pantone.fam.data.model.ResolveScanRequest
import com.pantone.fam.data.model.ScanResolutionData

class ScanRepository(private val api: ApiService) {

    suspend fun resolveScanToken(rawCode: String): Result<ScanResolutionData> {
        return try {
            val response = api.resolveScan(ResolveScanRequest(rawCode.trim()))
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                val errorMsg = when (response.code()) {
                    403 -> "Cross-Company Security Alert: You do not have permission to view or manage this asset."
                    404 -> "Unknown Asset: The scanned barcode or QR code is not registered."
                    401 -> "Session Expired: Please re-authenticate."
                    else -> response.body()?.message ?: "Failed to resolve scanned code"
                }
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
