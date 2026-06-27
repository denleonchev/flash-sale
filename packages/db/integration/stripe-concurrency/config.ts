import Stripe from "stripe";

export interface RunConfig {
  stock: number;
  buyers: number;
  apiUrl: string;
  stripe: Stripe;
  stripeWebhookSecret: string;
}

export function loadRunConfig(): RunConfig {
  const stock = parseInt(process.env["CONCURRENCY_STOCK"] ?? "5", 10);
  const buyers = parseInt(process.env["CONCURRENCY_BUYERS"] ?? "50", 10);

  if (buyers <= stock) throw new Error("CONCURRENCY_BUYERS must exceed CONCURRENCY_STOCK");

  const stripeSecretKey = process.env["STRIPE_SECRET_KEY"];
  if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is required");

  const stripeWebhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!stripeWebhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is required");

  return {
    stock,
    buyers,
    apiUrl: process.env["API_URL"] ?? "http://localhost:3001",
    stripe: new Stripe(stripeSecretKey),
    stripeWebhookSecret,
  };
}
