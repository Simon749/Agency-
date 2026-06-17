"use client";

import { useState, useRef } from "react";
import { createComplaint } from "@/lib/actions/complaints";
import Link from "next/link";

export default function NewComplaintPage() {
  const [pending, setPending] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await createComplaint(formData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit complaint");
      setPending(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) setPhotoCount(Math.min(files.length, 3));
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    fontSize: "14px",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#ffffff",
    outline: "none",
    fontFamily: '"Helvetica Neue", sans-serif',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.45)",
    marginBottom: "8px",
    display: "block",
  };

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <Link
          href="/tenant/complaints"
          style={{
            fontSize: "12px",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.5)",
            textDecoration: "none",
            textTransform: "uppercase",
          }}
        >
          ← Back to Complaints
        </Link>
      </div>

      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        File a Complaint
      </p>
      <h1
        style={{
          fontSize: "clamp(24px, 3vw, 36px)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          color: "#ffffff",
          margin: "0 0 48px 0",
        }}
      >
        New Complaint
      </h1>

      <form
        ref={formRef}
        action={handleSubmit}
        style={{ maxWidth: "640px", display: "grid", gap: "28px" }}
      >
        {/* Title */}
        <div>
          <label style={labelStyle}>Title</label>
          <input
            name="title"
            type="text"
            required
            placeholder="e.g. Water leak in bathroom"
            style={inputStyle}
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            name="description"
            required
            rows={5}
            placeholder="Describe the issue in detail..."
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        </div>

        {/* Priority */}
        <div>
          <label style={labelStyle}>Priority</label>
          <select name="priority" defaultValue="AUTO" style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="AUTO" style={{ backgroundColor: "#1a1a1a" }}>Auto-detect (recommended)</option>
            <option value="LOW" style={{ backgroundColor: "#1a1a1a" }}>Low</option>
            <option value="MEDIUM" style={{ backgroundColor: "#1a1a1a" }}>Medium</option>
            <option value="HIGH" style={{ backgroundColor: "#1a1a1a" }}>High</option>
            <option value="URGENT" style={{ backgroundColor: "#1a1a1a" }}>Urgent</option>
          </select>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "6px" }}>
            We&apos;ll automatically set priority based on keywords if you choose Auto-detect.
          </p>
        </div>

        {/* Photo Upload */}
        <div>
          <label style={labelStyle}>Photos (up to 3)</label>
          <input
            name="photos"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            style={{
              ...inputStyle,
              padding: "12px 16px",
              cursor: "pointer",
            }}
          />
          {photoCount > 0 && (
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "8px" }}>
              {photoCount} photo{photoCount > 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
          <button
            type="submit"
            disabled={pending}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.16em",
              color: "#0b0b0b",
              backgroundColor: "#ffffff",
              border: "1px solid #ffffff",
              padding: "14px 32px",
              textTransform: "uppercase",
              fontFamily: '"Helvetica Neue", sans-serif',
              cursor: pending ? "not-allowed" : "pointer",
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? "Submitting..." : "Submit Complaint"}
          </button>
          <Link
            href="/tenant/complaints"
            style={{
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.16em",
              color: "rgba(255,255,255,0.6)",
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "14px 32px",
              textTransform: "uppercase",
              textDecoration: "none",
              fontFamily: '"Helvetica Neue", sans-serif',
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}