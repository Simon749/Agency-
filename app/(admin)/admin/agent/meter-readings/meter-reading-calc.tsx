"use client";

import { useState, useEffect, ReactNode } from "react";

interface CalculationPreviewProps {
  previousReading: number;
  currentReading: string;
  ratePerUnit: string;
}

export function CalculationPreview({ previousReading, currentReading, ratePerUnit }: CalculationPreviewProps) {
  const [preview, setPreview] = useState<{
      [x: string]: ReactNode; units: number; charge: number 
} | null>(null);

  useEffect(() => {
    const current = parseFloat(currentReading);
    const rate = parseFloat(ratePerUnit);

    if (!isNaN(current) && !isNaN(rate) && current >= previousReading && rate > 0) {
      const units = current - previousReading;
      const charge = units * rate;
      setPreview({ units, charge });
    } else {
      setPreview(null);
    }
  }, [currentReading, ratePerUnit, previousReading]);

  if (!preview) return null;

  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        padding: "16px",
        marginBottom: "24px",
      }}
    >
      <p style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: "8px" }}>
        Charge Preview
      </p>
      <p style={{ fontSize: "14px", color: "#ffffff", margin: 0 }}>
        {preview.units.toFixed(2)} units consumed × KES {preview.ratePerUnit} ={" "}
        <strong style={{ color: "#f87171" }}>
          KES {preview.charge.toLocaleString("en-KE")}
        </strong>
      </p>
    </div>
  );
}