"use client";

import { useRef, useState } from "react";

export default function Home() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  const [copyStatus, setCopyStatus] = useState("idle"); 
  // "idle" | "success" | "failed"

  const linkInputRef = useRef(null);

  async function tryAutoCopy(text) {
    // Attempt auto copy (may fail on iPhone after async calls)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function selectLink() {
    const el = linkInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
    el.setSelectionRange(0, el.value.length);
  }

  async function tapToCopy() {
    if (!link) return;

    try {
      // This function is called directly by a user tap -> iPhone allows it.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        // fallback
        selectLink();
        document.execCommand("copy");
      }
      setCopyStatus("success");
    } catch {
      // fallback fallback
      try {
        selectLink();
        document.execCommand("copy");
        setCopyStatus("success");
      } catch {
        setCopyStatus("failed");
      }
    }
  }

  function openWhatsApp() {
    if (!link) return;
    // Opens WhatsApp with text prefilled (best iPhone flow)
    const text = encodeURIComponent(link);
    window.location.href = `https://wa.me/?text=${text}`;
  }

  async function generate() {
    setError("");
    setLink("");
    setCopyStatus("idle");

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

      // Auto-copy attempt (may fail on iPhone)
      const ok = await tryAutoCopy(data.paymentUrl);

      // Select link to make manual copy easy
      setTimeout(() => selectLink(), 50);

      setCopyStatus(ok ? "success" : "failed");
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
        {loading ? "Generating..." : "Generate Link"}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      {link && (
        <div style={{ marginTop: 16 }}>
          {copyStatus === "success" && (
            <p style={{ color: "green", fontWeight: "bold" }}>
              Copied ✅
            </p>
          )}

          {copyStatus === "failed" && (
            <p style={{ color: "#b45309", fontWeight: "bold" }}>
              iPhone blocked auto-copy. Tap the button below to copy.
            </p>
          )}

          <input
            ref={linkInputRef}
            value={link}
            readOnly
            style={{ width: "100%", padding: 12, fontSize: 14 }}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              onClick={tapToCopy}
              style={{
                flex: 1,
                padding: "12px 14px",
                fontSize: 16,
                background: "#111827",
                color: "white",
                border: "none",
                borderRadius: 8,
              }}
            >
              Tap to Copy
            </button>

            <button
              onClick={openWhatsApp}
              style={{
                flex: 1,
                padding: "12px 14px",
                fontSize: 16,
                background: "#16a34a",
                color: "white",
                border: "none",
                borderRadius: 8,
              }}
            >
              Open WhatsApp
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
