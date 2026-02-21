"use client";

import { useState } from "react";

export default function Home() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  async function generate() {
    setError("");
    setLink("");

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
        style={{ width: "100%", padding: 10, margin: "8px 0 16px" }}
      />

      <label>Amount (AED)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="e.g., 260"
        type="number"
        style={{ width: "100%", padding: 10, margin: "8px 0 16px" }}
      />

      <button onClick={generate} disabled={loading} style={{ padding: "10px 14px" }}>
        {loading ? "Generating..." : "Generate Link"}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      {link && (
        <div style={{ marginTop: 16 }}>
          <p><b>Payment Link:</b></p>
          <input value={link} readOnly style={{ width: "100%", padding: 10 }} />
        </div>
      )}
    </main>
  );
}
