// ─────────────────────────────────────────────
// UBL 2.1 XML Invoice Generator (DGI Morocco)
// ─────────────────────────────────────────────
import type { Invoice } from '@/contexts/DataContext';
import type { CompanySettings } from '@/contexts/SettingsContext';
import type { Client } from '@/contexts/DataContext';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Validates that generated XML has no broken tags */
export function validateXml(xml: string): { valid: boolean; error?: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { valid: false, error: parseError.textContent || 'XML parsing error' };
    }
    return { valid: true };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

/** Check if an invoice is eligible for XML generation */
export function canGenerateXml(invoice: Invoice): { allowed: boolean; reason?: string } {
  if (invoice.status === 'draft' || invoice.status === 'pending') {
    return { allowed: false, reason: 'Seules les factures validées peuvent générer un flux XML.' };
  }
  if (!invoice.hash) {
    return { allowed: false, reason: 'La facture doit avoir une empreinte numérique (Hash) pour générer le XML.' };
  }
  if (invoice.number === 'BROUILLON') {
    return { allowed: false, reason: 'La facture doit avoir un numéro officiel attribué.' };
  }
  return { allowed: true };
}

export function generateUBLXml(
  invoice: Invoice,
  client: Client,
  settings: CompanySettings,
): string {
  const isAvoir = invoice.status === 'avoir';
  const docType = isAvoir ? 'CreditNote' : 'Invoice';
  const rootTag = isAvoir ? 'CreditNote' : 'Invoice';
  const currencyID = 'MAD';
  const issueDate = invoice.date;
  const issueTime = new Date(invoice.createdAt || invoice.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dueDate = invoice.dueDate || invoice.date;

  const lines = invoice.lines.map((line, idx) => {
    const lineExt = Math.abs(line.quantity) * line.unitPrice;
    const taxAmount = lineExt * (line.vatRate / 100);
    return `
    <cac:${isAvoir ? 'CreditNoteLine' : 'InvoiceLine'}>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:${isAvoir ? 'CreditedQuantity' : 'InvoicedQuantity'} unitCode="EA">${Math.abs(line.quantity)}</cbc:${isAvoir ? 'CreditedQuantity' : 'InvoicedQuantity'}>
      <cbc:LineExtensionAmount currencyID="${currencyID}">${lineExt.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${currencyID}">${taxAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="${currencyID}">${lineExt.toFixed(2)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="${currencyID}">${taxAmount.toFixed(2)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID>S</cbc:ID>
            <cbc:Percent>${line.vatRate}</cbc:Percent>
            <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Description>${escapeXml(line.description)}</cbc:Description>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currencyID}">${line.unitPrice.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:${isAvoir ? 'CreditNoteLine' : 'InvoiceLine'}>`;
  });

  const vatBreakdown = invoice.totals.vatBreakdown
    .filter(v => v.amount !== 0)
    .map(v => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${currencyID}">${Math.abs(v.base).toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${currencyID}">${Math.abs(v.amount).toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${v.rate}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`)
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${docType}-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">

  <!-- DGI Morocco - Digital Signature Metadata -->
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <dgi:DigitalSignature xmlns:dgi="urn:ma:dgi:efacture:2026">
          <dgi:HashAlgorithm>SHA-256</dgi:HashAlgorithm>
          <dgi:HashValue>${escapeXml(invoice.hash || '')}</dgi:HashValue>
          <dgi:PreviousHashValue>${escapeXml(invoice.previousHash || '')}</dgi:PreviousHashValue>
          <dgi:SignatureAlgorithm>HMAC-SHA256</dgi:SignatureAlgorithm>
          <dgi:SignatureValue>${escapeXml(invoice.signature || '')}</dgi:SignatureValue>
        </dgi:DigitalSignature>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>

  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:ma:dgi:efacture:2026</cbc:CustomizationID>
  <cbc:ProfileID>DGI-MA-${isAvoir ? 'CreditNote' : 'Invoice'}</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.number)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  ${!isAvoir ? `<cbc:DueDate>${dueDate}</cbc:DueDate>` : ''}
  <cbc:${isAvoir ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>${isAvoir ? '381' : '380'}</cbc:${isAvoir ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>
  <cbc:DocumentCurrencyCode>${currencyID}</cbc:DocumentCurrencyCode>

  ${isAvoir && invoice.originalInvoiceId ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escapeXml(invoice.originalInvoiceId)}</cbc:ID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ''}

  <!-- Security Metadata: Hash & Signature as AdditionalDocumentReference -->
  ${invoice.hash ? `
  <cac:AdditionalDocumentReference>
    <cbc:ID>SHA-256-HASH</cbc:ID>
    <cbc:DocumentType>Empreinte Numérique (Art. 210 CGI)</cbc:DocumentType>
    <cbc:DocumentDescription>${escapeXml(invoice.hash)}</cbc:DocumentDescription>
  </cac:AdditionalDocumentReference>` : ''}
  ${invoice.signature ? `
  <cac:AdditionalDocumentReference>
    <cbc:ID>HMAC-SHA256-SIG</cbc:ID>
    <cbc:DocumentType>Signature Numérique</cbc:DocumentType>
    <cbc:DocumentDescription>${escapeXml(invoice.signature)}</cbc:DocumentDescription>
  </cac:AdditionalDocumentReference>` : ''}

  <!-- Seller -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="ICE">${escapeXml(settings.ice)}</cbc:ID></cac:PartyIdentification>
      <cac:PartyIdentification><cbc:ID schemeID="IF">${escapeXml(settings.ifNumber)}</cbc:ID></cac:PartyIdentification>
      ${settings.rc ? `<cac:PartyIdentification><cbc:ID schemeID="RC">${escapeXml(settings.rc)}</cbc:ID></cac:PartyIdentification>` : ''}
      ${settings.patente ? `<cac:PartyIdentification><cbc:ID schemeID="TP">${escapeXml(settings.patente)}</cbc:ID></cac:PartyIdentification>` : ''}
      ${settings.cnss ? `<cac:PartyIdentification><cbc:ID schemeID="CNSS">${escapeXml(settings.cnss)}</cbc:ID></cac:PartyIdentification>` : ''}
      <cac:PartyName><cbc:Name>${escapeXml(settings.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(settings.address)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(settings.city)}</cbc:CityName>
        <cac:Country><cbc:IdentificationCode>MA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:Contact>
        <cbc:Telephone>${escapeXml(settings.tel)}</cbc:Telephone>
        <cbc:ElectronicMail>${escapeXml(settings.email)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Buyer -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${client.ice ? `<cac:PartyIdentification><cbc:ID schemeID="ICE">${escapeXml(client.ice)}</cbc:ID></cac:PartyIdentification>` : ''}
      ${client.ifNumber ? `<cac:PartyIdentification><cbc:ID schemeID="IF">${escapeXml(client.ifNumber)}</cbc:ID></cac:PartyIdentification>` : ''}
      <cac:PartyName><cbc:Name>${escapeXml(client.businessName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(client.address)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(client.city)}</cbc:CityName>
        <cac:Country><cbc:IdentificationCode>MA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingCustomerParty>

  ${invoice.paymentMethod ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${invoice.paymentMethod === 'Virement' ? '30' : invoice.paymentMethod === 'Chèque' ? '20' : invoice.paymentMethod === 'Effet' ? '49' : '10'}</cbc:PaymentMeansCode>
  </cac:PaymentMeans>` : ''}

  <!-- Tax Total -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currencyID}">${Math.abs(invoice.totals.totalTVA).toFixed(2)}</cbc:TaxAmount>
    ${vatBreakdown}
  </cac:TaxTotal>

  <!-- Monetary Totals -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currencyID}">${Math.abs(invoice.totals.subtotalHT).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currencyID}">${Math.abs(invoice.totals.subtotalHT).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currencyID}">${Math.abs(invoice.totals.totalTTC).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currencyID}">${Math.abs(invoice.totals.totalTTC).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- Lines -->
  ${lines.join('')}

</${rootTag}>`;

  return xml;
}

/** Download an XML string as a file */
export function downloadXml(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
