"use server";

import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { complaints, complaintUpdates, tenants, buildings, units } from "@/db/schema";
import { getSessionMeta } from "@/lib/auth/getRole";
import { redirect } from "next/navigation";
import { uploadPhotos } from "@/lib/blob";

// ── Keyword-based auto-priority ────────────────────────────────────
const HIGH_KEYWORDS = ["water leak", "leak", "electrical", "power", "fire", "flood", "broken pipe", "no water", "blackout"];
const LOW_KEYWORDS = ["painting", "cleaning", "dust", "garden", "aesthetic", "cosmetic"];

function autoPriority(title: string, description: string): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  const text = (title + " " + description).toLowerCase();
  if (HIGH_KEYWORDS.some((k) => text.includes(k))) return "HIGH";
  if (LOW_KEYWORDS.some((k) => text.includes(k))) return "LOW";
  return "MEDIUM";
}

// ── Create Complaint (Tenant) ──────────────────────────────────────
export async function createComplaint(formData: FormData) {
  const session = await getSessionMeta();
  const { userId, role } = session;

  if (role !== "TENANT") {
    throw new Error("Only tenants can file complaints.");
  }

  const db = getDb();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkUserId, userId))
    .limit(1);

  if (!tenant) {
    throw new Error("Tenant profile not found.");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const priorityInput = formData.get("priority") as string;

  // Upload photos (up to 3)
  const photoFiles: File[] = [];
  for (let i = 0; i < 3; i++) {
    const file = formData.get(`photo_${i}`) as File | null;
    if (file && file.size > 0) photoFiles.push(file);
  }

  let photoUrls: string[] | null = null;
  if (photoFiles.length > 0) {
    const urls = await uploadPhotos(photoFiles);
    photoUrls = urls.split(",");
  }

  const priority =
    priorityInput === "AUTO" || !priorityInput
      ? autoPriority(title, description)
      : (priorityInput as "LOW" | "MEDIUM" | "HIGH" | "URGENT");

  await db.insert(complaints).values({
    tenantId: tenant.id,
    agencyId: tenant.agencyId,
    buildingId: tenant.buildingId,
    title,
    description,
    priority,
    photoUrls,
    status: "OPEN",
  });

  revalidatePath("/tenant/complaints");
  redirect("/tenant/complaints");
}

// ── Fetch Complaints for Tenant ──────────────────────────────────────
export async function getTenantComplaints() {
  const session = await getSessionMeta();
  const { userId, role } = session;

  if (role !== "TENANT") {
    throw new Error("Unauthorized");
  }

  const db = getDb();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkUserId, userId))
    .limit(1);

  if (!tenant) return [];

  const rows = await db
    .select()
    .from(complaints)
    .where(eq(complaints.tenantId, tenant.id))
    .orderBy(desc(complaints.createdAt));

  return rows;
}

// ── Fetch All Complaints for Agency (Admin/Manager) ─────────────────
export async function getAgencyComplaints(filters?: {
  buildingId?: string;
  status?: string;
  priority?: string;
}) {
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!agencyId || !["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(role ?? "")) {
    throw new Error("Unauthorized");
  }

  const db = getDb();

  const rows = await db
    .select({
      complaint: complaints,
      tenantName: tenants.fullName,
      tenantPhone: tenants.phone,
      buildingName: buildings.name,
      unitNumber: units.unitNumber,
    })
    .from(complaints)
    .leftJoin(tenants, eq(complaints.tenantId, tenants.id))
    .leftJoin(buildings, eq(complaints.buildingId, buildings.id))
    .leftJoin(units, eq(tenants.unitId, units.id))
    .where(eq(complaints.agencyId, agencyId))
    .orderBy(desc(complaints.createdAt));

  return rows.filter((r) => {
    if (filters?.buildingId && r.complaint.buildingId !== filters.buildingId) return false;
    if (filters?.status && r.complaint.status !== filters.status) return false;
    if (filters?.priority && r.complaint.priority !== filters.priority) return false;
    return true;
  });
}

// ── Fetch Single Complaint with Updates ────────────────────────────
export async function getComplaintDetail(complaintId: string) {
  const session = await getSessionMeta();
  const { agencyId, role, userId } = session;

  const db = getDb();

  const [complaintRow] = await db
    .select({
      complaint: complaints,
      tenantName: tenants.fullName,
      tenantPhone: tenants.phone,
      tenantEmail: tenants.email,
      buildingName: buildings.name,
      unitNumber: units.unitNumber,
    })
    .from(complaints)
    .leftJoin(tenants, eq(complaints.tenantId, tenants.id))
    .leftJoin(buildings, eq(complaints.buildingId, buildings.id))
    .leftJoin(units, eq(tenants.unitId, units.id))
    .where(eq(complaints.id, complaintId))
    .limit(1);

  if (!complaintRow) throw new Error("Complaint not found");

  // Authorization check
  if (role === "TENANT") {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.clerkUserId, userId))
      .limit(1);
    if (!tenant || tenant.id !== complaintRow.complaint.tenantId) {
      throw new Error("Unauthorized");
    }
  } else if (role === "AGENCY_OWNER" || role === "MANAGER" || role === "FIELD_AGENT") {
    if (complaintRow.complaint.agencyId !== agencyId) {
      throw new Error("Unauthorized");
    }
  }

  const updates = await db
    .select()
    .from(complaintUpdates)
    .where(eq(complaintUpdates.complaintId, complaintId))
    .orderBy(desc(complaintUpdates.createdAt));

  return { ...complaintRow, updates };
}

// ── Update Complaint Status / Assign ───────────────────────────────
export async function updateComplaint(
  complaintId: string,
  data: {
    status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
    assignedTo?: string | null;
    note?: string;
  }
) {
  const session = await getSessionMeta();
  const { agencyId, role, userId } = session;

  if (!["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(role ?? "")) {
    throw new Error("Unauthorized");
  }

  const db = getDb();

  const [existing] = await db
    .select()
    .from(complaints)
    .where(and(eq(complaints.id, complaintId), eq(complaints.agencyId, agencyId!)))
    .limit(1);

  if (!existing) throw new Error("Complaint not found or access denied.");

  const updateValues: Record<string, unknown> = {};
  if (data.status) updateValues.status = data.status;
  if (data.assignedTo !== undefined) updateValues.assignedTo = data.assignedTo;
  if (data.status === "RESOLVED") updateValues.resolvedAt = new Date();

  if (Object.keys(updateValues).length > 0) {
    await db
      .update(complaints)
      .set(updateValues)
      .where(eq(complaints.id, complaintId));
  }

  // Add update note if provided
  if (data.note) {
    await db.insert(complaintUpdates).values({
      complaintId,
      authorClerkId: userId,
      message: data.note,
    });
  }

  revalidatePath("/admin/complaints");
  revalidatePath(`/admin/complaints/${complaintId}`);
  revalidatePath("/tenant/complaints");
}

// ── Fetch Buildings for Filter Dropdown ────────────────────────────
export async function getAgencyBuildings() {
  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) return [];

  const db = getDb();
  return db
    .select({ id: buildings.id, name: buildings.name })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId))
    .orderBy(buildings.name);
}