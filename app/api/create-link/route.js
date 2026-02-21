export const runtime = "nodejs"; // ensures Node runtime on Vercel

function mustGetEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function to2DecimalsString(n) {
  // N-Genius APIs commonly accept numeric values; we’ll send as a string with 2 decimals
  return (Math.round(n * 100) / 100).toFixed(2);
}

async function getAccessToken({ apiBase, apiKey }) {
  // Identity: POST /identity/auth/access-token
  // Headers (per your screenshot):
  // Content-Type: application/vnd.ni-identity.v1+json
  // Authorization: Basic <your_api_key>
  const url = `${apiBase}/identity/auth/access-token`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.ni-identity.v1+json",
      "Authorization": `Basic ${apiKey}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Access token failed: ${res.status} ${JSON.stringify(data)}`);
  }
  if (!data.access_token) throw new Error("No access_token returned.");
  return data.access_token;
}

async function createInvoice({ apiBase, token, outletRef, currency, description, amount }) {
  // Create invoice endpoint shown in your screenshots:
  // POST /invoices/outlets/{outletRef}/invoice
  const url = `${apiBase}/invoices/outlets/${outletRef}/invoice`;

  const body = {
    // Keep it minimal (email/phone optional)
    transactionType: "PURCHASE",
    // optional: invoiceExpiryDate: "2026-12-31",
    items: [
      {
        description,
        totalPrice: {
          currencyCode: currency,
          value: Number(to2DecimalsString(amount))
        },
        quantity: 1
      }
    ],
    total: {
      currencyCode: currency,
      value: Number(to2DecimalsString(amount))
    },
    message: description
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Invoice creation failed: ${res.status} ${JSON.stringify(data)}`);
  }

  // In your screenshot: _links.payment.href
  const paymentUrl =
    data?._links?.payment?.href ||
    data?.payment?.href; // fallback (some docs show payment.href)

  if (!paymentUrl) throw new Error(`No payment link returned. Response: ${JSON.stringify(data)}`);
  return paymentUrl;
}

export async function POST(req) {
  try {
    const { description, amount } = await req.json();

    if (!description || typeof description !== "string") {
      return Response.json({ error: "Description is required." }, { status: 400 });
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return Response.json({ error: "Amount must be a number > 0." }, { status: 400 });
    }

    const apiBase = mustGetEnv("NG_API_BASE");       // production or sandbox
    const apiKey = mustGetEnv("NG_API_KEY");         // your Service Account API key
    const outletRef = mustGetEnv("NG_OUTLET_REF");   // you said: e96bb156-0232-4418-a5d2-b24c29dee2ee
    const currency = process.env.NG_CURRENCY || "AED";

    const token = await getAccessToken({ apiBase, apiKey });
    const paymentUrl = await createInvoice({
      apiBase,
      token,
      outletRef,
      currency,
      description: description.trim(),
      amount: n
    });

    return Response.json({ paymentUrl });
  } catch (err) {
    return Response.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
