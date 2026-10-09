package com.boxitt.app.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Group
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.Booking
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.theme.vw
import com.boxitt.app.theme.clamp

@Composable
fun JoinGameCard(
    booking: Booking,
    onJoin: (Booking) -> Unit,
    isHost: Boolean = false
) {
    val theme = LocalAppTheme.current
    val isFull = booking.currentPlayers >= booking.maxPlayers
    val canJoin = !isFull && !isHost
    val remaining = booking.maxPlayers - booking.currentPlayers
    val share = Math.ceil(booking.amount.toDouble() / (booking.currentPlayers + 1)).toInt()

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(theme.radius.large))
            .background(theme.colors.card)
            .border(
                2.dp,
                if (isFull || isHost) Color.Transparent else theme.colors.accent.copy(alpha = 0.2f),
                RoundedCornerShape(theme.radius.large)
            )
            .clickable(enabled = canJoin) { onJoin(booking) }
            .then(if (isFull) Modifier.alpha(0.4f) else if (isHost) Modifier.alpha(0.8f) else Modifier)
            .padding(20.dp)
    ) {
        // Glow Effect (Simplified)
        if (canJoin) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 10.dp, y = (-10).dp)
                    .size(80.dp)
                    .background(theme.colors.accent.copy(alpha = 0.1f), CircleShape)
            )
        }
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(if (isHost) theme.colors.textDisabled else theme.colors.accent)
                        )
                        Text(
                            text = if (isHost) "YOUR MATCH" else "OPEN MATCH",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            color = if (isHost) theme.colors.textDisabled else theme.colors.accent,
                            letterSpacing = 2.sp
                        )
                    }
                    Text(
                        text = booking.slotTime,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary,
                        modifier = Modifier.padding(top = 6.dp),
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                    )
                }

                if (canJoin) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(theme.colors.accent),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(imageVector = Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                }

                if (isHost) {
                    Text(
                        text = "HOST",
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textDisabled,
                        modifier = Modifier
                            .border(1.dp, theme.colors.border.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        letterSpacing = 1.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.05f))
                        .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (booking.name.getOrNull(0) ?: '?').toString().uppercase(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.accent
                    )
                }
                Text(
                    text = booking.name.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textSecondary,
                    letterSpacing = 1.sp,
                    modifier = Modifier.weight(1f)
                )
            }

            Divider(color = theme.colors.border.copy(alpha = 0.4f), modifier = Modifier.padding(vertical = 16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                Column {
                    Text(
                        text = "PRICE PER PLAYER",
                        fontSize = 7.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textDisabled,
                        letterSpacing = 1.sp
                    )
                    Row(
                        verticalAlignment = Alignment.Bottom,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "₹$share",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black,
                            color = if (isFull) theme.colors.textDisabled else theme.colors.textPrimary,
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                        )
                        Text(
                            text = "/ PLAYER",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.textDisabled,
                            letterSpacing = 0.5.sp
                        )
                    }
                }

                Row(
                    modifier = Modifier
                        .background(
                            if (isFull) Color.Transparent else theme.colors.success.copy(alpha = 0.15f),
                            RoundedCornerShape(12.dp)
                        )
                        .border(
                            1.dp,
                            if (isFull) Color.Transparent else theme.colors.success.copy(alpha = 0.3f),
                            RoundedCornerShape(12.dp)
                        )
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Group,
                        contentDescription = null,
                        tint = if (isFull) theme.colors.textDisabled else theme.colors.success,
                        modifier = Modifier.size(clamp(8.dp, 3.vw, 16.dp))
                    )
                    Text(
                        text = "$remaining SPOTS LEFT",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isFull) theme.colors.textDisabled else theme.colors.success,
                        letterSpacing = 0.5.sp
                    )
                }
            }
        }
    }
}
