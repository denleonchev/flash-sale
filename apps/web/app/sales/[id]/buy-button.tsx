"use client";

import { useEffect, useState, useTransition } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { buyAction, type BuyState } from "./actions";
import { ORDER_STATUSES, type OrderStatus } from "@flash-sale/shared";

type Props = {
  saleId: string;
  signedIn: boolean;
  orderStatus: OrderStatus | null;
};

/**
 * Buy button with Stripe Elements card form (FR-12) when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 * is set, or a simple buy button otherwise (FR-11 backward compat).
 *
 * stripePromise is initialised in useEffect (client-only) to avoid SSR/hydration
 * mismatches — loadStripe loads Stripe.js from CDN which only works in the browser.
 *
 * orderStatus is the buyer's own order result from Socket.IO (FR-18, FR-19).
 * States:
 *  - confirmed / sold_out  → terminal message.
 *  - in_progress           → "Processing…" (durable socket state, FR-19).
 *  - failed                → form re-enabled so the buyer can retry with another card.
 *  - idle                  → buy form (with card field or simple button).
 */
export function BuyButton({ saleId, signedIn, orderStatus }: Props) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (key) setStripePromise(loadStripe(key));
  }, []);

  // FR-6: signed-out buyers are asked to sign in; no order can be placed.
  if (!signedIn) {
    return (
      <a
        href={`/auth/login?returnTo=/sales/${saleId}`}
        className="flex w-full items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-semibold py-3 transition-colors"
      >
        Sign in to buy
      </a>
    );
  }

  if (stripePromise) {
    return (
      <Elements stripe={stripePromise}>
        <StripeBuyForm saleId={saleId} orderStatus={orderStatus} />
      </Elements>
    );
  }

  return <SimpleBuyForm saleId={saleId} orderStatus={orderStatus} />;
}

function CopyCardButton({ label, number }: { label: string; number: string }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    await navigator.clipboard.writeText(number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex-1 py-1.5 rounded-md border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

function StripeBuyForm({
  saleId,
  orderStatus,
}: {
  saleId: string;
  orderStatus: OrderStatus | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (orderStatus === ORDER_STATUSES.CONFIRMED) {
    return <p className="text-center text-emerald-400 font-semibold py-2">✓ Order confirmed!</p>;
  }
  if (orderStatus === ORDER_STATUSES.SOLD_OUT) {
    return <p className="text-center text-zinc-400 py-2">Sold out</p>;
  }

  const isProcessing = isPending || orderStatus === ORDER_STATUSES.IN_PROGRESS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || isProcessing) return;
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
    });

    if (pmError) {
      setError(pmError.message ?? "Card error");
      return;
    }

    startTransition(async () => {
      const result: BuyState = await buyAction(saleId, paymentMethod.id);
      if (result.errorMessage) {
        setError(result.errorMessage);
        return;
      }

      if (result.clientSecret) {
        // Authorize/capture: confirm the PI in the browser — handles 3DS if needed.
        // On success, Stripe fires amount_capturable_updated → worker captures.
        const { error: confirmError } = await stripe.confirmCardPayment(result.clientSecret);
        if (confirmError) setError(confirmError.message ?? "Payment failed");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <CopyCardButton label="Copy success card" number="4242424242424242" />
        <CopyCardButton label="Copy fail card" number="4000000000000002" />
      </div>
      <div className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-3">
        <CardElement
          options={{
            hidePostalCode: true,
            disabled: isProcessing,
            style: {
              base: {
                color: "#fafafa",
                fontFamily: "inherit",
                fontSize: "14px",
                "::placeholder": { color: "#71717a" },
              },
            },
          }}
        />
      </div>
      <button
        type="submit"
        disabled={isProcessing || !stripe}
        className="w-full py-3 rounded-md bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold transition-colors"
      >
        {isProcessing ? "Processing…" : "Buy now"}
      </button>
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      {!isPending && orderStatus === ORDER_STATUSES.FAILED && !error && (
        <p className="text-red-400 text-sm text-center">
          Payment failed. Please try again with a different card.
        </p>
      )}
    </form>
  );
}

function SimpleBuyForm({
  saleId,
  orderStatus,
}: {
  saleId: string;
  orderStatus: OrderStatus | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (orderStatus === ORDER_STATUSES.CONFIRMED) {
    return <p className="text-center text-emerald-400 font-semibold py-2">✓ Order confirmed!</p>;
  }
  if (orderStatus === ORDER_STATUSES.SOLD_OUT) {
    return <p className="text-center text-zinc-400 py-2">Sold out</p>;
  }

  const isProcessing = isPending || orderStatus === ORDER_STATUSES.IN_PROGRESS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setError(null);
    startTransition(async () => {
      const result: BuyState = await buyAction(saleId);
      if (result.errorMessage) setError(result.errorMessage);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <button
        type="submit"
        disabled={isProcessing}
        className="w-full py-3 rounded-md bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold transition-colors"
      >
        {isProcessing ? "Processing…" : "Buy now"}
      </button>
      {!isPending && orderStatus === ORDER_STATUSES.FAILED && (
        <p className="text-red-400 text-sm text-center">Order failed. Please try again.</p>
      )}
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </form>
  );
}
