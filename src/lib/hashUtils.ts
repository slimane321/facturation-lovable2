import { api } from "@/integrations/api/client";

export const GENESIS_HASH = "0";

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

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
  ].join("|");
}

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

export async function signInvoiceServerSide(params: {
  invoiceNumber: string;
  date: string;
  clientICE: string;
  totalTTC: number;
  previousHash: string;
}): Promise<{ hash: string; signature: string }> {
  return api.post<{ hash: string; signature: string }>("/crypto/sign-invoice", params);
}

export function shortFingerprint(hash: string): string {
  return hash.substring(0, 16).toUpperCase();
}

export function shortSignature(signature: string): string {
  return signature.substring(0, 12).toUpperCase();
}
// ─────────────────────────────────────────────────────────────
// Chain verification used by Dashboard
// ─────────────────────────────────────────────────────────────

export type ChainItem = {
  number: string;
  date: string;
  clientICE: string;
  totalTTC: number;
  hash?: string;
  previousHash?: string;
  signature?: string; // can't be verified client-side (HMAC secret server-side), but we can require presence if you want
};

export async function verifyChain(items: ChainItem[]): Promise<{
  valid: boolean;
  brokenAt?: number;   // index of the first broken item
  reason?: string;     // human-readable reason
}> {
  // Keep only sealed items
  const sealed = items.filter(i => !!i.hash);

  if (sealed.length === 0) return { valid: true };

  // Optional: ensure stable order (Dashboard already sorts, but this makes it robust)
  const sorted = [...sealed].sort((a, b) => a.number.localeCompare(b.number));

  // First item: previousHash should normally be GENESIS_HASH ("0") or empty/undefined
  const firstPrev = sorted[0].previousHash ?? "";
  if (!(firstPrev === GENESIS_HASH || firstPrev === "")) {
    return { valid: false, brokenAt: 0, reason: "Premier maillon: previousHash inattendu (doit être GENESIS_HASH ou vide)." };
  }

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];

    // 1) Recompute hash from fields (strong check)
    const expectedHash = await computeInvoiceHash({
      invoiceNumber: cur.number,
      date: cur.date,
      clientICE: cur.clientICE ?? "",
      totalTTC: cur.totalTTC,
      previousHash: cur.previousHash ?? (i === 0 ? GENESIS_HASH : sorted[i - 1].hash!),
    });

    if ((cur.hash ?? "").toLowerCase() !== expectedHash.toLowerCase()) {
      return { valid: false, brokenAt: i, reason: "Hash invalide: le contenu ne correspond pas à l'empreinte." };
    }

    // 2) Verify chaining: previousHash must match previous invoice hash
    if (i > 0) {
      const prevHash = sorted[i - 1].hash!;
      const curPrev = cur.previousHash ?? "";
      if (curPrev.toLowerCase() !== prevHash.toLowerCase()) {
        return { valid: false, brokenAt: i, reason: "Chaînage cassé: previousHash ≠ hash précédent." };
      }
    }
  }

  return { valid: true };
}