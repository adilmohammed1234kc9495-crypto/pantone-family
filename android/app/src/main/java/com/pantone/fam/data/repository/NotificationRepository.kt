package com.pantone.fam.data.repository

import com.pantone.fam.data.api.ApiService
import com.pantone.fam.data.model.NotificationItem

class NotificationRepository(private val api: ApiService) {

    suspend fun getNotifications(): Result<List<NotificationItem>> {
        return try {
            val res = api.getNotifications()
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.message ?: "Failed to load notifications"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getUnreadCount(): Result<Int> {
        return try {
            val res = api.getUnreadCount()
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!.unreadCount)
            } else {
                Result.success(0)
            }
        } catch (e: Exception) {
            Result.success(0)
        }
    }

    suspend fun markAsRead(id: String): Result<Unit> {
        return try {
            val res = api.markNotificationRead(id)
            if (res.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to mark as read"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun markAllAsRead(): Result<Unit> {
        return try {
            val res = api.markAllNotificationsRead()
            if (res.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to mark all as read"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
