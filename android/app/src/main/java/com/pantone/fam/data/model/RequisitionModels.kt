package com.pantone.fam.data.model

import com.google.gson.annotations.SerializedName

data class Requisition(
    @SerializedName("id") val id: String,
    @SerializedName("requestNumber") val requestNumber: String? = null,
    @SerializedName("status") val status: String = "DRAFT",
    @SerializedName("priority") val priority: String = "MEDIUM",
    @SerializedName("justification") val justification: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("approvals") val approvals: List<ApprovalStage>? = null
)

data class ApprovalStage(
    @SerializedName("id") val id: String,
    @SerializedName("requestId") val requestId: String,
    @SerializedName("stepNumber") val stepNumber: Int = 1,
    @SerializedName("stepName") val stepName: String? = null,
    @SerializedName("requiredRole") val requiredRole: String? = null,
    @SerializedName("status") val status: String = "PENDING",
    @SerializedName("decisionRemarks") val decisionRemarks: String? = null
)

data class ApprovalDecisionRequest(
    @SerializedName("decision") val decision: String, // APPROVE, REJECT, RETURN_FOR_CORRECTION
    @SerializedName("remarks") val remarks: String? = null
)
