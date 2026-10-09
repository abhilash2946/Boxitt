package com.boxitt.app.navigation

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class NavigationViewModel @Inject constructor() : ViewModel() {
    private val _selectedSport = MutableStateFlow<String?>(null)
    val selectedSport = _selectedSport.asStateFlow()

    private val _selectedLocation = MutableStateFlow<com.boxitt.app.Location?>(null)
    val selectedLocation = _selectedLocation.asStateFlow()

    fun setSelectedSport(sport: String?) {
        _selectedSport.value = sport
        if (sport != null) {
            com.boxitt.app.services.Storage.set("boxitt_selected_sport", sport)
        }
    }

    fun setSelectedLocation(location: com.boxitt.app.Location?) {
        _selectedLocation.value = location
    }
}
