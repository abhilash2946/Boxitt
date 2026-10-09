package com.boxitt.app.services

import io.github.jan.supabase.storage.storage
import java.io.InputStream

object SupabaseStorageService {

    /**
     * Uploads a file to a Supabase storage bucket and returns the public URL.
     * @param bucket   The storage bucket name
     * @param filePath The destination path within the bucket
     * @param stream   The InputStream of the file to upload
     * @param mimeType The MIME type (e.g. "image/jpeg")
     */
    suspend fun uploadFile(bucket: String, filePath: String, stream: InputStream, mimeType: String): String {
        val bytes = stream.readBytes()
        Supabase.client.storage[bucket].upload(
            path = filePath,
            data = bytes,
            upsert = true
        )
        return Supabase.client.storage[bucket].publicUrl(filePath)
    }

    /**
     * Deletes a file from a Supabase storage bucket.
     * @param bucket   The storage bucket name
     * @param filePath The path of the file to delete
     */
    suspend fun deleteFile(bucket: String, filePath: String) {
        Supabase.client.storage[bucket].delete(listOf(filePath))
    }
}




