// lib/lease/generateLease.ts
// Markdown template engine for lease agreements.
// Replaces {{PLACEHOLDERS}} with actual tenant/building/lease data.

export interface LeaseData {
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string | null;
  tenantNationalId: string | null;
  agencyName: string;
  agencyEmail: string;
  agencyPhone: string;
  landlordName: string;
  landlordPhone: string | null;
  buildingName: string;
  buildingLocation: string;
  buildingLocale: string | null;
  unitNumber: string;
  unitType: string | null;
  unitFloor: string | null;
  leaseStart: string;
  leaseEnd: string;
  rentAmount: number;
  depositAmount: number;
  escalationType: string | null;
  escalationValue: number | null;
  billingMonth: string;
}

/**
 * Generate a lease agreement by replacing all {{PLACEHOLDERS}} in the template.
 */
export function generateLease(template: string, data: LeaseData): string {
  return template
    .replace(/{{TENANT_NAME}}/g, data.tenantName)
    .replace(/{{TENANT_PHONE}}/g, data.tenantPhone)
    .replace(/{{TENANT_EMAIL}}/g, data.tenantEmail ?? "N/A")
    .replace(/{{TENANT_NATIONAL_ID}}/g, data.tenantNationalId ?? "N/A")
    .replace(/{{AGENCY_NAME}}/g, data.agencyName)
    .replace(/{{AGENCY_EMAIL}}/g, data.agencyEmail)
    .replace(/{{AGENCY_PHONE}}/g, data.agencyPhone)
    .replace(/{{LANDLORD_NAME}}/g, data.landlordName)
    .replace(/{{LANDLORD_PHONE}}/g, data.landlordPhone ?? "N/A")
    .replace(/{{BUILDING_NAME}}/g, data.buildingName)
    .replace(/{{BUILDING_LOCATION}}/g, data.buildingLocation)
    .replace(/{{BUILDING_LOCALE}}/g, data.buildingLocale ?? "N/A")
    .replace(/{{UNIT_NUMBER}}/g, data.unitNumber)
    .replace(/{{UNIT_TYPE}}/g, data.unitType ?? "N/A")
    .replace(/{{UNIT_FLOOR}}/g, data.unitFloor ?? "N/A")
    .replace(/{{LEASE_START}}/g, formatDate(data.leaseStart))
    .replace(/{{LEASE_END}}/g, formatDate(data.leaseEnd))
    .replace(/{{RENT_AMOUNT}}/g, formatKES(data.rentAmount))
    .replace(/{{DEPOSIT_AMOUNT}}/g, formatKES(data.depositAmount))
    .replace(/{{ESCALATION_TYPE}}/g, data.escalationType ?? "FIXED")
    .replace(/{{ESCALATION_VALUE}}/g, data.escalationValue?.toString() ?? "0")
    .replace(/{{ESCALATION_UNIT}}/g, data.escalationType === "PERCENTAGE" ? "%" : " KES")
    .replace(/{{BILLING_MONTH}}/g, data.billingMonth);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
}

function formatKES(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Default lease template for agencies that haven't customized theirs.
 */
export const defaultLeaseTemplate = `# TENANCY AGREEMENT

This agreement is made on **{{BILLING_MONTH}}** between:

**{{AGENCY_NAME}}** (the Agent) acting on behalf of **{{LANDLORD_NAME}}** (the Landlord)
and **{{TENANT_NAME}}** (the Tenant).

---

## 1. PROPERTY DETAILS

**Building:** {{BUILDING_NAME}}, {{BUILDING_LOCATION}} {{BUILDING_LOCALE}}
**Unit:** {{UNIT_NUMBER}} ({{UNIT_TYPE}}) {{UNIT_FLOOR}}

---

## 2. LEASE TERM

**Start Date:** {{LEASE_START}}
**End Date:** {{LEASE_END}}

---

## 3. RENT

**Monthly Rent:** {{RENT_AMOUNT}}
**Security Deposit:** {{DEPOSIT_AMOUNT}}

Rent is due on the 1st of every month. Late payments attract a penalty as per agency policy.

---

## 4. RENT ESCALATION

Upon renewal, rent will increase by **{{ESCALATION_VALUE}}{{ESCALATION_UNIT}}**.

---

## 5. TENANT DETAILS

**Name:** {{TENANT_NAME}}
**Phone:** {{TENANT_PHONE}}
**Email:** {{TENANT_EMAIL}}
**National ID:** {{TENANT_NATIONAL_ID}}

---

## 6. LANDLORD / AGENT DETAILS

**Landlord:** {{LANDLORD_NAME}}
**Landlord Phone:** {{LANDLORD_PHONE}}
**Agency:** {{AGENCY_NAME}}
**Agency Phone:** {{AGENCY_PHONE}}
**Agency Email:** {{AGENCY_EMAIL}}

---

## 7. GENERAL TERMS

- The tenant shall maintain the property in good condition.
- No subletting without written consent.
- The landlord reserves the right to inspect the property with 24 hours notice.
- Utilities (water, electricity) are billed separately based on consumption.
- Either party may terminate this agreement with 30 days written notice.

---

**Signed digitally via PropFlow Kenya**
`;

/**
 * List of all available placeholders for the template editor UI.
 */
export const placeholderList = [
  { key: "{{TENANT_NAME}}", description: "Tenant's full name" },
  { key: "{{TENANT_PHONE}}", description: "Tenant's phone number" },
  { key: "{{TENANT_EMAIL}}", description: "Tenant's email (or N/A)" },
  { key: "{{TENANT_NATIONAL_ID}}", description: "Tenant's national ID (or N/A)" },
  { key: "{{AGENCY_NAME}}", description: "Agency name" },
  { key: "{{AGENCY_EMAIL}}", description: "Agency email" },
  { key: "{{AGENCY_PHONE}}", description: "Agency phone" },
  { key: "{{LANDLORD_NAME}}", description: "Landlord name" },
  { key: "{{LANDLORD_PHONE}}", description: "Landlord phone (or N/A)" },
  { key: "{{BUILDING_NAME}}", description: "Building name" },
  { key: "{{BUILDING_LOCATION}}", description: "Building location" },
  { key: "{{BUILDING_LOCALE}}", description: "Building locale/neighborhood (or N/A)" },
  { key: "{{UNIT_NUMBER}}", description: "Unit number (e.g. A1)" },
  { key: "{{UNIT_TYPE}}", description: "Unit type (1BR, 2BR, etc.)" },
  { key: "{{UNIT_FLOOR}}", description: "Floor number (or N/A)" },
  { key: "{{LEASE_START}}", description: "Lease start date (formatted)" },
  { key: "{{LEASE_END}}", description: "Lease end date (formatted)" },
  { key: "{{RENT_AMOUNT}}", description: "Monthly rent amount (KES)" },
  { key: "{{DEPOSIT_AMOUNT}}", description: "Security deposit amount (KES)" },
  { key: "{{ESCALATION_TYPE}}", description: "Escalation type (FIXED/PERCENTAGE)" },
  { key: "{{ESCALATION_VALUE}}", description: "Escalation value" },
  { key: "{{ESCALATION_UNIT}}", description: "Escalation unit (% or KES)" },
  { key: "{{BILLING_MONTH}}", description: "Current billing month" },
];