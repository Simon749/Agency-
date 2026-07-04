// app/(tenant)/complaints/new/actions.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, complaints } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function submitComplaint(formData: FormData) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const db = getDb();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkUserId, userId))
    .limit(1);

  if (!tenant) return { success: false, error: "Tenant not found" };

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priority = (formData.get("priority") as string) || "MEDIUM";

  if (!title || !description) {
    return { success: false, error: "Title and description are required" };
  }

  // Handle photo uploads (if any)
  const photos = formData.getAll("photos") as File[];
  const photoUrls: string[] = [];

  // TODO: Upload photos to Vercel Blob / Cloudinary and populate photoUrls
  // For now, store empty array — implement upload when storage is ready

  await db.insert(complaints).values({
    tenantId: tenant.id,
    buildingId: tenant.buildingId,
    agencyId: tenant.agencyId,
    title,
    description,
    priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    photoUrls,
    status: "OPEN",
  });

  revalidatePath("/tenant/complaints");

  return { success: true };
}