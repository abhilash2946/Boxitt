package com.boxitt.app.pages

import androidx.compose.foundation.layout.BoxWithConstraints
import com.boxitt.app.components.LoadingButton
import androidx.compose.animation.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.boxitt.app.Review
import com.boxitt.app.ReviewPageState
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.theme.vw
import com.boxitt.app.theme.clamp
import com.boxitt.app.services.LocationService
import com.boxitt.app.services.ReviewService
import com.boxitt.app.services.Storage
import com.boxitt.app.services.Supabase
import io.github.jan.supabase.gotrue.auth
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
private fun EmptyReviewsState(theme: com.boxitt.app.theme.AppTheme) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp)
            .height(200.dp)
            .clip(RoundedCornerShape(32.dp))
            .background(theme.colors.backgroundSecondary)
            .padding(64.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            "NO REVIEWS YET",
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            color = theme.colors.textDisabled,
            letterSpacing = 4.sp
        )
    }
}

@Composable
private fun ReviewItem(
    review: Review,
    userReview: Review?,
    theme: com.boxitt.app.theme.AppTheme,
    dateFormat: SimpleDateFormat,
    index: Int
) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(300L + (index * 100L))
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(animationSpec = tween(500)) + slideInHorizontally(animationSpec = tween(500)) { -40 }
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(32.dp))
                .background(theme.colors.card)
                .border(1.dp, theme.colors.border, RoundedCornerShape(32.dp))
                .padding(24.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Star display
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(theme.colors.backgroundSecondary)
                            .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        for (star in 1..5) {
                            Icon(
                                Icons.Default.Star,
                                null,
                                tint = if (star <= review.rating) Color(0xFFEAB308) else theme.colors.textDisabled.copy(alpha = 0.1f),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Person, null, tint = theme.colors.accent, modifier = Modifier.size(14.dp))
                            Text(review.name ?: "Anonymous", fontSize = 12.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = theme.colors.textPrimary, letterSpacing = 1.sp)
                        }
                        if (userReview != null && review.userId == userReview.userId) {
                            Spacer(Modifier.height(4.dp))
                            Text("YOUR REVIEW", fontSize = 9.sp, fontWeight = FontWeight.Black, color = theme.colors.accent, letterSpacing = 1.sp, modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(theme.colors.accent.copy(alpha = 0.15f)).padding(horizontal = 8.dp, vertical = 3.dp))
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))
                Text(review.comment, fontSize = 16.sp, fontWeight = FontWeight.Bold, fontStyle = FontStyle.Italic, color = theme.colors.textSecondary, lineHeight = 24.sp)
                Spacer(Modifier.height(24.dp))
                HorizontalDivider(color = theme.colors.border, thickness = 1.dp)
                Spacer(Modifier.height(16.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.CalendarToday, null, tint = theme.colors.textDisabled, modifier = Modifier.size(14.dp))
                    val dateText = try {
                        val parsed = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(review.created_at)
                        if (parsed != null) dateFormat.format(parsed) else review.created_at
                    } catch (e: Exception) { review.created_at }
                    Text(dateText.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = theme.colors.textDisabled, letterSpacing = 2.sp)
                }
            }
        }
    }
}

