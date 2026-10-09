import { supabase } from './supabase';

export const supabaseStorage = {
  /**
   * Uploads a file to a Supabase storage bucket and returns the public URL.
   */
  async uploadFile(bucket: string, filePath: string, file: File | Blob): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  },

  /**
   * Deletes a file from a Supabase storage bucket.
   */
  async deleteFile(bucket: string, filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) throw error;
  }
};
