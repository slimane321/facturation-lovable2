// ─────────────────────────────────────────────
// Moroccan Invoice Utilities
// ─────────────────────────────────────────────

// ── French number-to-words ────────────────────
const units = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept',
  'dix-huit', 'dix-neuf',
];
const tens = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
  'soixante', 'quatre-vingt', 'quatre-vingt',
];

function belowThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return units[n];
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  if (ten === 7) return 'soixante-' + (unit === 1 ? 'et-onze' : units[10 + unit]);
  if (ten === 9) return 'quatre-vingt-' + (unit === 0 ? 's' : units[unit]);
  const tenStr = tens[ten];
  if (unit === 0) return tenStr;
  if (unit === 1 && ten !== 8) return tenStr + '-et-un';
  return tenStr + '-' + units[unit];
}

function convertFrench(n: number): string {
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  if (n >= 1_000_000) {
    const m = Math.floor(n / 1_000_000);
    parts.push((m === 1 ? 'un' : belowThousand(m)) + ' million' + (m > 1 ? 's' : ''));
    n %= 1_000_000;
  }
  if (n >= 1_000) {
    const k = Math.floor(n / 1_000);
    parts.push((k === 1 ? '' : belowThousand(k) + ' ') + 'mille');
    n %= 1_000;
  }
  if (n >= 100) {
    const h = Math.floor(n / 100);
    parts.push((h === 1 ? 'cent' : units[h] + ' cent') + (n % 100 === 0 && h > 1 ? 's' : ''));
    n %= 100;
  }
  if (n > 0) parts.push(belowThousand(n));
  return parts.filter(Boolean).join(' ');
}

export function amountToFrenchWords(amount: number): string {
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  let result = convertFrench(intPart) + ' dirham' + (intPart > 1 ? 's' : '');
  if (decPart > 0) {
    result += ' et ' + convertFrench(decPart) + ' centime' + (decPart > 1 ? 's' : '');
  }
  // Capitalize
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// ── VAT Rates ────────────────────────────────
export const VAT_RATES = [0, 7, 10, 14, 20] as const;
export type VatRate = typeof VAT_RATES[number];

// ── Invoice number generation ─────────────────
export function generateInvoiceNumber(existingNumbers: string[]): string {
  const year = new Date().getFullYear();
  const prefix = `FA-${year}-`;
  const existing = existingNumbers
    .filter(n => n.startsWith(prefix))
    .map(n => parseInt(n.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

// ── ICE validation (15 digits) ───────────────
export function validateICE(ice: string): boolean {
  return /^\d{15}$/.test(ice.trim());
}

// ── Invoice calculations ──────────────────────
export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: VatRate;
}

export interface InvoiceTotals {
  subtotalHT: number;
  vatBreakdown: { rate: VatRate; base: number; amount: number }[];
  totalTVA: number;
  totalTTC: number;
  timbreAmount?: number;
}

/** Check for gaps in invoice numbering. Returns gap descriptions. */
export function detectInvoiceGaps(invoiceNumbers: string[]): string[] {
  const yearMap = new Map<string, number[]>();
  for (const num of invoiceNumbers) {
    const match = num.match(/^FA-(\d{4})-(\d+)$/);
    if (!match) continue;
    const [, year, seq] = match;
    if (!yearMap.has(year)) yearMap.set(year, []);
    yearMap.get(year)!.push(parseInt(seq, 10));
  }
  const gaps: string[] = [];
  for (const [year, seqs] of yearMap) {
    seqs.sort((a, b) => a - b);
    for (let i = 1; i < seqs.length; i++) {
      if (seqs[i] !== seqs[i - 1] + 1) {
        for (let missing = seqs[i - 1] + 1; missing < seqs[i]; missing++) {
          gaps.push(`FA-${year}-${String(missing).padStart(4, '0')}`);
        }
      }
    }
  }
  return gaps;
}

export interface InvoiceTotalsOptions {
  /** If true and payment is cash, adds 0.25% stamp duty */
  applyTimbre?: boolean;
  paymentMethod?: string;
}

/** Droit de Timbre rate for cash payments */
export const TIMBRE_RATE = 0.0025; // 0.25%

export function calculateTotals(lines: InvoiceLine[], options?: InvoiceTotalsOptions): InvoiceTotals {
  const subtotalHT = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  const vatMap = new Map<VatRate, number>();
  for (const line of lines) {
    const base = line.quantity * line.unitPrice;
    vatMap.set(line.vatRate, (vatMap.get(line.vatRate) || 0) + base);
  }

  const vatBreakdown = Array.from(vatMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, base]) => ({ rate, base, amount: base * rate / 100 }));

  const totalTVA = vatBreakdown.reduce((s, v) => s + v.amount, 0);
  let totalTTC = subtotalHT + totalTVA;

  // Apply Droit de Timbre for cash payments (0.25%)
  let timbreAmount = 0;
  if (options?.applyTimbre && options?.paymentMethod === 'Espèces') {
    timbreAmount = Math.round(totalTTC * TIMBRE_RATE * 100) / 100;
    totalTTC += timbreAmount;
  }

  return { subtotalHT, vatBreakdown, totalTVA, totalTTC, timbreAmount };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' MAD';
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-MA', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

// ── QR Code data string (JSON format per DGI 2026 spec + digital signature) ──
export function buildQRData(params: {
  sellerICE: string;
  invoiceNumber: string;
  date: string;
  totalTTC: number;
  totalTVA: number;
  clientICE?: string;
  signature?: string;
  verificationUrl?: string;
}): string {
  return JSON.stringify({
    ICE_vendeur: params.sellerICE,
    ICE_client: params.clientICE ?? '',
    num_facture: params.invoiceNumber,
    date: params.date,
    total_TTC: params.totalTTC.toFixed(2),
    total_TVA: params.totalTVA.toFixed(2),
    signature: params.signature ?? '',
    verification: params.verificationUrl ?? '',
  });
}
