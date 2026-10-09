package com.boxitt.app.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.theme.vw
import com.boxitt.app.theme.clamp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.*

@Composable
fun BasePicker(
    isOpen: Boolean,
    onClose: () -> Unit,
    title: String,
    content: @Composable () -> Unit
) {
    if (!isOpen) return
    val theme = LocalAppTheme.current

    Dialog(onDismissRequest = onClose) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .fillMaxHeight(0.85f)
                .clip(RoundedCornerShape(28.dp))
                .background(theme.colors.card)
                .border(1.dp, theme.colors.border, RoundedCornerShape(28.dp))
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp)
                        .padding(bottom = 0.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = title.uppercase(),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary,
                        modifier = Modifier.padding(start = 4.dp),
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                        letterSpacing = (-0.5).sp
                    )
                    IconButton(
                        onClick = onClose,
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(theme.colors.backgroundSecondary)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = theme.colors.textDisabled,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
                
                Divider(color = theme.colors.border, modifier = Modifier.padding(top = 16.dp))

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .padding(24.dp)
                ) {
                    content()
                }
            }
        }
    }
}

@Composable
fun DurationPickerModal(
    isOpen: Boolean,
    onClose: () -> Unit,
    options: List<DurationOption>,
    selectedValue: String,
    onSelect: (String) -> Unit
) {
    val theme = LocalAppTheme.current
    BasePicker(isOpen = isOpen, onClose = onClose, title = "Select Duration") {
        LazyVerticalGrid(
            columns = GridCells.Fixed(1),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(options) { opt ->
                val selected = selectedValue == opt.value
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(if (selected) theme.colors.accent.copy(alpha = 0.15f) else theme.colors.backgroundSecondary)
                        .border(2.dp, if (selected) theme.colors.accent else theme.colors.border, RoundedCornerShape(20.dp))
                        .clickable {
                            onSelect(opt.value)
                            onClose()
                        }
                        .padding(20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Icon(Icons.Default.AccessTime, null, tint = theme.colors.textDisabled.copy(alpha = 0.3f), modifier = Modifier.size(20.dp))
                        Text(
                            text = opt.label.uppercase(),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            color = if (selected) theme.colors.accent else theme.colors.textPrimary,
                            letterSpacing = 1.sp
                        )
                    }
                    if (selected) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(theme.colors.accent)
                        )
                    }
                }
            }
        }
    }
}

data class DurationOption(
    val value: String,
    val label: String
)

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun DatePickerModal(
    isOpen: Boolean,
    onClose: () -> Unit,
    selectedDate: String,
    onSelect: (String) -> Unit,
    minDate: String? = null,
    maxDate: String? = null
) {
    val theme = LocalAppTheme.current
    var viewMode by remember { mutableStateOf("days") } // days, months, years
    
    var viewDate by remember(selectedDate) {
        val parsed = try {
            LocalDate.parse(selectedDate, DateTimeFormatter.ISO_LOCAL_DATE)
        } catch (e: Exception) {
            LocalDate.now()
        }
        mutableStateOf(parsed)
    }

    val months = listOf(
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    )

    BasePicker(isOpen = isOpen, onClose = onClose, title = "Select Date") {
        Column(modifier = Modifier.fillMaxSize()) {
            // Calendar Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { viewDate = viewDate.minusMonths(1) },
                    enabled = viewMode == "days",
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(theme.colors.backgroundSecondary)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                        .then(if (viewMode != "days") Modifier.alpha(0f) else Modifier)
                ) {
                    Icon(imageVector = Icons.Default.ChevronLeft, contentDescription = null, tint = theme.colors.textPrimary)
                }
                
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Month Selector Toggle
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.05f))
                            .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
                            .clickable { viewMode = if (viewMode == "months") "days" else "months" }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = months[viewDate.monthValue - 1].uppercase(),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textPrimary,
                                letterSpacing = 1.sp
                            )
                            Icon(
                                if (viewMode == "months") Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                null,
                                tint = theme.colors.textPrimary,
                                modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp))
                            )
                        }
                    }

                    // Year Selector Toggle
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.05f))
                            .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
                            .clickable { viewMode = if (viewMode == "years") "days" else "years" }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = viewDate.year.toString(),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textPrimary,
                                letterSpacing = 1.sp
                            )
                            Icon(
                                if (viewMode == "years") Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                null,
                                tint = theme.colors.textPrimary,
                                modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp))
                            )
                        }
                    }
                }

                IconButton(
                    onClick = { viewDate = viewDate.plusMonths(1) },
                    enabled = viewMode == "days",
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(theme.colors.backgroundSecondary)
                        .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                        .then(if (viewMode != "days") Modifier.alpha(0f) else Modifier)
                ) {
                    Icon(imageVector = Icons.Default.ChevronRight, contentDescription = null, tint = theme.colors.textPrimary)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Box(modifier = Modifier.weight(1f)) {
                AnimatedContent(
                    targetState = viewMode,
                    modifier = Modifier.fillMaxSize(),
                    transitionSpec = { fadeIn() with fadeOut() }
                ) { mode ->
                    when (mode) {
                        "days" -> DaysView(viewDate, selectedDate, minDate, maxDate, theme, onSelect, onClose)
                        "months" -> MonthsView(viewDate, theme) { m -> viewDate = viewDate.withMonth(m + 1); viewMode = "days" }
                        "years" -> YearsView(viewDate, theme) { y -> viewDate = viewDate.withYear(y); viewMode = "days" }
                    }
                }
            }
        }
    }
}

