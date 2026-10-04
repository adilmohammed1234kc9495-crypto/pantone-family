package com.pantone.fam.data.api

import com.pantone.fam.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // --- Authentication ---
    @POST("auth/login")
    suspend fun login(@Body req: LoginRequest): Response<ApiResponse<LoginResponseData>>

    @POST("auth/refresh")
    suspend fun refreshTokens(@Body req: RefreshTokenRequest): Response<ApiResponse<RefreshResponseData>>

    @POST("auth/logout")
    suspend fun logout(@Body req: RefreshTokenRequest): Response<ApiResponse<Unit>>

    @GET("auth/me")
    suspend fun getCurrentUser(): Response<ApiResponse<UserProfile>>

    // --- Assets ---
    @GET("assets")
    suspend fun getAssets(
        @Query("search") search: String? = null,
        @Query("status") status: String? = null,
        @Query("categoryId") categoryId: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<Asset>>>

    @GET("assets/{id}")
    suspend fun getAssetDetail(@Path("id") id: String): Response<ApiResponse<Asset>>

    // --- Optical QR & Barcode Scanning ---
    @GET("scan/assets/{token}")
    suspend fun scanAssetToken(@Path("token") token: String): Response<ApiResponse<ScanResolutionData>>

    @POST("scan/resolve")
    suspend fun resolveScan(@Body req: ResolveScanRequest): Response<ApiResponse<ScanResolutionData>>

    // --- Custody & Handover ---
    @GET("assignments")
    suspend fun getAssignments(
        @Query("status") status: String? = "ACTIVE",
        @Query("employeeId") employeeId: String? = null
    ): Response<ApiResponse<List<CustodyAssignment>>>

    @POST("assignments")
    suspend fun createAssignment(@Body req: CreateAssignmentRequest): Response<ApiResponse<CustodyAssignment>>

    @GET("returns")
    suspend fun getReturns(): Response<ApiResponse<List<ReturnRecord>>>

    @POST("returns")
    suspend fun createReturn(@Body req: CreateReturnRequest): Response<ApiResponse<ReturnRecord>>

    @POST("returns/{id}/inspect")
    suspend fun inspectReturn(
        @Path("id") returnId: String,
        @Body req: InspectReturnRequest
    ): Response<ApiResponse<ReturnRecord>>

    // --- Maintenance ---
    @GET("maintenance")
    suspend fun getMaintenanceWorkOrders(
        @Query("status") status: String? = null
    ): Response<ApiResponse<List<MaintenanceWorkOrder>>>

    @POST("maintenance")
    suspend fun createMaintenanceWorkOrder(@Body req: CreateMaintenanceRequest): Response<ApiResponse<MaintenanceWorkOrder>>

    @PATCH("maintenance/{id}/status")
    suspend fun updateMaintenanceStatus(
        @Path("id") id: String,
        @Body req: UpdateMaintenanceStatusRequest
    ): Response<ApiResponse<MaintenanceWorkOrder>>

    // --- Requests & Approvals ---
    @GET("requests")
    suspend fun getRequisitions(
        @Query("status") status: String? = null
    ): Response<ApiResponse<List<Requisition>>>

    @POST("approvals/{id}/approve")
    suspend fun approveRequest(
        @Path("id") approvalStageId: String,
        @Body req: ApprovalDecisionRequest
    ): Response<ApiResponse<Unit>>

    @POST("approvals/{id}/reject")
    suspend fun rejectRequest(
        @Path("id") approvalStageId: String,
        @Body req: ApprovalDecisionRequest
    ): Response<ApiResponse<Unit>>

    // --- Transfers ---
    @GET("transfers")
    suspend fun getTransfers(
        @Query("status") status: String? = null
    ): Response<ApiResponse<List<AssetTransfer>>>

    @POST("transfers/{id}/receive")
    suspend fun confirmTransferReceipt(
        @Path("id") transferId: String
    ): Response<ApiResponse<Unit>>

    // --- Notifications ---
    @GET("notifications")
    suspend fun getNotifications(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<NotificationItem>>>

    @GET("notifications/unread-count")
    suspend fun getUnreadCount(): Response<ApiResponse<UnreadCountData>>

    @PATCH("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: String): Response<ApiResponse<Unit>>

    @PATCH("notifications/read-all")
    suspend fun markAllNotificationsRead(): Response<ApiResponse<Unit>>

    // --- Dashboard ---
    @GET("dashboard/stats")
    suspend fun getDashboardStats(): Response<ApiResponse<DashboardStats>>
}
