package com.pantone.fam.data.model

import com.google.gson.annotations.SerializedName

data class NotificationItem(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("message") val message: String,
    @SerializedName("severity") val severity: String = "INFO", // INFO, WARNING, CRITICAL
    @SerializedName("notificationType") val notificationType: String? = null,
    @SerializedName("isRead") val isRead: Boolean = false,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class UnreadCountData(
    @SerializedName("unreadCount") val unreadCount: Int = 0
)
