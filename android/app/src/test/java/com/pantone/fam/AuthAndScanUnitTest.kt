package com.pantone.fam

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.pantone.fam.data.api.ApiService
import com.pantone.fam.data.api.AuthInterceptor
import com.pantone.fam.data.model.*
import com.pantone.fam.data.repository.AuthRepository
import com.pantone.fam.data.repository.ScanRepository
import com.pantone.fam.data.storage.TokenStorage
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class FakeTokenStorage : TokenStorage {
    private var token: String? = null
    private var refresh: String? = null
    private var companyScope: String? = null
    private var user: UserProfile? = null

    override fun saveTokens(accessToken: String, refreshToken: String) {
        this.token = accessToken
        this.refresh = refreshToken
    }

    override fun getAccessToken(): String? = token

    override fun getRefreshToken(): String? = refresh

    override fun saveUser(user: UserProfile) {
        this.user = user
    }

    override fun getUser(): UserProfile? = user

    override fun setScopedCompanyId(companyId: String?) {
        this.companyScope = companyId
    }

    override fun getScopedCompanyId(): String? = companyScope

    override fun isLoggedIn(): Boolean = !token.isNullOrBlank()

    private var serverUrl: String? = null
    override fun getServerBaseUrl(): String? = serverUrl
    override fun setServerBaseUrl(url: String) {
        serverUrl = url
    }

    override fun clear() {
        token = null
        refresh = null
        companyScope = null
        user = null
        serverUrl = null
    }
}

class AuthAndScanUnitTest {

    private lateinit var mockWebServer: MockWebServer
    private lateinit var fakeStorage: FakeTokenStorage
    private lateinit var apiService: ApiService
    private val gson = Gson()

    @Before
    fun setup() {
        mockWebServer = MockWebServer()
        mockWebServer.start()

        fakeStorage = FakeTokenStorage()

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(fakeStorage))
            .build()

