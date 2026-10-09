package com.boxitt.app.pages

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.contexts.LocalAppTheme

@Composable
fun PlayerScorePage(
    onNavigateBack: () -> Unit
) {
    val theme = LocalAppTheme.current

    Scaffold(
        containerColor = theme.colors.background,
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onNavigateBack,
                    modifier = Modifier
                        .size(42.dp)
                        .background(theme.colors.card, CircleShape)
                        .border(1.dp, theme.colors.border, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = theme.colors.textPrimary
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Text(
                    text = "Player Score & Stats",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.colors.textPrimary
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Big Score Card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(24.dp))
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(110.dp)
                        .clip(CircleShape)
                        .background(theme.colors.accent.copy(alpha = 0.15f))
                        .border(4.dp, theme.colors.accent, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("842", fontSize = 28.sp, fontWeight = FontWeight.Black, color = theme.colors.textPrimary)
                        Text("POINTS", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = theme.colors.textSecondary)
                    }
                }

                Text("Level 6 Master Player", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = theme.colors.textPrimary)
                Text("Top 5% of Boxitt community players in your region.", fontSize = 12.sp, color = theme.colors.textSecondary, textAlign = TextAlign.Center)
            }

            // Stat Breakdown
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(22.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Score Breakdown", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = theme.colors.textPrimary)
                
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Skill Rating", fontSize = 13.sp, color = theme.colors.textSecondary)
                    Text("320", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = theme.colors.textPrimary)
                }
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Consistency Bonus", fontSize = 13.sp, color = theme.colors.textSecondary)
                    Text("210", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = theme.colors.textPrimary)
                }
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Fair Play Score", fontSize = 13.sp, color = theme.colors.textSecondary)
                    Text("180", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = theme.colors.textPrimary)
                }
                HorizontalDivider(color = theme.colors.border.copy(alpha = 0.5f))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Tournament Wins", fontSize = 13.sp, color = theme.colors.textSecondary)
                    Text("132", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = theme.colors.textPrimary)
                }
            }
        }
    }
}
