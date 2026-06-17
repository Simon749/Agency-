"use server";

import { put } from "@vercel/blob";

/**
 * Upload a photo to Vercel Blob.
 * Returns the public URL.
 */
export async function uploadPhoto(file: File): Promise<string> {
  const blob = await put(file.name, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return blob.url;
}

/**
 * Upload multiple photos, return comma-separated URLs.
 */
export async function uploadPhotos(files: File[]): Promise<string> {
  const urls = await Promise.all(files.map((f) => uploadPhoto(f)));
  return urls.join(",");
}