package com.smspaisa.app.data.api

import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import com.smspaisa.app.model.*
import retrofit2.Response
import retrofit2.http.*

// --- Request bodies ---

@Keep
data class RegisterRequest(
    @SerializedName("phone") val phone: String,
    @SerializedName("email") val email: String?,
    @SerializedName("password") val password: String,
    @SerializedName("deviceId") val deviceId: String
)

@Keep
data class LoginRequest(
    @SerializedName("phone") val phone: String,
    @SerializedName("password") val password: String
)

@Keep
data class UpdateProfileRequest(
    @SerializedName("name") val name: String?,
    @SerializedName("email") val email: String?
)

@Keep
data class ReportStatusRequest(
    @SerializedName("taskId") val taskId: String,
    @SerializedName("status") val status: String,
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("errorMessage") val errorMessage: String? = null
)

@Keep
data class WithdrawalRequest(
    @SerializedName("amount") val amount: Double,
    @SerializedName("paymentMethod") val paymentMethod: String,
    @SerializedName("paymentDetails") val paymentDetails: Map<String, String>
)

@Keep
data class AddUpiRequest(
    @SerializedName("upiId") val upiId: String,
    @SerializedName("name") val name: String
)

@Keep
data class AddBankRequest(
    @SerializedName("accountNumber") val accountNumber: String,
    @SerializedName("ifsc") val ifsc: String,
    @SerializedName("accountHolderName") val accountHolderName: String,
    @SerializedName("bankName") val bankName: String
)

@Keep
data class RegisterDeviceRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceName") val deviceName: String,
    @SerializedName("simInfo") val simInfo: Map<String, Any?>?
)

@Keep
data class UpdateDeviceSettingsRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("dailyLimit") val dailyLimit: Int?,
    @SerializedName("activeHoursStart") val activeHoursStart: String?,
    @SerializedName("activeHoursEnd") val activeHoursEnd: String?
)

@Keep
data class HeartbeatRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("batteryLevel") val batteryLevel: Int,
    @SerializedName("isCharging") val isCharging: Boolean,
    @SerializedName("networkType") val networkType: String
)

@Keep
data class ApplyReferralRequest(
    @SerializedName("referralCode") val referralCode: String
)

@Keep
data class ForgotPasswordRequest(
    @SerializedName("phone") val phone: String,
    @SerializedName("deviceId") val deviceId: String
)

@Keep
data class ResetPasswordRequest(
    @SerializedName("resetToken") val resetToken: String,
    @SerializedName("newPassword") val newPassword: String
)

@Keep
data class ChangePasswordRequest(
    @SerializedName("currentPassword") val currentPassword: String,
    @SerializedName("newPassword") val newPassword: String
)

@Keep
data class AppVersionResponse(
    @SerializedName("latestVersion") val latestVersion: String,
    @SerializedName("minVersion") val minVersion: String,
    @SerializedName("apkUrl") val apkUrl: String,
    @SerializedName("releaseNotes") val releaseNotes: String = "",
    @SerializedName("forceUpdate") val forceUpdate: Boolean = false,
)

// --- Batch Tasks ---

@Keep
data class BatchTask(
    @SerializedName("id") val id: String,
    @SerializedName("recipient") val recipient: String,
    @SerializedName("message") val message: String,
    @SerializedName("priority") val priority: Int = 0
)

@Keep
data class BatchTasksResponse(
    @SerializedName("tasks") val tasks: List<BatchTask>,
    @SerializedName("roundLimit") val roundLimit: Int
)

// --- Response bodies ---

@Keep
data class AuthResponse(
    @SerializedName("token") val token: String,
    @SerializedName("user") val user: User
)

@Keep
data class ForgotPasswordResponse(
    @SerializedName("resetToken") val resetToken: String,
    @SerializedName("expiresIn") val expiresIn: Int
)

@Keep
data class WithdrawalResponse(
    @SerializedName("id") val id: String,
    @SerializedName("status") val status: String,
    @SerializedName("amount") val amount: String? = null,
    @SerializedName("paymentMethod") val paymentMethod: String? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("message") val message: String? = null,
)

@Keep
data class PaymentAccount(
    @SerializedName("id") val id: String,
    @SerializedName("type") val type: String,
    @SerializedName("details") val details: String,
    @SerializedName("upiId") val upiId: String? = null,
    @SerializedName("accountNumber") val accountNumber: String? = null,
    @SerializedName("ifsc") val ifsc: String? = null,
    @SerializedName("bankName") val bankName: String? = null,
    @SerializedName("accountHolderName") val accountHolderName: String? = null,
)

@Keep
data class ReferralStats(
    @SerializedName("referralCode") val referralCode: String,
    @SerializedName("totalReferrals") val totalReferrals: Int,
    @SerializedName("activeReferrals") val activeReferrals: Int,
    @SerializedName("totalEarnings") val totalEarnings: Double,
    @SerializedName("referrals") val referrals: List<ReferralEntry>
)

