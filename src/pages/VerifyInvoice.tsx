import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/moroccanUtils";
import { shortFingerprint, shortSignature } from "@/lib/hashUtils";
import { api } from "@/integrations/api/client";

export default function VerifyInvoice() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/public/verify/${encodeURIComponent(id)}`)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) return (<div className="p-6">Document Non Vérifié</div>);
  if (!data) return (<div className="p-6">Chargement…</div>);

  const invoice = data.invoice;
  const client = data.client;
  const issuer = data.issuer;

  const isValid = !!invoice.hash && !!invoice.signature;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">{isValid ? "Document Authentique ✓" : "Document Non Signé"}</h1>

      <div className="rounded-xl border p-4">
        <div><b>Émetteur</b> : {issuer?.name ?? "—"} (ICE {issuer?.ice ?? "—"})</div>
        <div><b>N°</b> : {invoice.number}</div>
        <div><b>Client</b> : {client?.businessName ?? "—"} {client?.ice ? `(ICE ${client.ice})` : ""}</div>
        <div><b>Date</b> : {new Date(invoice.date).toLocaleDateString("fr-MA")}</div>
        <div><b>Total TTC</b> : {formatCurrency(Math.abs(invoice.totalTTC))}</div>
        <div><b>Statut</b> : {invoice.status}</div>
        {invoice.dgiRegistrationNumber && <div><b>N° DGI</b> : {invoice.dgiRegistrationNumber}</div>}
      </div>

      {isValid && (
        <div className="rounded-xl border p-4">
          <div><b>Empreinte</b> : {shortFingerprint(invoice.hash)}</div>
          <div><b>Signature</b> : {shortSignature(invoice.signature)}</div>
        </div>
      )}
    </div>
  );
}