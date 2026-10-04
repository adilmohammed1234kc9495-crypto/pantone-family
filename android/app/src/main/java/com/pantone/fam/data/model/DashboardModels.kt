package com.pantone.fam.data.model

import com.google.gson.annotations.SerializedName

data class DashboardStats(
    @SerializedName("totalAssets") val totalAssets: Int = 0,
    @SerializedName("inServiceAssets") val inServiceAssets: Int = 0,
    @SerializedName("maintenanceAssets") val maintenanceAssets: Int = 0,
    @SerializedName("pendingApprovals") val pendingApprovals: Int = 0,
    @SerializedName("totalValuation") val totalValuation: Double = 0.0,
    @SerializedName("currency") val currency: String = "INR"
)