@Keep
data class ReferralEntry(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("joinedAt") val joinedAt: String,
    @SerializedName("status") val status: String,
    @SerializedName("earnings") val earnings: Double
)

@Keep
data class SupportLinks(
    @SerializedName("telegram") val telegram: String,
    @SerializedName("whatsapp") val whatsapp: String
)

interface ApiService {

    // --- Auth ---

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiResponse<AuthResponse>>

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<AuthResponse>>

    @GET("api/auth/me")
    suspend fun getProfile(): Response<ApiResponse<User>>

    @PUT("api/auth/profile")
    suspend fun updateProfile(@Body request: UpdateProfileRequest): Response<ApiResponse<User>>

    @POST("api/auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): Response<ApiResponse<ForgotPasswordResponse>>

    @POST("api/auth/reset-password")
    suspend fun resetPassword(@Body request: ResetPasswordRequest): Response<ApiResponse<Unit>>

    @PUT("api/auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<ApiResponse<Unit>>

    // --- SMS Tasks ---

    @GET("api/sms/next-task")
    suspend fun getNextTask(): Response<ApiResponse<SmsTask>>

    @GET("api/sms/batch-tasks")
    suspend fun getBatchTasks(@Query("deviceId") deviceId: String): Response<ApiResponse<BatchTasksResponse>>

    @POST("api/sms/report-status")
    suspend fun reportStatus(@Body request: ReportStatusRequest): Response<ApiResponse<Unit>>

    @GET("api/sms/today-stats")
    suspend fun getTodayStats(): Response<ApiResponse<TodayStats>>

    @GET("api/sms/log")
    suspend fun getSmsLog(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<SmsLog>>>

    // --- Wallet ---

    @GET("api/wallet/balance")
    suspend fun getBalance(): Response<ApiResponse<Wallet>>

    @GET("api/wallet/transactions")
    suspend fun getTransactions(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<Transaction>>>

    // --- Withdraw ---

    @POST("api/withdraw/request")
    suspend fun requestWithdrawal(@Body request: WithdrawalRequest): Response<ApiResponse<WithdrawalResponse>>

    @GET("api/wallet/transactions")
    suspend fun getWithdrawHistory(
        @Query("type") type: String = "WITHDRAWAL"
    ): Response<ApiResponse<List<Transaction>>>

    @POST("api/withdraw/add-upi")
    suspend fun addUpi(@Body request: AddUpiRequest): Response<ApiResponse<PaymentAccount>>

    @POST("api/withdraw/add-bank")
    suspend fun addBank(@Body request: AddBankRequest): Response<ApiResponse<PaymentAccount>>

    @GET("api/wallet/payment-accounts")
    suspend fun getPaymentAccounts(): Response<ApiResponse<List<PaymentAccount>>>

    // --- Device ---

    @POST("api/device/register")
    suspend fun registerDevice(@Body request: RegisterDeviceRequest): Response<ApiResponse<Device>>

    @PUT("api/device/settings")
    suspend fun updateDeviceSettings(@Body request: UpdateDeviceSettingsRequest): Response<ApiResponse<Device>>

    @POST("api/device/heartbeat")
    suspend fun heartbeat(@Body request: HeartbeatRequest): Response<ApiResponse<Unit>>

    @GET("api/device/list")
    suspend fun getDevices(): Response<ApiResponse<List<Device>>>

    // --- Stats ---

    @GET("api/stats/daily")
    suspend fun getDailyStats(@Query("date") date: String? = null): Response<ApiResponse<DailyStats>>

    @GET("api/stats/weekly")
    suspend fun getWeeklyStats(@Query("week") week: String? = null): Response<ApiResponse<WeeklyStats>>

    @GET("api/stats/monthly")
    suspend fun getMonthlyStats(@Query("month") month: String? = null): Response<ApiResponse<MonthlyStats>>

    @GET("api/stats/overview")
    suspend fun getOverview(): Response<ApiResponse<OverviewStats>>

    // --- Referral ---

    @GET("api/referral/code")
    suspend fun getReferralCode(): Response<ApiResponse<Map<String, String>>>

    @POST("api/referral/apply")
    suspend fun applyReferral(@Body request: ApplyReferralRequest): Response<ApiResponse<Unit>>

    @GET("api/referral/stats")
    suspend fun getReferralStats(): Response<ApiResponse<ReferralStats>>

    // --- App Update ---

    @GET("api/app/version")
    suspend fun getAppVersion(): Response<ApiResponse<AppVersionResponse>>

    // --- Support ---

    @GET("api/app/support-links")
    suspend fun getSupportLinks(): Response<ApiResponse<SupportLinks>>
}
