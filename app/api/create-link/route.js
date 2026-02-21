export const runtime = "nodejs";

function mustGetEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function formatAmount(n) {
  return Number((Math.round(n * 100) / 100).toFixed(2));
}

function safeTrim(v) {
  return typeof v === "string" ? v.trim() : "";
}

function formatExpiryDDMMYYYY(daysFromNow = 7) {
  // Returns dd/MM/yyyy (required by your API error message)
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());

  return `${dd}/${mm}/${yyyy}`;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function getAccessToken(apiBase, apiKey) {
  const url = `${apiBase}/identity/auth/access-token`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.ni-identity.v1+json",
      Authorization: `Basic ${apiKey}`,
    },
  });

  const data = await safeJson(res);

  if (!res.ok) {
    throw new Error(`Access token failed: ${res.status} ${JSON.stringify(data)}`);
  }
  if (!data?.access_token) {
    throw new Error(`No access_token returned: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function createInvoice(apiBase, token, outletRef, payload, contentType) {
  const url = `${apiBase}/invoices/outlets/${outletRef}/invoice`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
      Accept: contentType,
    },
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);
  return { res, data };
}

async function createInvoiceSmart(apiBase, token, outletRef, payload) {
  // Your API accepted vnd.ni-invoice.v1+json (since 422 came back with that)
  // We'll still keep 1-2 fallbacks just in case.
  const contentTypesToTry = [
    "application/vnd.ni-invoice.v1+json",
    "application/vnd.ni-payment.v2+json",
    "application/json",
  ];

  let lastErr = null;

  for (const ct of contentTypesToTry) {
    const { res, data } = await createInvoice(apiBase, token, outletRef, payload, ct);

    if (res.ok) {
      const paymentUrl = data?._links?.payment?.href || data?.payment?.href;
      if (!paymentUrl) {
        throw new Error(`Invoice created but no payment link returned. Response: ${JSON.stringify(data)}`);
      }
      return paymentUrl;
    }

    // If not 415, we should stop guessing and return the real error.
    if (res.status !== 415) {
      throw new Error(`Invoice creation failed (${ct}): ${res.status} ${JSON.stringify(data)}`);
    }

    lastErr = `415 Unsupported Media Type (${ct}): ${JSON.stringify(data)}`;
  }

  throw new Error(lastErr || "Invoice creation failed");
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const description = safeTrim(body.description);
    const amount = Number(body.amount);

    if (!description) {
      return Response.json({ error: "Description is required" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Amount must be a number > 0" }, { status: 400 });
    }

    const apiBase = mustGetEnv("NG_API_BASE");
    const apiKey = mustGetEnv("NG_API_KEY");
    const outletRef = mustGetEnv("NG_OUTLET_REF");

    const currency = process.env.NG_CURRENCY || "AED";

    // Defaults (so you don't have to type customer name every time)
    const firstName = safeTrim(body.firstName) || "AE";
    const lastName = safeTrim(body.lastName) || "Customer";

    // Must be future date in dd/MM/yyyy
    const invoiceExpiryDate =
      safeTrim(body.invoiceExpiryDate) || formatExpiryDDMMYYYY(7);

    const payload = {
      firstName,
      lastName,
      transactionType: "PURCHASE",
      invoiceExpiryDate, // dd/MM/yyyy
      items: [
        {
          description,
          totalPrice: {
            currencyCode: currency,
            value: formatAmount(amount),
          },
          quantity: 1,
        },
      ],
      total: {
        currencyCode: currency,
        value: formatAmount(amount),
      },
      message: description,
    };

    const token = await getAccessToken(apiBase, apiKey);
    const paymentUrl = await createInvoiceSmart(apiBase, token, outletRef, payload);

    return Response.json({ paymentUrl });
  } catch (err) {
    return Response.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
