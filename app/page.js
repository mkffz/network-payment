"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export default function Home() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("idle");

  const linkInputRef = useRef(null);

  async function tryAutoCopy(text) {
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
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        selectLink();
        document.execCommand("copy");
      }
      setCopyStatus("success");
    } catch {
      selectLink();
      document.execCommand("copy");
      setCopyStatus("success");
    }
  }

  async function generate() {
    setError("");
    setLink("");
    setCopyStatus("idle");

    const enteredAmount = Number(amount);

    if (!description.trim()) return setError("Please enter a description.");
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0)
      return setError("Please enter a valid amount > 0.");

    const apiAmount = Math.round(enteredAmount * 100);

    setLoading(true);
    try {
      const res = await fetch("/api/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
body: JSON.stringify({
  description: description.trim(),
          amount: apiAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");

      setLink(data.paymentUrl);

      const ok = await tryAutoCopy(data.paymentUrl);
      setTimeout(() => selectLink(), 50);

      setCopyStatus(ok ? "success" : "failed");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 650,
        margin: "0 auto",
        padding: "40px 18px calc(40px + env(safe-area-inset-bottom))",
        fontFamily: "Arial, sans-serif",
      }}
    >
<div style={{ textAlign: "center", marginBottom: 20 }}>
  <Image
    src="/logo.png"
    alt="AE Logo"
    width={140}
    height={140}
    priority
    style={{
      margin: "0 auto",
      display: "block",
    }}
  />
</div>

<h2 style={{ marginBottom: 30, textAlign: "center" }}>
  N-Genius Payment Link Generator
</h2>
      <label>Description</label>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g., AE Tickets - Arsenal vs City"
style={{
  width: "calc(100% - 24px)",
  display: "block",
  margin: "10px auto 24px",
  padding: 14,
  fontSize: 18,
  borderRadius: 12,
}}
      />

      <label>Amount (AED)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="e.g., 260"
        type="number"
style={{
  width: "calc(100% - 24px)",
  display: "block",
  margin: "10px auto 28px",
  padding: 14,
  fontSize: 18,
  borderRadius: 12,
}}
      />

      <button
        onClick={generate}
        disabled={loading}
style={{
  width: "calc(100% - 24px)",
  display: "block",
  margin: "0 auto 24px",
  padding: "18px 18px",
  fontSize: 18,
  background: "#2f5ec4",
  color: "white",
  border: "none",
  borderRadius: 14,
}}
      >
        {loading ? "Generating..." : "Generate Link"}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      {link && (
        <div style={{ marginTop: 10 }}>
          {copyStatus === "success" && (
            <p style={{ color: "green", fontWeight: "bold", marginBottom: 10 }}>
              Copied ✅
            </p>
          )}

          <input
            ref={linkInputRef}
            value={link}
            readOnly
            style={{
  width: "calc(100% - 24px)",
  display: "block",
  margin: "0 auto 24px",
  padding: "18px 18px",
              fontSize: 14,
              borderRadius: 12,
              marginBottom: 18,
            }}
          />

          <button
            onClick={tapToCopy}
            style={{
  width: "calc(100% - 24px)",
  display: "block",
  margin: "0 auto 24px",
  padding: "18px 18px",
                fontSize: 18,
              background: "#0f172a",
              color: "white",
              border: "none",
              borderRadius: 14,
            }}
          >
            Tap to Copy
          </button>
        </div>
      )}
    </main>
  );
}
