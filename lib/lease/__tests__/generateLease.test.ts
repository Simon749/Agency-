// lib/lease/__tests__/generateLease.test.ts
import { describe, it, expect } from "vitest";
import { generateLease, defaultLeaseTemplate, placeholderList } from "../generateLease";
import type { LeaseData } from "../generateLease";

const mockData: LeaseData = {
  tenantName: "John Kamau",
  tenantPhone: "+254712345678",
  tenantEmail: "john@example.com",
  tenantNationalId: "12345678",
  agencyName: "PropFlow Agency",
  agencyEmail: "agency@propflow.co.ke",
  agencyPhone: "+254711111111",
  landlordName: "Jane Wanjiku",
  landlordPhone: "+254722222222",
  buildingName: "Sunset Apartments",
  buildingLocation: "Westlands",
  buildingLocale: "Nairobi",
  unitNumber: "A3",
  unitType: "2BR",
  unitFloor: "3rd",
  leaseStart: "2026-01-01",
  leaseEnd: "2027-01-01",
  rentAmount: 45000,
  depositAmount: 90000,
  escalationType: "PERCENTAGE",
  escalationValue: 10,
  billingMonth: "2026-06",
};

describe("generateLease", () => {
  it("replaces all placeholders in default template", () => {
    const result = generateLease(defaultLeaseTemplate, mockData);

    // Check key replacements
    expect(result).toContain("John Kamau");
    expect(result).toContain("+254712345678");
    expect(result).toContain("john@example.com");
    expect(result).toContain("12345678");
    expect(result).toContain("PropFlow Agency");
    expect(result).toContain("Jane Wanjiku");
    expect(result).toContain("Sunset Apartments");
    expect(result).toContain("Westlands");
    expect(result).toContain("Nairobi");
    expect(result).toContain("A3");
    expect(result).toContain("2BR");
    expect(result).toContain("3rd");
    expect(result).toContain("KSh 45,000"); // or KES 45,000
    expect(result).toContain("KSh 90,000");
    expect(result).toContain("10%");
    expect(result).not.toContain("{{TENANT_NAME}}");
    expect(result).not.toContain("{{RENT_AMOUNT}}");
  });

  it("handles null values gracefully", () => {
    const dataWithNulls: LeaseData = {
      ...mockData,
      tenantEmail: null,
      tenantNationalId: null,
      buildingLocale: null,
      unitType: null,
      unitFloor: null,
      escalationType: null,
      escalationValue: null,
      landlordPhone: null,
    };

    const result = generateLease(defaultLeaseTemplate, dataWithNulls);

    expect(result).toContain("N/A"); // for null values
    expect(result).toContain("0"); // escalation value
    expect(result).toContain("FIXED"); // default escalation type
  });

  it("formats dates correctly", () => {
    const result = generateLease(defaultLeaseTemplate, mockData);

    expect(result).toContain("January 1, 2026");
    expect(result).toContain("January 1, 2027");
  });

  it("formats currency correctly", () => {
    const result = generateLease(defaultLeaseTemplate, mockData);

    expect(result).toContain("45,000");
    expect(result).toContain("90,000");
  });

  it("handles custom templates", () => {
    const customTemplate = `# CUSTOM LEASE

Tenant: {{TENANT_NAME}}
Rent: {{RENT_AMOUNT}}
Special clause: No pets allowed.
`;

    const result = generateLease(customTemplate, mockData);

    expect(result).toContain("CUSTOM LEASE");
    expect(result).toContain("John Kamau");
    expect(result).toContain("45,000");
    expect(result).toContain("No pets allowed");
    expect(result).not.toContain("{{TENANT_NAME}}");
  });

  it("handles PERCENTAGE escalation unit correctly", () => {
    const data = { ...mockData, escalationType: "PERCENTAGE", escalationValue: 15 };
    const result = generateLease(defaultLeaseTemplate, data);

    expect(result).toContain("15%");
  });

  it("handles FIXED escalation unit correctly", () => {
    const data = { ...mockData, escalationType: "FIXED", escalationValue: 5000 };
    const result = generateLease(defaultLeaseTemplate, data);

    expect(result).toContain("5,000 KES");
  });

  it("placeholder list is complete", () => {
    expect(placeholderList.length).toBeGreaterThan(0);
    expect(placeholderList.some((p) => p.key === "{{TENANT_NAME}}")).toBe(true);
    expect(placeholderList.some((p) => p.key === "{{RENT_AMOUNT}}")).toBe(true);
  });
});