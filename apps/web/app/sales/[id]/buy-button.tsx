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
    return <a href={`/auth/login?returnTo=/sales/${saleId}`}>Sign in to buy</a>;
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

  if (orderStatus === ORDER_STATUSES.CONFIRMED) return <p>Confirmed!</p>;
  if (orderStatus === ORDER_STATUSES.SOLD_OUT) return <p>Sold out</p>;

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
      if (result.errorMessage) setError(result.errorMessage);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement options={{ hidePostalCode: true, disabled: isProcessing }} />
      <button type="submit" disabled={isProcessing || !stripe}>
        {isProcessing ? "Processing…" : "Buy"}
      </button>
      {error && <p>{error}</p>}
      {!isPending && orderStatus === ORDER_STATUSES.FAILED && !error && (
        <p>Payment failed. Please try again with a different card.</p>
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

  if (orderStatus === ORDER_STATUSES.CONFIRMED) return <p>Confirmed!</p>;
  if (orderStatus === ORDER_STATUSES.SOLD_OUT) return <p>Sold out</p>;

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
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={isProcessing}>
        {isProcessing ? "Processing…" : "Buy"}
      </button>
      {!isPending && orderStatus === ORDER_STATUSES.FAILED && <p>Order failed. Please try again.</p>}
      {error && <p>{error}</p>}
    </form>
  );
}
