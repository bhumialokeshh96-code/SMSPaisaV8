package com.smspaisa.app.data.repository

import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.AuthResponse
import com.smspaisa.app.data.api.ChangePasswordRequest
import com.smspaisa.app.data.api.ForgotPasswordRequest
import com.smspaisa.app.data.api.ForgotPasswordResponse
import com.smspaisa.app.data.api.LoginRequest
import com.smspaisa.app.data.api.RegisterRequest
import com.smspaisa.app.data.api.ResetPasswordRequest
import com.smspaisa.app.data.api.UpdateProfileRequest
import com.smspaisa.app.data.datastore.UserPreferences
import com.smspaisa.app.model.User
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val apiService: ApiService,
    private val userPreferences: UserPreferences
) {
    suspend fun register(phone: String, email: String?, password: String, deviceId: String): Result<AuthResponse> =
        withContext(Dispatchers.IO) {
            try {
                val response = apiService.register(RegisterRequest(phone, email, password, deviceId))
                if (response.isSuccessful && response.body()?.success == true) {
                    val authResponse = response.body()!!.data!!
                    userPreferences.saveAuthToken(authResponse.token)
                    userPreferences.saveUser(
                        authResponse.user.id,
                        authResponse.user.name ?: "",
                        authResponse.user.phone
                    )
                    Result.success(authResponse)
                } else {
                    Result.failure(Exception(response.body()?.error?.message ?: "Registration failed"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun login(phone: String, password: String): Result<AuthResponse> =
        withContext(Dispatchers.IO) {
            try {
                val response = apiService.login(LoginRequest(phone, password))
                if (response.isSuccessful && response.body()?.success == true) {
                    val authResponse = response.body()!!.data!!
                    userPreferences.saveAuthToken(authResponse.token)
                    userPreferences.saveUser(
                        authResponse.user.id,
                        authResponse.user.name ?: "",
                        authResponse.user.phone
                    )
                    Result.success(authResponse)
                } else {
                    Result.failure(Exception(response.body()?.error?.message ?: "Login failed"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun getProfile(): Result<User> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getProfile()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.error?.message ?: "Failed to get profile"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateProfile(name: String?, email: String?): Result<User> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.updateProfile(UpdateProfileRequest(name, email))
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.error?.message ?: "Failed to update profile"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout() {
        userPreferences.clearAll()
    }

    suspend fun forgotPassword(request: ForgotPasswordRequest): Result<ForgotPasswordResponse> =
        withContext(Dispatchers.IO) {
            try {
                val response = apiService.forgotPassword(request)
                if (response.isSuccessful && response.body()?.success == true) {
                    Result.success(response.body()!!.data!!)
                } else {
                    Result.failure(Exception(response.body()?.error?.message ?: "Failed"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun resetPassword(request: ResetPasswordRequest): Result<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response = apiService.resetPassword(request)
                if (response.isSuccessful && response.body()?.success == true) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception(response.body()?.error?.message ?: "Failed"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun changePassword(request: ChangePasswordRequest): Result<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response = apiService.changePassword(request)
                if (response.isSuccessful && response.body()?.success == true) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception(response.body()?.error?.message ?: "Failed"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
}
