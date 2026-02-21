"use client";

import { useState } from "react";

export default function Home() {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Portal format: dd-MM-yyyy
  const [expiryDate, setExpiryDate] = useState("24-02-2026");

  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  async function generate() {
    setError("");
    setLink("");

    const a = Number(amount);
    if (!description.trim()) return setError("Item description is required.");
    if (!Number.isFinite(a) || a <= 0) return setError("Amount must be > 0.");
    if (!firstName.trim()) return setError("First name is required.");
    if (!lastName.trim()) return setError("Last name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (!expiryDate.trim()) return setError("Expiry date is required (dd-MM-yyyy).");

    setLoading(true);
    try {
      const res = await fetch("/api/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: a,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          invoiceExpiryDate: expiryDate.trim(),
          transactionType: "SALE",
          currency: "AED",
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
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      <h2>N-Genius Payment Link Generator</h2>

      <label>Item description</label>
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

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label>First name</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            style={{ width: "100%", padding: 10, margin: "8px 0 16px" }}
          />
        </div>

        <div style={{ flex: 1 }}>
          <label>Last name</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            style={{ width: "100%", padding: 10, margin: "8px 0 16px" }}
          />
        </div>
      </div>

      <label>Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="customer@email.com"
        type="email"
        style={{ width: "100%", padding: 10, margin: "8px 0 16px" }}
      />

      <label>Expiry date (dd-MM-yyyy)</label>
      <input
        value={expiryDate}
        onChange={(e) => setExpiryDate(e.target.value)}
        placeholder="24-02-2026"
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
