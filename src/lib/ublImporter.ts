// ─────────────────────────────────────────────
// UBL 2.1 XML Invoice Importer
// ─────────────────────────────────────────────
import type { InvoiceLine } from '@/lib/moroccanUtils';

interface ParsedInvoice {
  number: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientICE: string;
  clientIF: string;
  clientAddress: string;
  clientCity: string;
  lines: InvoiceLine[];
  paymentMethod?: string;
  notes?: string;
}

function getTagText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function getAttrText(xml: string, tag: string, attr: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : '';
}

export function parseUBLXml(xmlString: string): ParsedInvoice {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const getText = (parent: Element | Document, tagName: string): string => {
    // Search for tag with or without namespace prefix
    const el = parent.querySelector(tagName) ||
      Array.from(parent.getElementsByTagName('*')).find(e => e.localName === tagName);
    return el?.textContent?.trim() || '';
  };

  const number = getText(doc, 'ID') || 'IMPORT-' + Date.now();
  const date = getText(doc, 'IssueDate') || new Date().toISOString().split('T')[0];
  const dueDate = getText(doc, 'DueDate') || date;

  // Extract buyer info
  const buyerParty = doc.querySelector('AccountingCustomerParty Party') ||
    Array.from(doc.getElementsByTagName('*')).find(e => e.localName === 'AccountingCustomerParty');

  let clientName = '';
  let clientICE = '';
  let clientIF = '';
  let clientAddress = '';
  let clientCity = '';

  if (buyerParty) {
    clientName = getText(buyerParty as Element, 'Name');
    clientAddress = getText(buyerParty as Element, 'StreetName');
    clientCity = getText(buyerParty as Element, 'CityName');

    // Extract ICE/IF from PartyIdentification
    const identifications = buyerParty.querySelectorAll
      ? Array.from(buyerParty.querySelectorAll('PartyIdentification'))
      : [];
    for (const ident of identifications) {
      const idEl = (ident as Element).querySelector('ID');
      if (!idEl) continue;
      const scheme = idEl.getAttribute('schemeID') || '';
      if (scheme === 'ICE') clientICE = idEl.textContent?.trim() || '';
      if (scheme === 'IF') clientIF = idEl.textContent?.trim() || '';
    }
  }

  // Extract lines
  const lineEls = Array.from(doc.getElementsByTagName('*')).filter(
    e => e.localName === 'InvoiceLine' || e.localName === 'CreditNoteLine'
  );

  const lines: InvoiceLine[] = lineEls.map((lineEl, idx) => {
    const qty = parseFloat(getText(lineEl, 'InvoicedQuantity') || getText(lineEl, 'CreditedQuantity') || '1');
    const price = parseFloat(getText(lineEl, 'PriceAmount') || '0');
    const desc = getText(lineEl, 'Description') || `Ligne ${idx + 1}`;
    const vatPercent = parseFloat(getText(lineEl, 'Percent') || '20');

    return {
      id: `imp_l${Date.now()}_${idx}`,
      description: desc,
      quantity: qty,
      unitPrice: price,
      vatRate: vatPercent as any,
    };
  });

  // Fallback: if no lines found, create a single line from totals
  if (lines.length === 0) {
    const totalHT = parseFloat(getText(doc, 'LineExtensionAmount') || '0');
    if (totalHT > 0) {
      lines.push({
        id: `imp_l${Date.now()}`,
        description: 'Importé depuis XML',
        quantity: 1,
        unitPrice: totalHT,
        vatRate: 20,
      });
    }
  }

  return {
    number,
    date,
    dueDate,
    clientName,
    clientICE,
    clientIF,
    clientAddress,
    clientCity,
    lines,
  };
}