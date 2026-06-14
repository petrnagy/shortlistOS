declare module "@stripe/stripe-js" {
  export interface RedirectToCheckoutResult {
    error?: Error;
  }

  export interface Stripe {
    redirectToCheckout(options: {
      sessionId: string;
    }): Promise<RedirectToCheckoutResult>;
  }

  export function loadStripe(publishableKey: string): Promise<Stripe | null>;
}
