export const runtime = "nodejs";

function mustGetEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function formatAmount(n) {
  return Number((Math.round(n * 100) / 100).toFixed(2));
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

async function createInvoiceWithContentType({
  apiBase,
  token,
  outletRef,
  currency,
  description,
  amount,
  contentType,
}) {
  const url = `${apiBase}/invoices/outlets/${outletRef}/invoice`;

  const body = {
    transactionType: "PURCHASE",
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

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
      Accept: contentType,
    },
    body: JSON.stringify(body),
  });

  const data = await safeJson(res);

  return { res, data };
}

async function createInvoiceSmart(apiBase, token, outletRef, currency, description, amount) {
  // We try the common N-Genius/Network variants.
  // The goal: automatically avoid the 415 “Unsupported Media Type” loop.
  const contentTypesToTry = [
    "application/vnd.ni-invoice.v1+json",
    "application/vnd.ni-payment.v2+json",
    "application/vnd.ni-payment.v3+json",
    "application/json",
  ];

  let lastError = null;

  for (const ct of contentTypesToTry) {
    const { res, data } = await createInvoiceWithContentType({
      apiBase,
      token,
      outletRef,
      currency,
      description,
      amount,
      contentType: ct,
    });

    if (res.ok) {
      const paymentUrl = data?._links?.payment?.href || data?.payment?.href;
      if (!paymentUrl) {
        throw new Error(`Invoice created but no payment link returned. Response: ${JSON.stringify(data)}`);
      }
      return paymentUrl;
    }

    // If it's NOT 415, don't keep guessing—surface the real error immediately.
    if (res.status !== 415) {
      throw new Error(`Invoice creation failed (${ct}): ${res.status} ${JSON.stringify(data)}`);
    }

    // Save 415 error and try next content type
    lastError = `415 Unsupported Media Type with Content-Type=${ct}: ${JSON.stringify(data)}`;
  }

  throw new Error(lastError || "Invoice creation failed: Unsupported Media Type (415)");
}

export async function POST(req) {
  try {
    const payload = await req.json().catch(() => ({}));
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    const amount = Number(payload.amount);

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

    const token = await getAccessToken(apiBase, apiKey);
    const paymentUrl = await createInvoiceSmart(apiBase, token, outletRef, currency, description, amount);

    return Response.json({ paymentUrl });
  } catch (err) {
    return Response.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
