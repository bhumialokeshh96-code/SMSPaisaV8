package com.smspaisa.app.data.repository

import com.smspaisa.app.data.api.AddBankRequest
import com.smspaisa.app.data.api.AddUpiRequest
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.api.PaymentAccount
import com.smspaisa.app.data.api.WithdrawalRequest
import com.smspaisa.app.data.api.WithdrawalResponse
import com.smspaisa.app.model.Transaction
import com.smspaisa.app.model.Wallet
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WalletRepository @Inject constructor(
    private val apiService: ApiService
) {
    suspend fun getBalance(): Result<Wallet> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getBalance()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.error?.message ?: "Failed to get balance"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTransactions(page: Int = 1, limit: Int = 20): Result<List<Transaction>> =
        withContext(Dispatchers.IO) {
            try {
                val response = apiService.getTransactions(page, limit)
                if (response.isSuccessful && response.body()?.success == true) {
                    Result.success(response.body()!!.data!!)
                } else {
                    Result.failure(Exception("Failed to get transactions"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun requestWithdrawal(
        amount: Double,
        paymentMethod: String,
        paymentDetails: Map<String, String>
    ): Result<WithdrawalResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.requestWithdrawal(WithdrawalRequest(amount, paymentMethod, paymentDetails))
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.error?.message ?: "Withdrawal failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getWithdrawHistory(): Result<List<Transaction>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getWithdrawHistory()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception("Failed to get withdraw history"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun addUpi(upiId: String, name: String): Result<PaymentAccount> =
        withContext(Dispatchers.IO) {
            try {
                val response = apiService.addUpi(AddUpiRequest(upiId, name))
                if (response.isSuccessful && response.body()?.success == true) {
                    Result.success(response.body()!!.data!!)
                } else {
                    Result.failure(Exception(response.body()?.error?.message ?: "Failed to add UPI"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun addBank(
        accountNumber: String,
        ifsc: String,
        accountHolderName: String,
        bankName: String
    ): Result<PaymentAccount> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.addBank(AddBankRequest(accountNumber, ifsc, accountHolderName, bankName))
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.error?.message ?: "Failed to add bank account"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPaymentAccounts(): Result<List<PaymentAccount>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getPaymentAccounts()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception("Failed to get payment accounts"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