@Composable
fun ReviewPage(
    locationId: String?,
    userId: String? = null,
    onBack: (() -> Unit)? = null,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val scope = rememberCoroutineScope()
    val pageId = "review_$locationId"

    val savedState = remember(locationId) { Storage.getPageState<ReviewPageState>(pageId) }

    var reviews by remember { mutableStateOf<List<Review>>(emptyList()) }
    var userReview by remember { mutableStateOf<Review?>(null) }
    var rating by remember { mutableStateOf(savedState?.rating ?: 0) }
    var comment by remember { mutableStateOf(savedState?.comment ?: "") }
    var loading by remember { mutableStateOf(true) }
    var isSubmitting by remember { mutableStateOf(false) }
    var showSuccess by remember { mutableStateOf(false) }
    var arenaName by remember { mutableStateOf("") }

    val dateFormat = remember { SimpleDateFormat("MMM d, yyyy, hh:mm a", Locale.getDefault()) }

    // Save state on change
    LaunchedEffect(rating, comment) {
        if (locationId != null && !isSubmitting) {
            Storage.setPageState(pageId, ReviewPageState(rating, comment))
        }
    }

    var headerVisible by remember { mutableStateOf(false) }
    var cardVisible by remember { mutableStateOf(false) }

    LaunchedEffect(loading) {
        if (!loading) {
            headerVisible = true
            delay(200)
            cardVisible = true
        }
    }

    fun fetchAll() {
        loading = true
        scope.launch {
            try {
                if (locationId == null) return@launch

                // Fetch arena name
                val location = LocationService.getLocationById(locationId)
                if (location != null) arenaName = location.name

                // Fetch reviews with user profiles
                val result = ReviewService.getReviews(locationId)
                
                // Find logged-in user's review and initialize rating/comment
                if (userId != null) {
                    val existingReview = result.find { it.userId == userId }
                    userReview = existingReview
                    if (existingReview != null) {
                        rating = existingReview.rating
                        comment = existingReview.comment
                    }
                }

                // Sort: User's review first, then others by date
                reviews = if (userId != null) {
                    result.sortedWith(compareByDescending<Review> { it.userId == userId }
                        .thenByDescending { it.created_at })
                } else {
                    result
                }
            } catch (_: Exception) {
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(locationId) {
        fetchAll()
    }

    fun handleSubmit() {
        if (isSubmitting || locationId == null) return
        scope.launch {
            isSubmitting = true
            try {
                if (userId == null) { onAlert?.invoke("Please login first.", "error", null); return@launch }
                if (rating == 0) { onAlert?.invoke("Please select a rating.", "error", null); return@launch }

                ReviewService.saveReview(
                    locationId = locationId,
                    userId = userId,
                    rating = rating,
                    comment = comment
                )

                showSuccess = true
                Storage.clearPageState(pageId)
                fetchAll()
                delay(3000)
                showSuccess = false
            } catch (e: Exception) {
                onAlert?.invoke(e.message ?: "Error saving review", "error", null)
            } finally {
                isSubmitting = false
            }
        }
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize().background(theme.colors.background)) {
        val isExpanded = maxWidth > 840.dp
        
        // Gradient background effect
        Box(
            modifier = Modifier
                .size(400.dp)
                .offset(x = (-100).dp, y = (-100).dp)
                .background(Brush.radialGradient(listOf(theme.colors.accent.copy(alpha = 0.2f), Color.Transparent)))
        )

        if (loading) {
            Column(
                modifier = Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .border(4.dp, theme.colors.border, RoundedCornerShape(50))
                        .padding(4.dp)
                ) {
                    CircularProgressIndicator(
                        color = theme.colors.accent,
                        strokeWidth = 4.dp,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                Spacer(Modifier.height(24.dp))
                Text(
                    "LOADING REVIEWS...",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textDisabled,
                    letterSpacing = 4.sp
                )
            }
        } else {
            Column(modifier = Modifier.fillMaxSize().padding(if (isExpanded) 40.dp else 24.dp)) {
                // Header (with back button)
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 32.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = buildAnnotatedString {
                                if (arenaName.isNotEmpty()) {
                                    append(arenaName.uppercase())
                                    append(" ")
                                    withStyle(SpanStyle(color = theme.colors.accent)) {
                                        append("REVIEWS")
                                    }
                                } else {
                                    append("ARENA REVIEWS")
                                }
                            },
                            fontSize = if (isExpanded) 48.sp else 32.sp,
                            fontWeight = FontWeight.Black,
                            fontStyle = FontStyle.Italic,
                            color = theme.colors.textPrimary,
                            lineHeight = if (isExpanded) 52.sp else 36.sp
                        )
                        Spacer(Modifier.height(16.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                Icons.Default.Chat,
                                contentDescription = null,
                                tint = theme.colors.textDisabled,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                "USER FEEDBACK",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.colors.textDisabled,
                                letterSpacing = 4.sp
                            )
                        }
                    }

                    if (onBack != null) {
                        OutlinedButton(
                            onClick = onBack,
                            modifier = Modifier.height(48.dp),
                            shape = RoundedCornerShape(16.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, theme.colors.border),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = theme.colors.textDisabled)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, null, modifier = Modifier.size(16.dp))
                                Text("BACK TO ARENA", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                            }
                        }
                    }
                }

                if (isExpanded) {
                    // 2-Column Desktop Layout
                    Row(modifier = Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(32.dp)) {
                        // Left: Write Review (Fixed)
                        Column(modifier = Modifier.weight(5f)) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(32.dp))
                                    .background(theme.colors.card)
                                    .border(1.dp, theme.colors.border, RoundedCornerShape(32.dp))
                                    .padding(32.dp)
                            ) {
                                Column {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Star,
                                            contentDescription = null,
                                            tint = Color(0xFFEAB308),
                                            modifier = Modifier.size(24.dp)
                                        )
                                        Text(
                                            if (userReview != null) "EDIT YOUR REVIEW" else "WRITE A REVIEW",
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.Black,
                                            fontStyle = FontStyle.Italic,
                                            color = theme.colors.textPrimary
                                        )
                                    }
                                    Spacer(Modifier.height(32.dp))

                                    // Star rating
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                                    ) {
                                        for (star in 1..5) {
                                            val isSelected = star <= rating
                                            val starScale by animateFloatAsState(if (isSelected) 1.2f else 1f, label = "starScale")
                                            val starRotation by animateFloatAsState(if (isSelected) 10f else 0f, label = "starRotation")

                                            Text(
                                                text = "★",
                                                fontSize = 48.sp,
                                                color = if (isSelected) Color(0xFFEAB308) else theme.colors.textDisabled.copy(alpha = 0.2f),
                                                modifier = Modifier
                                                    .scale(starScale)
                                                    .rotate(starRotation)
                                                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { if (!isSubmitting) rating = star }
                                            )
                                        }
                                    }
                                    Spacer(Modifier.height(32.dp))

                                    // Comment field
                                    OutlinedTextField(
                                        value = comment,
                                        onValueChange = { comment = it },
                                        placeholder = { Text("Tell us about your experience...", color = theme.colors.textDisabled, fontWeight = FontWeight.Bold) },
                                        modifier = Modifier.fillMaxWidth().heightIn(min = 160.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = Color.Transparent,
                                            unfocusedBorderColor = Color.Transparent,
                                            focusedTextColor = theme.colors.textPrimary,
                                            unfocusedTextColor = theme.colors.textPrimary,
                                            focusedContainerColor = theme.colors.backgroundSecondary,
                                            unfocusedContainerColor = theme.colors.backgroundSecondary
                                        ),
                                        shape = RoundedCornerShape(16.dp),
                                        enabled = !isSubmitting,
                                        textStyle = LocalTextStyle.current.copy(fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    )
                                    Spacer(Modifier.height(32.dp))

                                    LoadingButton(
                                        onClick = { handleSubmit() },
                                        loading = isSubmitting,
                                        enabled = rating > 0,
                                        text = if (userReview != null) "UPDATE REVIEW" else "SUBMIT REVIEW",
                                        loadingText = "Posting...",
                                        backgroundColor = theme.colors.accent,
                                        icon = { Icon(Icons.AutoMirrored.Filled.Send, null, modifier = Modifier.size(20.dp)) }
                                    )
                                }
                            }
                        }

                        // Right: List of Reviews
                        Column(modifier = Modifier.weight(7f)) {
                            Text(
                                "RECENT REVIEWS",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black,
                                fontStyle = FontStyle.Italic,
                                color = theme.colors.textDisabled,
                                letterSpacing = 4.sp,
                                modifier = Modifier.padding(bottom = 24.dp, start = 12.dp)
                            )
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(24.dp)
                            ) {
                                if (reviews.isEmpty()) {
                                    item { EmptyReviewsState(theme) }
                                } else {
                                    itemsIndexed(reviews) { index, review ->
                                        ReviewItem(review, userReview, theme, dateFormat, index)
                                    }
                                }
                                item { Spacer(Modifier.height(80.dp)) }
                            }
                        }
                    }
                } else {
                    // Mobile Vertical Layout
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(32.dp)
                    ) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(32.dp))
                                    .background(theme.colors.card)
                                    .border(1.dp, theme.colors.border, RoundedCornerShape(32.dp))
                                    .padding(24.dp)
                            ) {
                                Column {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Star,
                                            contentDescription = null,
                                            tint = Color(0xFFEAB308),
                                            modifier = Modifier.size(24.dp)
                                        )
                                        Text(
                                            if (userReview != null) "EDIT YOUR REVIEW" else "WRITE A REVIEW",
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.Black,
                                            fontStyle = FontStyle.Italic,
                                            color = theme.colors.textPrimary
                                        )
                                    }
                                    Spacer(Modifier.height(24.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        for (star in 1..5) {
                                            val isSelected = star <= rating
                                            Text(
                                                text = "★",
                                                fontSize = 40.sp,
                                                color = if (isSelected) Color(0xFFEAB308) else theme.colors.textDisabled.copy(alpha = 0.2f),
                                                modifier = Modifier.clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { if (!isSubmitting) rating = star }
                                            )
                                        }
                                    }
                                    Spacer(Modifier.height(24.dp))

                                    OutlinedTextField(
                                        value = comment,
                                        onValueChange = { comment = it },
                                        placeholder = { Text("Tell us about your experience...", color = theme.colors.textDisabled, fontWeight = FontWeight.Bold) },
                                        modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = Color.Transparent,
                                            unfocusedBorderColor = Color.Transparent,
                                            focusedContainerColor = theme.colors.backgroundSecondary,
                                            unfocusedContainerColor = theme.colors.backgroundSecondary
                                        ),
                                        shape = RoundedCornerShape(16.dp),
                                        enabled = !isSubmitting
                                    )
                                    Spacer(Modifier.height(24.dp))

                                    LoadingButton(
                                        onClick = { handleSubmit() },
                                        loading = isSubmitting,
                                        enabled = rating > 0,
                                        text = if (userReview != null) "UPDATE REVIEW" else "SUBMIT REVIEW",
                                        loadingText = "Posting...",
                                        backgroundColor = theme.colors.accent
                                    )
                                }
                            }
                        }
                        item {
                            Text(
                                "RECENT REVIEWS",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black,
                                fontStyle = FontStyle.Italic,
                                color = theme.colors.textDisabled,
                                letterSpacing = 4.sp,
                                modifier = Modifier.padding(start = 12.dp)
                            )
                        }
                        if (reviews.isEmpty()) {
                            item { EmptyReviewsState(theme) }
                        } else {
                            itemsIndexed(reviews) { index, review ->
                                ReviewItem(review, userReview, theme, dateFormat, index)
                            }
                        }
                        item { Spacer(Modifier.height(80.dp)) }
                    }
                }
            }
        }

        // Success toast
        AnimatedVisibility(
            visible = showSuccess,
            enter = slideInVertically { -it } + fadeIn(),
            exit = slideOutVertically { -it } + fadeOut(),
            modifier = Modifier.align(Alignment.TopCenter).padding(top = 32.dp)
        ) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(50.dp))
                    .background(theme.colors.success)
                    .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(50.dp))
                    .padding(horizontal = 32.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
                Text(
                    "REVIEW POSTED!",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                    letterSpacing = 2.sp
                )
            }
        }
    }
}




