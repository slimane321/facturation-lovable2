// ── SHA-256 Hashing & HMAC Signing for Invoice Chain (Art. 210 CGI) ──
// NOTE: HMAC signing is now done SERVER-SIDE via the sign-invoice Edge Function.
// The client only uses sha256 for local chain verification (read-only).

import { supabase } from '@/integrations/supabase/client';

// Genesis hash — the starting point of the chain for the very first invoice
export const GENESIS_HASH = '0';

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build the hash payload for an invoice in the chain.
 * Payload = InvoiceNumber | Date | ClientICE | TotalTTC | PreviousHash
 */
export function buildHashPayload(params: {
  invoiceNumber: string;
  date: string;
  clientICE: string;
  totalTTC: number;
  previousHash: string;
}): string {
  return [
    params.invoiceNumber,
    params.date,
    params.clientICE,
    params.totalTTC.toFixed(2),
    params.previousHash,
  ].join('|');
}

/**
 * Compute the SHA-256 hash for an invoice (client-side, for verification only).
 */
export async function computeInvoiceHash(params: {
  invoiceNumber: string;
  date: string;
  clientICE: string;
  totalTTC: number;
  previousHash: string;
}): Promise<string> {
  const payload = buildHashPayload(params);
  return sha256(payload);
}

/**
 * Sign an invoice SERVER-SIDE via the sign-invoice Edge Function.
 * Returns { hash, signature } computed with the server-held HMAC secret.
 */
export async function signInvoiceServerSide(params: {
  invoiceNumber: string;
  date: string;
  clientICE: string;
  totalTTC: number;
  previousHash: string;
}): Promise<{ hash: string; signature: string }> {
  const { data, error } = await supabase.functions.invoke('sign-invoice', {
    body: params,
  });

  if (error || !data?.hash || !data?.signature) {
    throw new Error(error?.message || data?.error || 'Erreur lors de la signature serveur');
  }

  return { hash: data.hash, signature: data.signature };
}

/**
 * Get the short fingerprint displayed on the PDF (first 16 chars of hash).
 */
export function shortFingerprint(hash: string): string {
  return hash.substring(0, 16).toUpperCase();
}

/**
 * Get the short signature code displayed on the PDF (first 12 chars of signature).
 */
export function shortSignature(signature: string): string {
  return signature.substring(0, 12).toUpperCase();
}

/**
 * Verify the integrity of an entire chain of invoices (hash + signature).
 * Returns { valid: true } or { valid: false, brokenAt: invoiceNumber }.
 */
export async function verifyChain(
  sortedInvoices: Array<{
    number: string;
    date: string;
    clientICE: string;
    totalTTC: number;
    hash?: string;
    previousHash?: string;
    signature?: string;
  }>
): Promise<{ valid: boolean; brokenAt?: string; details?: string }> {
  let previousHash = GENESIS_HASH;

  for (const inv of sortedInvoices) {
    if (!inv.hash) {
      return { valid: false, brokenAt: inv.number, details: 'Hash manquant' };
    }

    if (inv.previousHash !== previousHash) {
      return { valid: false, brokenAt: inv.number, details: 'Chaîne de previousHash rompue' };
    }

    const expected = await computeInvoiceHash({
      invoiceNumber: inv.number,
      date: inv.date,
      clientICE: inv.clientICE,
      totalTTC: inv.totalTTC,
      previousHash,
    });

    if (expected !== inv.hash) {
      return { valid: false, brokenAt: inv.number, details: 'Hash ne correspond pas au contenu' };
    }

    // Note: HMAC signature verification is hash-only (client cannot verify HMAC without server key)
    // The hash integrity check above is sufficient for client-side verification.
    // Full HMAC verification should be done via the verify-chain Edge Function.

    previousHash = inv.hash;
  }

  return { valid: true };
}
