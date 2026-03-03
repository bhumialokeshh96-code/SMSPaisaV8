package com.smspaisa.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smspaisa.app.data.api.ApiService
import com.smspaisa.app.model.DailyStats
import com.smspaisa.app.model.MonthlyStats
import com.smspaisa.app.model.OverviewStats
import com.smspaisa.app.model.WeeklyStats
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.smspaisa.app.utils.toUserMessage
import javax.inject.Inject

sealed class StatsUiState {
    object Loading : StatsUiState()
    data class Success(
        val overview: OverviewStats,
        val dailyStats: DailyStats?,
        val weeklyStats: WeeklyStats?,
        val monthlyStats: MonthlyStats?,
        val selectedPeriod: StatsPeriod
    ) : StatsUiState()
    data class Error(val message: String) : StatsUiState()
}

enum class StatsPeriod { DAILY, WEEKLY, MONTHLY }

@HiltViewModel
class StatsViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow<StatsUiState>(StatsUiState.Loading)
    val uiState: StateFlow<StatsUiState> = _uiState.asStateFlow()

    private val _selectedPeriod = MutableStateFlow(StatsPeriod.WEEKLY)
    val selectedPeriod: StateFlow<StatsPeriod> = _selectedPeriod.asStateFlow()

    init {
        loadStats()
    }

    fun loadStats(period: StatsPeriod = StatsPeriod.WEEKLY) {
        viewModelScope.launch {
            _uiState.value = StatsUiState.Loading
            try {
                val overviewResponse = apiService.getOverview()
                val overview = overviewResponse.body()?.data
                    ?: OverviewStats(0, 0.0, 0.0, 0.0, 0.0, 0)

                val (daily, weekly, monthly) = when (period) {
                    StatsPeriod.DAILY -> {
                        val d = apiService.getDailyStats().body()?.data
                        val w = apiService.getWeeklyStats().body()?.data
                        Triple(d, w, null)
                    }
                    StatsPeriod.WEEKLY -> {
                        val w = apiService.getWeeklyStats().body()?.data
                        Triple(null, w, null)
                    }
                    StatsPeriod.MONTHLY -> {
                        val m = apiService.getMonthlyStats().body()?.data
                        Triple(null, null, m)
                    }
                }

                _uiState.value = StatsUiState.Success(
                    overview = overview,
                    dailyStats = daily,
                    weeklyStats = weekly,
                    monthlyStats = monthly,
                    selectedPeriod = period
                )
            } catch (e: Exception) {
                _uiState.value = StatsUiState.Error(e.toUserMessage())
            }
        }
    }

    fun selectPeriod(period: StatsPeriod) {
        _selectedPeriod.value = period
        loadStats(period)
    }
}
