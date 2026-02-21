export const runtime = "nodejs";

function mustGetEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function safeTrim(v) {
  return typeof v === "string" ? v.trim() : "";
}

function formatAmount(n) {
  return Number((Math.round(n * 100) / 100).toFixed(2));
}

function formatExpiryISO(daysFromNow = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function getAccessToken(apiBase, apiKey) {
  const res = await fetch(`${apiBase}/identity/auth/access-token`, {
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
  // Your responses show application/vnd.ni-invoice.v1+json is correct for your tenant.
  const contentTypesToTry = [
    "application/vnd.ni-invoice.v1+json",
    "application/json",
  ];

  let last415 = null;

  for (const ct of contentTypesToTry) {
    const { res, data } = await createInvoice(apiBase, token, outletRef, payload, ct);

    if (res.ok) {
      const paymentUrl = data?._links?.payment?.href || data?.payment?.href;
      if (!paymentUrl) {
        throw new Error(`Invoice created but no payment link returned. Response: ${JSON.stringify(data)}`);
      }
      return paymentUrl;
    }

    if (res.status !== 415) {
      throw new Error(`Invoice creation failed (${ct}): ${res.status} ${JSON.stringify(data)}`);
    }

    last415 = `415 Unsupported Media Type (${ct}): ${JSON.stringify(data)}`;
  }

  throw new Error(last415 || "Invoice creation failed");
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const description = safeTrim(body.description);
    const amount = Number(body.amount);

    // NEW: require email OR mobileNumber
    const email = safeTrim(body.email);
    const mobileNumber = safeTrim(body.mobileNumber);
    const countryCode = safeTrim(body.countryCode); // e.g. "+971"

    if (!description) {
      return Response.json({ error: "Description is required" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Amount must be a number > 0" }, { status: 400 });
    }

    if (!email && !mobileNumber) {
      return Response.json(
        { error: "Email or mobile number is required" },
        { status: 400 }
      );
    }

    // If user provides mobileNumber, we also need a countryCode (per their portal style)
    if (mobileNumber && !countryCode) {
      return Response.json(
        { error: "countryCode is required when mobileNumber is provided (example: +971)" },
        { status: 400 }
      );
    }

    const apiBase = mustGetEnv("NG_API_BASE");
    const apiKey = mustGetEnv("NG_API_KEY");
    const outletRef = mustGetEnv("NG_OUTLET_REF");
    const currency = process.env.NG_CURRENCY || "AED";

    // Required by your tenant
    const firstName = safeTrim(body.firstName) || "AE";
    const lastName = safeTrim(body.lastName) || "Customer";

    // Expiry date
    const invoiceExpiryDate = safeTrim(body.invoiceExpiryDate) || formatExpiryISO(7);

    // Build payload
    const payload = {
      firstName,
      lastName,
      transactionType: "PURCHASE",
      invoiceExpiryDate,
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

    // Add email/mobile fields only if provided
    if (email) payload.email = email;
    if (mobileNumber) payload.mobileNumber = mobileNumber;
    if (countryCode) payload.countryCode = countryCode;

    const token = await getAccessToken(apiBase, apiKey);
    const paymentUrl = await createInvoiceSmart(apiBase, token, outletRef, payload);

    return Response.json({ paymentUrl });
  } catch (err) {
    return Response.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
