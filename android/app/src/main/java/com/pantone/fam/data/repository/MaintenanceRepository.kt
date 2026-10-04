package com.pantone.fam.data.repository

import com.pantone.fam.data.api.ApiService
import com.pantone.fam.data.model.CreateMaintenanceRequest
import com.pantone.fam.data.model.MaintenanceWorkOrder
import com.pantone.fam.data.model.UpdateMaintenanceStatusRequest

class MaintenanceRepository(private val api: ApiService) {

    suspend fun getWorkOrders(status: String? = null): Result<List<MaintenanceWorkOrder>> {
        return try {
            val res = api.getMaintenanceWorkOrders(status)
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Failed to load work orders"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createWorkOrder(assetId: String, title: String, description: String?, priority: String): Result<MaintenanceWorkOrder> {
        return try {
            val res = api.createMaintenanceWorkOrder(CreateMaintenanceRequest(assetId, title, description, priority))
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Failed to create work order"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateStatus(id: String, status: String, cost: Double?, notes: String?): Result<MaintenanceWorkOrder> {
        return try {
            val res = api.updateMaintenanceStatus(id, UpdateMaintenanceStatusRequest(status, cost, notes))
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Failed to update work order"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
