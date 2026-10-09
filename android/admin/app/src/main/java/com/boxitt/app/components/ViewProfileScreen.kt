package com.boxitt.app.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.zIndex
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.rememberAsyncImagePainter
import com.boxitt.app.UserProfile
import com.boxitt.app.contexts.LocalAppTheme
import com.boxitt.app.theme.vw
import com.boxitt.app.theme.clamp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.rotate

@Composable
fun ViewProfileScreen(
    profile: UserProfile,
    onEdit: () -> Unit,
    onLogout: (() -> Unit)? = null,
    onBack: (() -> Unit)? = null,
    onAlert: ((String, String, (() -> Unit)?) -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    val clipboardManager = LocalClipboardManager.current
    var isPasswordModalOpen by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    val displayPhone = profile.phone.orEmpty().ifEmpty { profile.phone_number.orEmpty() }.ifEmpty { "---" }
    val displayUsername = profile.username.orEmpty().ifEmpty { profile.display_name.orEmpty() }.ifEmpty { "No Name Set" }
    val displayJoinedDate = profile.joinedDate.orEmpty().ifEmpty { profile.joined_date.orEmpty() }.ifEmpty { profile.created_at.orEmpty() }.ifEmpty { "---" }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(theme.colors.background)
    ) {
        // Background Decorative Elements
        Box(
            modifier = Modifier
                .offset(x = (-50).dp, y = (-50).dp)
                .size(300.dp)
                .blur(100.dp)
                .background(theme.colors.accent.copy(alpha = 0.2f), CircleShape)
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = 50.dp, y = 50.dp)
                .size(300.dp)
                .blur(100.dp)
                .background(theme.colors.success.copy(alpha = 0.2f), CircleShape)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(24.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().zIndex(10f),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (onBack != null) {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier
                            .size(48.dp)
                            .background(theme.colors.card, RoundedCornerShape(12.dp))
                            .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                    ) {
                        Icon(imageVector = Icons.Default.ChevronLeft, contentDescription = null, tint = theme.colors.textPrimary)
                    }
                } else {
                    Box(modifier = Modifier.size(48.dp))
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ThemeSelector()
                    IconButton(
                        onClick = {
                            clipboardManager.setText(AnnotatedString("Check out my profile on Boxitt!"))
                            onAlert?.invoke("Profile link copied!", "success", null)
                        },
                        modifier = Modifier
                            .size(48.dp)
                            .background(theme.colors.card, RoundedCornerShape(12.dp))
                            .border(1.dp, theme.colors.border, RoundedCornerShape(12.dp))
                    ) {
                        Icon(imageVector = Icons.Default.Share, contentDescription = null, tint = theme.colors.textPrimary)
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
            
            Text(
                text = "MY PROFILE",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                color = theme.colors.textPrimary,
                letterSpacing = (-1).sp,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Profile Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(theme.radius.large))
                    .background(theme.colors.card)
                    .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                // Background decoration inside card
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 40.dp, y = (-40).dp)
                        .size(120.dp)
                        .blur(50.dp)
                        .background(theme.colors.accent.copy(alpha = 0.1f), CircleShape)
                )

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(140.dp)
                            .rotate(3f)
                            .clip(RoundedCornerShape(24.dp))
                            .background(theme.colors.backgroundSecondary)
                            .border(4.dp, theme.colors.border, RoundedCornerShape(24.dp))
                            .padding(8.dp)
                    ) {
                        if (!profile.profileImageUrl.isNullOrEmpty()) {
                            Image(
                                painter = rememberAsyncImagePainter(profile.profileImageUrl),
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(16.dp)),
                                contentScale = androidx.compose.ui.layout.ContentScale.Crop
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = theme.colors.textDisabled,
                                modifier = Modifier.size(64.dp).align(Alignment.Center)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Text(
                        text = displayUsername.uppercase(),
                        fontSize = if (displayUsername.length > 20) 24.sp else 32.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                        color = theme.colors.textPrimary,
                        textAlign = TextAlign.Center,
                        letterSpacing = (-1).sp,
                        lineHeight = 28.sp,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier
                            .background(theme.colors.accent.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
                            .border(1.dp, theme.colors.accent.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                            .padding(horizontal = 16.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Shield, contentDescription = null, tint = theme.colors.accent, modifier = Modifier.size(16.dp))
                        Text(
                            text = (profile.role ?: "User").uppercase(),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = theme.colors.accent,
                            letterSpacing = 2.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Button(
                    onClick = onEdit,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.weight(1f).height(56.dp),
                    contentPadding = PaddingValues()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Brush.linearGradient(colors = listOf(theme.colors.buttonGradient[0], theme.colors.buttonGradient[1]))),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Edit, null, tint = Color.White, modifier = Modifier.size(18.dp))
                            Text("EDIT PROFILE", color = Color.White, fontWeight = FontWeight.Black, fontSize = 12.sp, letterSpacing = 1.sp)
                        }
                    }
                }

                if (onLogout != null) {
                    Button(
                        onClick = onLogout,
                        colors = ButtonDefaults.buttonColors(containerColor = theme.colors.card),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(56.dp)
                            .border(1.dp, theme.colors.error.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(imageVector = Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, tint = theme.colors.error, modifier = Modifier.size(18.dp))
                            Text("LOGOUT", color = theme.colors.error, fontWeight = FontWeight.Black, fontSize = 12.sp, letterSpacing = 1.sp)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            ProfileSectionWithDivider(title = "Personal Information") {
                ProfileInfoRow(icon = Icons.Default.Person, label = "Username", value = displayUsername)
                ProfileInfoRow(icon = Icons.Default.CalendarToday, label = "Date of Birth", value = profile.dob.orEmpty().ifEmpty { "---" })
                ProfileInfoRow(icon = Icons.Default.Home, label = "Full Address", value = profile.address.orEmpty().ifEmpty { "---" })
                ProfileInfoRow(icon = Icons.Default.LocationOn, label = "City / Region", value = profile.location.orEmpty().ifEmpty { "---" })
            }

            Spacer(modifier = Modifier.height(32.dp))

            ProfileSectionWithDivider(title = "Contact Details") {
                ProfileInfoRow(icon = Icons.Default.Email, label = "Email Address", value = profile.email)
                ProfileInfoRow(icon = Icons.Default.Phone, label = "Phone Number", value = displayPhone)
                ProfileInfoRow(icon = Icons.Default.VerifiedUser, label = "Member Since", value = displayJoinedDate)
            }

            Spacer(modifier = Modifier.height(32.dp))

            ProfileSectionWithDivider(title = "Account Security") {
                ProfileInfoRow(
                    icon = Icons.Default.Lock,
                    label = "Password",
                    value = "Update Password",
                    onClick = { isPasswordModalOpen = true }
                )
            }

            Spacer(modifier = Modifier.height(40.dp))
        }

        if (isPasswordModalOpen) {
            ChangePasswordModal(
                userEmail = profile.email,
                onClose = { isPasswordModalOpen = false },
                onAlert = onAlert
            )
        }
    }
}

@Composable
private fun ProfileSectionWithDivider(title: String, content: @Composable ColumnScope.() -> Unit) {
    val theme = LocalAppTheme.current
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
                Text(
                    text = title.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.colors.textDisabled,
                    letterSpacing = 3.sp
                )
            Spacer(modifier = Modifier.width(12.dp))
            HorizontalDivider(color = theme.colors.border, thickness = 1.dp)
        }
        Spacer(modifier = Modifier.height(16.dp))
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            content()
        }
    }
}


@Composable
private fun ProfileInfoRow(
    icon: ImageVector,
    label: String,
    value: String,
    onClick: (() -> Unit)? = null
) {
    val theme = LocalAppTheme.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(theme.colors.card)
            .border(1.dp, theme.colors.border, RoundedCornerShape(20.dp))
            .clickable(enabled = onClick != null) { onClick?.invoke() }
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(theme.colors.accent.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = icon, contentDescription = null, tint = theme.colors.accent, modifier = Modifier.size(24.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = label.uppercase(), 
                    fontSize = 10.sp, 
                    fontWeight = FontWeight.Black, 
                    color = theme.colors.textDisabled, 
                    letterSpacing = 3.sp
                )
                Text(
                    text = value, 
                    fontSize = if (value.length > 25) 13.sp else 15.sp, 
                    fontWeight = FontWeight.Black, 
                    color = theme.colors.textPrimary, 
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic, 
                    letterSpacing = (-0.5).sp,
                    lineHeight = 18.sp
                )
            }
        }
        if (onClick != null) {
            Icon(imageVector = Icons.Default.ChevronRight, contentDescription = null, tint = theme.colors.textDisabled)
        }
    }
}




