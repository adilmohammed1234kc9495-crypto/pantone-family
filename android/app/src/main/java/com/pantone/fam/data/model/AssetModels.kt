package com.pantone.fam.data.model

import com.google.gson.annotations.SerializedName

data class Asset(
    @SerializedName("id") val id: String,
    @SerializedName("companyId") val companyId: String? = null,
    @SerializedName("assetTag") val assetTag: String,
    @SerializedName("name") val name: String,
    @SerializedName("barcode") val barcode: String? = null,
    @SerializedName("qrCode") val qrCode: String? = null,
    @SerializedName("serialNumber") val serialNumber: String? = null,
    @SerializedName("categoryId") val categoryId: String? = null,
    @SerializedName("categoryName") val categoryName: String? = null,
    @SerializedName("branchId") val branchId: String? = null,
    @SerializedName("branchName") val branchName: String? = null,
    @SerializedName("departmentId") val departmentId: String? = null,
    @SerializedName("departmentName") val departmentName: String? = null,
    @SerializedName("locationId") val locationId: String? = null,
    @SerializedName("locationName") val locationName: String? = null,
    @SerializedName("status") val status: String = "AVAILABLE",
    @SerializedName("condition") val condition: String? = "GOOD",
    @SerializedName("purchaseCost") val purchaseCost: Double? = null,
    @SerializedName("purchaseDate") val purchaseDate: String? = null,
    @SerializedName("currentBookValue") val currentBookValue: Double? = null,
    @SerializedName("accumulatedDepreciation") val accumulatedDepreciation: Double? = null,
    @SerializedName("currentCustodianId") val currentCustodianId: String? = null,
    @SerializedName("currentCustodianName") val currentCustodianName: String? = null
)

data class ScanResolutionData(
    @SerializedName("asset") val asset: Asset,
    @SerializedName("allowedActions") val allowedActions: List<String> = emptyList(),
    @SerializedName("scanType") val scanType: String = "QR"
)

data class ResolveScanRequest(
    @SerializedName("token") val token: String
)
