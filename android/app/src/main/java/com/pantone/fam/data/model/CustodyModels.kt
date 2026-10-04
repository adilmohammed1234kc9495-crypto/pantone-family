package com.pantone.fam.data.model

import com.google.gson.annotations.SerializedName

data class CustodyAssignment(
    @SerializedName("id") val id: String,
    @SerializedName("assetId") val assetId: String,
    @SerializedName("assetTag") val assetTag: String? = null,
    @SerializedName("assetName") val assetName: String? = null,
    @SerializedName("employeeId") val employeeId: String,
    @SerializedName("employeeName") val employeeName: String? = null,
    @SerializedName("assignedDate") val assignedDate: String? = null,
    @SerializedName("status") val status: String = "ACTIVE",
    @SerializedName("conditionAtAssignment") val conditionAtAssignment: String? = "GOOD",
    @SerializedName("notes") val notes: String? = null
)

data class CreateAssignmentRequest(
    @SerializedName("assetId") val assetId: String,
    @SerializedName("employeeId") val employeeId: String,
    @SerializedName("conditionAtAssignment") val conditionAtAssignment: String = "GOOD",
    @SerializedName("notes") val notes: String? = null
)

data class ReturnRecord(
    @SerializedName("id") val id: String,
    @SerializedName("assignmentId") val assignmentId: String,
    @SerializedName("assetId") val assetId: String? = null,
    @SerializedName("assetTag") val assetTag: String? = null,
    @SerializedName("returnDate") val returnDate: String? = null,
    @SerializedName("conditionAtReturn") val conditionAtReturn: String? = "GOOD",
    @SerializedName("inspectionStatus") val inspectionStatus: String = "PENDING_INSPECTION",
    @SerializedName("notes") val notes: String? = null
)

data class CreateReturnRequest(
    @SerializedName("assignmentId") val assignmentId: String,
    @SerializedName("conditionAtReturn") val conditionAtReturn: String = "GOOD",
    @SerializedName("notes") val notes: String? = null
)

data class InspectReturnRequest(
    @SerializedName("inspectionStatus") val inspectionStatus: String, // PASSED, MAINTENANCE_REQUIRED, DAMAGE_REVIEW
    @SerializedName("conditionAfterInspection") val conditionAfterInspection: String = "GOOD",
    @SerializedName("notes") val notes: String? = null
)
