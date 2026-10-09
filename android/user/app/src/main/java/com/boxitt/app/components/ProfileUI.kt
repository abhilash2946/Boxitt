package com.boxitt.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.contexts.LocalAppTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InputGroup(
    label: String,
    icon: @Composable () -> Unit,
    placeholder: String,
    value: String,
    onValueChange: (String) -> Unit
) {
    val theme = LocalAppTheme.current
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            color = theme.colors.textDisabled,
            modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder, fontSize = 14.sp) },
            trailingIcon = icon,
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = theme.colors.backgroundSecondary,
                unfocusedContainerColor = theme.colors.backgroundSecondary,
                focusedBorderColor = Color.Transparent,
                unfocusedBorderColor = Color.Transparent,
                focusedTextColor = theme.colors.textPrimary,
                unfocusedTextColor = theme.colors.textPrimary,
                focusedPlaceholderColor = theme.colors.textDisabled,
                unfocusedPlaceholderColor = theme.colors.textDisabled
            ),
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
fun ProfileSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    val theme = LocalAppTheme.current
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = title.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = theme.colors.textDisabled,
            modifier = Modifier.padding(start = 8.dp, bottom = 8.dp)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(theme.radius.large))
                .background(theme.colors.card)
                .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                content()
            }
        }
    }
}

@Composable
fun ProfileItem(
    icon: @Composable () -> Unit,
    label: String?,
    value: String,
    hasArrow: Boolean = false,
    valueColor: Color? = null,
    onClick: (() -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = onClick != null) { onClick?.invoke() }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(theme.radius.small))
                .background(theme.colors.backgroundSecondary)
                .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.small)),
            contentAlignment = Alignment.Center
        ) {
            icon()
        }
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            if (label != null) {
                Text(
                    text = label.uppercase(),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textDisabled
                )
            }
            Text(
                text = value,
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                color = valueColor ?: theme.colors.textPrimary
            )
        }
        if (hasArrow) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowRight,
                contentDescription = null,
                tint = theme.colors.textDisabled,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
fun NavItem(
    icon: @Composable () -> Unit,
    label: String,
    active: Boolean = false
) {
    val theme = LocalAppTheme.current
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.padding(8.dp)
    ) {
        Box(modifier = Modifier.size(24.dp)) {
            icon()
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label.uppercase(),
            fontSize = 8.sp,
            fontWeight = FontWeight.Black,
            color = if (active) theme.colors.accent else theme.colors.textDisabled
        )
    }
}




