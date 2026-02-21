"use client";

import { useState } from "react";

export default function Home() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyToClipboard(text) {
    try {
      // Modern browsers
      await navigator.clipboard.writeText(text);
    } catch {
      // iPhone fallback (Safari)
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  async function generate() {
    setError("");
    setLink("");
    setCopied(false);

    const a = Number(amount);
    if (!description.trim()) return setError("Please enter a description.");
    if (!Number.isFinite(a) || a <= 0) return setError("Please enter a valid amount > 0.");

    setLoading(true);
    try {
      const res = await fetch("/api/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: a,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");

      setLink(data.paymentUrl);

      // 🔥 AUTO COPY
      await copyToClipboard(data.paymentUrl);
      setCopied(true);

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 650, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      <h2>N-Genius Payment Link Generator</h2>

      <label>Description</label>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g., AE Tickets - Arsenal vs City"
        style={{ width: "100%", padding: 12, margin: "8px 0 16px", fontSize: 16 }}
      />

      <label>Amount (AED)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="e.g., 260"
        type="number"
        style={{ width: "100%", padding: 12, margin: "8px 0 16px", fontSize: 16 }}
      />

      <button
        onClick={generate}
        disabled={loading}
        style={{
          padding: "14px 18px",
          fontSize: 16,
          background: "#0b5ed7",
          color: "white",
          border: "none",
          borderRadius: 8,
          width: "100%",
        }}
      >
        {loading ? "Generating..." : "Generate & Copy Link"}
      </button>

      {copied && (
        <p style={{ color: "green", marginTop: 16, fontWeight: "bold" }}>
          Link copied to clipboard ✓
        </p>
      )}

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      {link && (
        <div style={{ marginTop: 16 }}>
          <input
            value={link}
            readOnly
            style={{ width: "100%", padding: 12, fontSize: 14 }}
          />
        </div>
      )}
    </main>
  );
}