        apiService = Retrofit.Builder()
            .baseUrl(mockWebServer.url("/"))
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(ApiService::class.java)
    }

    @After
    fun teardown() {
        mockWebServer.shutdown()
    }

    @Test
    fun testAuthInterceptorInjectsBearerTokenAndTenantHeader() {
        fakeStorage.saveTokens("mock_jwt_access_token_12345", "mock_refresh_123")
        fakeStorage.setScopedCompanyId("comp-apparels-uuid")

        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody("""{"success":true,"data":[]}"""))

        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(fakeStorage))
            .build()

        val request = Request.Builder()
            .url(mockWebServer.url("/test"))
            .build()

        val response = client.newCall(request).execute()
        assertTrue(response.isSuccessful)

        val recordedRequest = mockWebServer.takeRequest()
        assertEquals("Bearer mock_jwt_access_token_12345", recordedRequest.getHeader("Authorization"))
        assertEquals("comp-apparels-uuid", recordedRequest.getHeader("X-Company-Id"))
        assertEquals("application/json", recordedRequest.getHeader("Accept"))
    }

    @Test
    fun testTokenStorageSessionLifecycle() {
        assertFalse(fakeStorage.isLoggedIn())

        fakeStorage.saveTokens("access_token_abc", "refresh_token_xyz")
        assertTrue(fakeStorage.isLoggedIn())
        assertEquals("access_token_abc", fakeStorage.getAccessToken())
        assertEquals("refresh_token_xyz", fakeStorage.getRefreshToken())

        val mockUser = UserProfile(
            id = "usr-001",
            username = "admin",
            roleCode = "COMMON_ADMIN",
            roleName = "Common Administrator",
            isCommonAdmin = true,
            companyId = null,
            companyName = null,
            email = "admin@pantone.com"
        )
        fakeStorage.saveUser(mockUser)
        assertEquals("COMMON_ADMIN", fakeStorage.getUser()?.roleCode)

        fakeStorage.clear()
        assertFalse(fakeStorage.isLoggedIn())
        assertNull(fakeStorage.getAccessToken())
        assertNull(fakeStorage.getUser())
    }

    @Test
    fun testScanRepositoryResolvesQrTokenSuccessfully() = runBlocking {
        val mockAssetJson = """
        {
            "success": true,
            "data": {
                "asset": {
                    "id": "asset-uuid-101",
                    "assetTag": "AST-DEL-0001",
                    "name": "Industrial Stitching Machine",
                    "status": "IN_SERVICE",
                    "purchaseCost": 45000.0,
                    "currentBookValue": 38000.0
                },
                "allowedActions": ["ASSIGN"],
                "scanType": "QR"
            }
        }
        """.trimIndent()

        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody(mockAssetJson))

        val scanRepo = ScanRepository(apiService)
        val result = scanRepo.resolveScanToken("asset:asset-uuid-101")

        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertEquals("AST-DEL-0001", data!!.asset.assetTag)
        assertEquals("IN_SERVICE", data.asset.status)
        assertEquals("QR", data.scanType)

        val request = mockWebServer.takeRequest()
        assertEquals("/scan/resolve", request.path)
        assertTrue(request.body.readUtf8().contains("asset:asset-uuid-101"))
    }

    @Test
    fun testScanRepositoryHandlesCrossCompanyForbidden() = runBlocking {
        mockWebServer.enqueue(MockResponse().setResponseCode(403).setBody("""{"success":false,"message":"Forbidden"}"""))

        val scanRepo = ScanRepository(apiService)
        val result = scanRepo.resolveScanToken("AST-GAR-0099")

        assertTrue(result.isFailure)
        val errorMsg = result.exceptionOrNull()?.message
        assertNotNull(errorMsg)
        assertTrue(errorMsg!!.contains("Cross-Company Security Alert"))
    }

    @Test
    fun testScanRepositoryHandlesAssetNotFound() = runBlocking {
        mockWebServer.enqueue(MockResponse().setResponseCode(404).setBody("""{"success":false,"message":"Not Found"}"""))

        val scanRepo = ScanRepository(apiService)
        val result = scanRepo.resolveScanToken("AST-INVALID-999")

        assertTrue(result.isFailure)
        val errorMsg = result.exceptionOrNull()?.message
        assertNotNull(errorMsg)
        assertTrue(errorMsg!!.contains("Unknown Asset"))
    }

    @Test
    fun testAuthRepositoryLoginAndTokenStorage() = runBlocking {
        val loginSuccessResponse = """
        {
            "success": true,
            "data": {
                "accessToken": "jwt.access.token",
                "refreshToken": "jwt.refresh.token",
                "user": {
                    "id": "u-123",
                    "username": "asset.mgr",
                    "roleCode": "ASSET_MANAGER",
                    "roleName": "Asset Manager",
                    "isCommonAdmin": false,
                    "companyId": "comp-1",
                    "companyName": "Pantone Apparels",
                    "email": "mgr@pantone.com"
                }
            }
        }
        """.trimIndent()

        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody(loginSuccessResponse))

        val authRepo = AuthRepository(apiService, fakeStorage)
        val result = authRepo.login("asset.mgr", "ValidPassword123!")

        assertTrue(result.isSuccess)
        val user = result.getOrNull()
        assertNotNull(user)
        assertEquals("ASSET_MANAGER", user!!.roleCode)
        assertEquals("jwt.access.token", fakeStorage.getAccessToken())
        assertEquals("jwt.refresh.token", fakeStorage.getRefreshToken())
    }

    @Test
    fun testAuthRepositoryLoginFailureHandlesUnauthorized() = runBlocking {
        mockWebServer.enqueue(MockResponse().setResponseCode(401).setBody("""{"success":false,"message":"Invalid credentials"}"""))

        val authRepo = AuthRepository(apiService, fakeStorage)
        val result = authRepo.login("wrong.user", "BadPassword")

        assertTrue(result.isFailure)
        assertEquals("Invalid credentials provided", result.exceptionOrNull()?.message)
        assertFalse(fakeStorage.isLoggedIn())
    }

    @Test
    fun testRequisitionModelJsonParsing() {
        val requisitionJson = """
        {
            "id": "req-999",
            "requestNumber": "REQ-2026-0042",
            "status": "PENDING_APPROVAL",
            "priority": "HIGH",
            "justification": "Urgent machinery maintenance overhaul",
            "createdAt": "2026-10-01T08:00:00Z",
            "approvals": [
                {
                    "id": "appr-01",
                    "requestId": "req-999",
                    "stepNumber": 1,
                    "stepName": "Department Head Approval",
                    "requiredRole": "DEPARTMENT_HEAD",
                    "status": "PENDING"
                }
            ]
        }
        """.trimIndent()

        val req = gson.fromJson(requisitionJson, Requisition::class.java)
        assertEquals("req-999", req.id)
        assertEquals("REQ-2026-0042", req.requestNumber)
        assertEquals("PENDING_APPROVAL", req.status)
        assertEquals("HIGH", req.priority)
        assertEquals(1, req.approvals?.size)
        assertEquals("DEPARTMENT_HEAD", req.approvals?.first()?.requiredRole)
    }
}