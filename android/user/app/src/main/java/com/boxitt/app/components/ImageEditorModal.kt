package com.boxitt.app.components

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.boxitt.app.contexts.LocalAppTheme
import java.io.File
import java.io.FileOutputStream

@Composable
fun ImageEditorModal(
    imageUri: Uri,
    onSave: (Uri) -> Unit,
    onCancel: () -> Unit
) {
    val theme = LocalAppTheme.current
    val context = LocalContext.current
    val bitmap = remember(imageUri) {
        try {
            val stream = context.contentResolver.openInputStream(imageUri)
            BitmapFactory.decodeStream(stream)
        } catch (e: Exception) {
            null
        }
    }

    var scale by remember { mutableStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }

    Dialog(onDismissRequest = onCancel) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .fillMaxHeight(0.8f)
                .clip(RoundedCornerShape(theme.radius.large))
                .background(theme.colors.background)
                .border(1.dp, theme.colors.border, RoundedCornerShape(theme.radius.large))
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(theme.colors.card)
                        .border(1.dp, theme.colors.border)
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Cancel",
                        tint = theme.colors.textDisabled,
                        modifier = Modifier.clickable { onCancel() }
                    )
                    Text(
                        text = "ADJUST PHOTO",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textPrimary
                    )
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = "Save",
                        tint = theme.colors.accent,
                        modifier = Modifier.clickable {
                            if (bitmap == null) return@clickable
                            try {
                                val size = Math.min(bitmap.width, bitmap.height)
                                val cropped = Bitmap.createBitmap(
                                    bitmap,
                                    (bitmap.width - size) / 2,
                                    (bitmap.height - size) / 2,
                                    size,
                                    size
                                )
                                val file = File(context.cacheDir, "cropped-${System.currentTimeMillis()}.jpg")
                                val out = FileOutputStream(file)
                                cropped.compress(Bitmap.CompressFormat.JPEG, 90, out)
                                out.flush()
                                out.close()
                                onSave(Uri.fromFile(file))
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    )
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .background(theme.colors.backgroundSecondary)
                        .pointerInput(Unit) {
                            detectTransformGestures { _, pan, zoom, _ ->
                                scale = (scale * zoom).coerceIn(1f, 5f)
                                offset += pan
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    if (bitmap != null) {
                        Canvas(
                            modifier = Modifier
                                .fillMaxSize()
                                .graphicsLayer(
                                    scaleX = scale,
                                    scaleY = scale,
                                    translationX = offset.x,
                                    translationY = offset.y
                                )
                        ) {
                            drawImage(bitmap.asImageBitmap())
                        }

                        Box(
                            modifier = Modifier
                                .size(240.dp)
                                .border(2.dp, Color.White.copy(alpha = 0.5f), CircleShape)
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(theme.colors.card)
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Drag to reposition • Circular crop applied",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.colors.textDisabled
                    )
                }
            }
        }
    }
}



