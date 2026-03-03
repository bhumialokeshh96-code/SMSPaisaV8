package com.smspaisa.app.di

import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.data.datastore.UserPreferences
import com.smspaisa.app.data.local.SmsLogDao
import com.smspaisa.app.data.repository.AuthRepository
import com.smspaisa.app.data.repository.DeviceRepository
import com.smspaisa.app.data.repository.SmsRepository
import com.smspaisa.app.data.repository.WalletRepository
import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideAuthRepository(
        apiService: ApiService,
        userPreferences: UserPreferences
    ): AuthRepository {
        return AuthRepository(apiService, userPreferences)
    }

    @Provides
    @Singleton
    fun provideSmsRepository(
        apiService: ApiService,
        smsLogDao: SmsLogDao
    ): SmsRepository {
        return SmsRepository(apiService, smsLogDao)
    }

    @Provides
    @Singleton
    fun provideWalletRepository(apiService: ApiService): WalletRepository {
        return WalletRepository(apiService)
    }

    @Provides
    @Singleton
    fun provideDeviceRepository(
        apiService: ApiService,
        @ApplicationContext context: Context
    ): DeviceRepository {
        return DeviceRepository(apiService, context)
    }
}