@Composable
fun DaysView(
    viewDate: LocalDate,
    selectedDate: String,
    minDate: String?,
    maxDate: String?,
    theme: com.boxitt.app.theme.AppTheme,
    onSelect: (String) -> Unit,
    onClose: () -> Unit
) {
    Column {
        Row(modifier = Modifier.fillMaxWidth()) {
            val days = listOf("S", "M", "T", "W", "T", "F", "S")
            days.forEach { d ->
                Text(
                    text = d,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.accent,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        val daysInMonth = viewDate.lengthOfMonth()
        val firstDayOfWeek = viewDate.withDayOfMonth(1).dayOfWeek.value % 7

        LazyVerticalGrid(
            columns = GridCells.Fixed(7),
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(firstDayOfWeek) {
                Box(modifier = Modifier.aspectRatio(1f))
            }
            items(daysInMonth) { dayIdx ->
                val day = dayIdx + 1
                val dateStr = String.format("%04d-%02d-%02d", viewDate.year, viewDate.monthValue, day)
                val isSelected = dateStr == selectedDate
                val disabled = (minDate != null && dateStr < minDate) || (maxDate != null && dateStr > maxDate)

                Box(
                    modifier = Modifier
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (isSelected) theme.colors.accent else if (disabled) Color.Transparent else theme.colors.backgroundSecondary)
                        .border(1.dp, if (isSelected) theme.colors.accent else theme.colors.border, RoundedCornerShape(14.dp))
                        .clickable(enabled = !disabled) {
                            onSelect(dateStr)
                            onClose()
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = day.toString(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isSelected) Color.White else if (disabled) theme.colors.textDisabled.copy(alpha = 0.3f) else theme.colors.textPrimary
                    )
                }
            }
        }
    }
}

@Composable
fun MonthsView(
    viewDate: LocalDate,
    theme: com.boxitt.app.theme.AppTheme,
    onMonthSelect: (Int) -> Unit
) {
    val months = listOf(
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    )
    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(months.size) { i ->
            val isSelected = viewDate.monthValue == i + 1
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(if (isSelected) theme.colors.accent.copy(alpha = 0.2f) else Color.Transparent)
                    .border(1.dp, if (isSelected) theme.colors.accent else theme.colors.border.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
                    .clickable { onMonthSelect(i) }
                    .padding(vertical = 16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = months[i].uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = if (isSelected) theme.colors.accent else theme.colors.textPrimary,
                    letterSpacing = 1.sp
                )
            }
        }
    }
}

@Composable
fun YearsView(
    viewDate: LocalDate,
    theme: com.boxitt.app.theme.AppTheme,
    onYearSelect: (Int) -> Unit
) {
    val currentYear = LocalDate.now().year
    val years = (currentYear downTo currentYear - 99).toList()
    val gridState = rememberLazyGridState()
    
    LaunchedEffect(viewDate.year) {
        val index = years.indexOf(viewDate.year)
        if (index != -1) {
            gridState.animateScrollToItem(index)
        }
    }
    
    LazyVerticalGrid(
        state = gridState,
        columns = GridCells.Fixed(4),
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(years) { y ->
            val isSelected = viewDate.year == y
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (isSelected) theme.colors.accent.copy(alpha = 0.2f) else Color.Transparent)
                    .border(1.dp, if (isSelected) theme.colors.accent else theme.colors.border.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
                    .clickable { onYearSelect(y) }
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = y.toString(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = if (isSelected) theme.colors.accent else theme.colors.textPrimary
                )
            }
        }
    }
}
