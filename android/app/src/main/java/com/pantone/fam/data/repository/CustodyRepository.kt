package com.pantone.fam.data.repository

import com.pantone.fam.data.api.ApiService
import com.pantone.fam.data.model.*

class CustodyRepository(private val api: ApiService) {

    suspend fun getActiveAssignments(): Result<List<CustodyAssignment>> {
        return try {
            val res = api.getAssignments(status = "ACTIVE")
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Failed to load custody assignments"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createAssignment(assetId: String, employeeId: String, condition: String, notes: String?): Result<CustodyAssignment> {
        return try {
            val res = api.createAssignment(CreateAssignmentRequest(assetId, employeeId, condition, notes))
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Assignment rejected"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createReturn(assignmentId: String, condition: String, notes: String?): Result<ReturnRecord> {
        return try {
            val res = api.createReturn(CreateReturnRequest(assignmentId, condition, notes))
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Return submission rejected"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun inspectReturn(returnId: String, inspectionStatus: String, condition: String, notes: String?): Result<ReturnRecord> {
        return try {
            val res = api.inspectReturn(returnId, InspectReturnRequest(inspectionStatus, condition, notes))
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Inspection rejected"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
