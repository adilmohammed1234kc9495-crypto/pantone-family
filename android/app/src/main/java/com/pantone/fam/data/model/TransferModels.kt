package com.pantone.fam.data.model

import com.google.gson.annotations.SerializedName

data class AssetTransfer(
    @SerializedName("id") val id: String,
    @SerializedName("assetId") val assetId: String,
    @SerializedName("assetTag") val assetTag: String? = null,
    @SerializedName("assetName") val assetName: String? = null,
    @SerializedName("transferType") val transferType: String = "INTERNAL",
    @SerializedName("sourceCompanyName") val sourceCompanyName: String? = null,
    @SerializedName("destinationCompanyName") val destinationCompanyName: String? = null,
    @SerializedName("status") val status: String = "INITIATED",
    @SerializedName("initiatedAt") val initiatedAt: String? = null
)
