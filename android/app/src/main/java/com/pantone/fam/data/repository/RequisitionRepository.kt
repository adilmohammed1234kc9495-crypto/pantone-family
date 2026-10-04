package com.pantone.fam.data.repository

import com.pantone.fam.data.api.ApiService
import com.pantone.fam.data.model.ApprovalDecisionRequest
import com.pantone.fam.data.model.Requisition

class RequisitionRepository(private val api: ApiService) {

    suspend fun getRequisitions(status: String? = null): Result<List<Requisition>> {
        return try {
            val res = api.getRequisitions(status)
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Failed to load requisitions"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun approve(approvalStageId: String, remarks: String?): Result<Unit> {
        return try {
            val res = api.approveRequest(approvalStageId, ApprovalDecisionRequest("APPROVE", remarks))
            if (res.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Approval failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun reject(approvalStageId: String, remarks: String?): Result<Unit> {
        return try {
            val res = api.rejectRequest(approvalStageId, ApprovalDecisionRequest("REJECT", remarks))
            if (res.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Rejection failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
