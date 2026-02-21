export const runtime = "nodejs";

function mustGetEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function formatAmount(n) {
  return Number((Math.round(n * 100) / 100).toFixed(2));
}

async function getAccessToken(apiBase, apiKey) {
  const response = await fetch(
    `${apiBase}/identity/auth/access-token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.ni-identity.v1+json",
        Authorization: `Basic ${apiKey}`,
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Access token failed: ${response.status} ${JSON.stringify(data)}`
    );
  }

  if (!data.access_token) {
    throw new Error("No access_token returned from N-Genius");
  }

  return data.access_token;
}

async function createInvoice(apiBase, token, outletRef, currency, description, amount) {
  const url = `${apiBase}/invoices/outlets/${outletRef}/invoice`;

  const body = {
    transactionType: "PURCHASE",
    items: [
      {
        description: description,
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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/vnd.ni-payment.v2+json",
      Accept: "application/vnd.ni-payment.v2+json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Invoice creation failed: ${response.status} ${JSON.stringify(data)}`
    );
  }

  const paymentUrl =
    data?._links?.payment?.href ||
    data?.payment?.href;

  if (!paymentUrl) {
    throw new Error(`No payment link returned. Response: ${JSON.stringify(data)}`);
  }

  return paymentUrl;
}

export async function POST(req) {
  try {
    const { description, amount } = await req.json();

    if (!description || typeof description !== "string") {
      return Response.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return Response.json(
        { error: "Amount must be a number greater than 0" },
        { status: 400 }
      );
    }

    const apiBase = mustGetEnv("NG_API_BASE");
    const apiKey = mustGetEnv("NG_API_KEY");
    const outletRef = mustGetEnv("NG_OUTLET_REF");
    const currency = process.env.NG_CURRENCY || "AED";

    const token = await getAccessToken(apiBase, apiKey);

    const paymentUrl = await createInvoice(
      apiBase,
      token,
      outletRef,
      currency,
      description.trim(),
      numericAmount
    );

    return Response.json({ paymentUrl });
  } catch (err) {
    return Response.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
