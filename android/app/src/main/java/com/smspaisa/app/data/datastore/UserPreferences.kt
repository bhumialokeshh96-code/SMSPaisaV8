package com.smspaisa.app.data.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "user_prefs")

@Singleton
class UserPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val dataStore = context.dataStore

    companion object {
        val AUTH_TOKEN = stringPreferencesKey("auth_token")
        val USER_ID = stringPreferencesKey("user_id")
        val USER_NAME = stringPreferencesKey("user_name")
        val USER_PHONE = stringPreferencesKey("user_phone")
        val ONBOARDING_COMPLETED = booleanPreferencesKey("onboarding_completed")
        val SERVICE_ENABLED = booleanPreferencesKey("service_enabled")
        val DAILY_SMS_LIMIT = intPreferencesKey("daily_sms_limit")
        val STOP_BATTERY_PERCENT = intPreferencesKey("stop_battery_percent")
        val PREFERRED_SIM = intPreferencesKey("preferred_sim")
        val WIFI_ONLY = booleanPreferencesKey("wifi_only")
    }

    val authToken: Flow<String?> = dataStore.data.map { it[AUTH_TOKEN] }
    val userId: Flow<String?> = dataStore.data.map { it[USER_ID] }
    val userName: Flow<String?> = dataStore.data.map { it[USER_NAME] }
    val userPhone: Flow<String?> = dataStore.data.map { it[USER_PHONE] }
    val onboardingCompleted: Flow<Boolean> = dataStore.data.map { it[ONBOARDING_COMPLETED] ?: false }
    val serviceEnabled: Flow<Boolean> = dataStore.data.map { it[SERVICE_ENABLED] ?: false }
    val dailySmsLimit: Flow<Int> = dataStore.data.map { it[DAILY_SMS_LIMIT] ?: 200 }
    val stopBatteryPercent: Flow<Int> = dataStore.data.map { it[STOP_BATTERY_PERCENT] ?: 20 }
    val preferredSim: Flow<Int> = dataStore.data.map { it[PREFERRED_SIM] ?: 0 }
    val wifiOnly: Flow<Boolean> = dataStore.data.map { it[WIFI_ONLY] ?: false }

    suspend fun saveAuthToken(token: String) {
        dataStore.edit { it[AUTH_TOKEN] = token }
    }

    suspend fun saveUser(id: String, name: String, phone: String) {
        dataStore.edit {
            it[USER_ID] = id
            it[USER_NAME] = name
            it[USER_PHONE] = phone
        }
    }

    suspend fun setOnboardingCompleted(completed: Boolean) {
        dataStore.edit { it[ONBOARDING_COMPLETED] = completed }
    }

    suspend fun setServiceEnabled(enabled: Boolean) {
        dataStore.edit { it[SERVICE_ENABLED] = enabled }
    }

    suspend fun setDailySmsLimit(limit: Int) {
        dataStore.edit { it[DAILY_SMS_LIMIT] = limit }
    }

    suspend fun setStopBatteryPercent(percent: Int) {
        dataStore.edit { it[STOP_BATTERY_PERCENT] = percent }
    }

    suspend fun setPreferredSim(sim: Int) {
        dataStore.edit { it[PREFERRED_SIM] = sim }
    }

    suspend fun setWifiOnly(wifiOnly: Boolean) {
        dataStore.edit { it[WIFI_ONLY] = wifiOnly }
    }

    suspend fun clearToken() {
        dataStore.edit { it.remove(AUTH_TOKEN) }
    }

    suspend fun clearAll() {
        dataStore.edit { it.clear() }
    }
}
