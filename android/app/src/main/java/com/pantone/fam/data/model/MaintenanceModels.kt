package com.pantone.fam.data.model

import com.google.gson.annotations.SerializedName

data class MaintenanceWorkOrder(
    @SerializedName("id") val id: String,
    @SerializedName("assetId") val assetId: String,
    @SerializedName("assetTag") val assetTag: String? = null,
    @SerializedName("assetName") val assetName: String? = null,
    @SerializedName("title") val title: String,
    @SerializedName("description") val description: String? = null,
    @SerializedName("status") val status: String = "OPEN",
    @SerializedName("priority") val priority: String = "MEDIUM",
    @SerializedName("cost") val cost: Double? = 0.0,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class CreateMaintenanceRequest(
    @SerializedName("assetId") val assetId: String,
    @SerializedName("title") val title: String,
    @SerializedName("description") val description: String? = null,
    @SerializedName("priority") val priority: String = "MEDIUM"
)

data class UpdateMaintenanceStatusRequest(
    @SerializedName("status") val status: String,
    @SerializedName("cost") val cost: Double? = null,
    @SerializedName("notes") val notes: String? = null
)
