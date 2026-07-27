"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

import { usePortalAccess } from "@/components/portal/access-provider";

type Matter = { id: string; title: string };
type Contract = {
  id: string; matter_id: string; contract_number: string; title: string;
  status: string; original_amount_cents: string | number;
};
type Invoice = {
  id: string; matter_id: string; invoice_number: string; status: string;
  total_cents: string | number; due_date?: string; line_items: Array<{ description: string }>;
};
type ChangeOrder = {
  id: string; matter_id: string; change_order_number: string; title: string;
  description: string; status: string; amount_cents: string | number;
  source_contract_number?: string; source_invoice_number?: string;
};

const GOLD = "#c9b58a";
const CREAM = "#ece6d6";
const TITAN = "#b2a898";
const CARD = "#0d0f14";

function money(value: string | number) {
  return (Number(value) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function FinancePage() {
  const { can, user } = usePortalAccess();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [matterId, setMatterId] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const loadRecords = useCallback(async (id: string) => {
    if (!id) return;
    const query = `?matter_id=${encodeURIComponent(id)}`;
    const requests: Promise<Response>[] = [
      fetch(`/api/contracts${query}`),
      fetch(`/api/invoices${query}`),
      fetch(`/api/change-orders${query}`),
    ];
    const [contractResponse, invoiceResponse, changeOrderResponse] = await Promise.all(requests);
    const [contractData, invoiceData, changeOrderData] = await Promise.all([
      contractResponse.json(), invoiceResponse.json(), changeOrderResponse.json(),
    ]);
    setContracts(contractData.contracts ?? []);
    setInvoices(invoiceData.invoices ?? []);
    setChangeOrders(changeOrderData.changeOrders ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/matters").then((response) => response.json()).then((data) => {
      const rows = data.matters ?? [];
      setMatters(rows);
      if (rows[0]) setMatterId(rows[0].id);
    });
  }, []);

  useEffect(() => {
    if (!matterId) return;
    const timer = window.setTimeout(() => { void loadRecords(matterId); }, 0);
    return () => window.clearTimeout(timer);
  }, [matterId, loadRecords]);

  async function submitContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy("contract");
    setError("");
    const response = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matterId,
        title: form.get("title"),
        originalAmountCents: Math.round(Number(form.get("amount")) * 100),
        issue: true,
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Contract could not be created.");
    else {
      formElement.reset();
      await loadRecords(matterId);
    }
    setBusy("");
  }

  async function submitInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy("invoice");
    setError("");
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matterId,
        contractId: form.get("contractId") || null,
        dueDate: form.get("dueDate") || null,
        issue: true,
        lineItems: [{
          description: form.get("description"),
          quantity: 1,
          unitAmountCents: Math.round(Number(form.get("amount")) * 100),
        }],
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Invoice could not be created.");
    else {
      formElement.reset();
      await loadRecords(matterId);
    }
    setBusy("");
  }

  async function submitChangeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const source = String(form.get("source"));
    setBusy("change-order");
    setError("");
    const response = await fetch("/api/change-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matterId,
        sourceContractId: source.startsWith("contract:") ? source.slice(9) : null,
        sourceInvoiceId: source.startsWith("invoice:") ? source.slice(8) : null,
        title: form.get("title"),
        description: form.get("description"),
        amountCents: Math.round(Number(form.get("amount")) * 100),
        issue: true,
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Change order could not be created.");
    else {
      formElement.reset();
      await loadRecords(matterId);
    }
    setBusy("");
  }

  async function pay(invoiceId: string) {
    setBusy(invoiceId);
    const response = await fetch(`/api/invoices/${invoiceId}/checkout`, { method: "POST" });
    const result = await response.json();
    if (response.ok && result.url) window.location.assign(result.url);
    else {
      setError(result.error ?? "Checkout could not be opened.");
      setBusy("");
    }
  }

  async function decide(changeOrderId: string, action: "accept" | "reject") {
    setBusy(changeOrderId);
    const response = await fetch(`/api/change-orders/${changeOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Decision could not be recorded.");
    await loadRecords(matterId);
    setBusy("");
  }

  return (
    <main className="min-h-screen bg-[#0a0b0e] px-6 py-10 text-[#ece6d6]">
      <div className="mx-auto max-w-6xl">
        <Link href="/portal" className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#b2a898] opacity-60"><ArrowLeft size={12} /> Private Office</Link>
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-[0.65rem] uppercase tracking-[0.3em]" style={{ color: GOLD }}>Engagement finance</p>
            <h1 className="font-heading text-3xl font-light">Contracts, invoices and change orders</h1>
          </div>
          <select value={matterId} onChange={(event) => setMatterId(event.target.value)} className="min-w-64 border border-[#c9b58a]/20 bg-[#0d0f14] px-3 py-3 text-sm text-[#ece6d6]">
            {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.title}</option>)}
          </select>
        </div>
        {error && <p className="mb-6 border border-red-400/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</p>}

        {can("contracts.manage") && (
          <section className="mb-9 grid gap-4 lg:grid-cols-3">
            <form onSubmit={submitContract} className="space-y-3 border p-5" style={{ borderColor: "rgba(201,181,138,.12)", background: CARD }}>
              <h2 className="text-xs uppercase tracking-[0.2em]" style={{ color: GOLD }}>Issue contract record</h2>
              <input name="title" required maxLength={200} placeholder="Contract title" className="w-full border border-[#c9b58a]/15 bg-transparent px-3 py-2 text-sm" />
              <input name="amount" required min="0" step="0.01" type="number" placeholder="Original fee" className="w-full border border-[#c9b58a]/15 bg-transparent px-3 py-2 text-sm" />
              <button disabled={busy === "contract"} className="text-xs uppercase tracking-[0.16em]" style={{ color: GOLD }}>{busy === "contract" ? "Issuing…" : "Issue contract"}</button>
            </form>
            <form onSubmit={submitInvoice} className="space-y-3 border p-5" style={{ borderColor: "rgba(201,181,138,.12)", background: CARD }}>
              <h2 className="text-xs uppercase tracking-[0.2em]" style={{ color: GOLD }}>Issue invoice</h2>
              <input name="description" required maxLength={500} placeholder="Line item" className="w-full border border-[#c9b58a]/15 bg-transparent px-3 py-2 text-sm" />
              <input name="amount" required min="0" step="0.01" type="number" placeholder="Amount" className="w-full border border-[#c9b58a]/15 bg-transparent px-3 py-2 text-sm" />
              <input name="dueDate" type="date" className="w-full border border-[#c9b58a]/15 bg-transparent px-3 py-2 text-sm" />
              <select name="contractId" className="w-full border border-[#c9b58a]/15 bg-[#0d0f14] px-3 py-2 text-sm"><option value="">No contract link</option>{contracts.map((item) => <option key={item.id} value={item.id}>{item.contract_number}</option>)}</select>
              <button disabled={busy === "invoice"} className="text-xs uppercase tracking-[0.16em]" style={{ color: GOLD }}>{busy === "invoice" ? "Issuing…" : "Issue invoice"}</button>
            </form>
            <form onSubmit={submitChangeOrder} className="space-y-3 border p-5" style={{ borderColor: "rgba(201,181,138,.12)", background: CARD }}>
              <h2 className="text-xs uppercase tracking-[0.2em]" style={{ color: GOLD }}>Issue change order</h2>
              <select name="source" required className="w-full border border-[#c9b58a]/15 bg-[#0d0f14] px-3 py-2 text-sm">
                <option value="">Original record</option>
                {contracts.map((item) => <option key={item.id} value={`contract:${item.id}`}>{item.contract_number}</option>)}
                {invoices.map((item) => <option key={item.id} value={`invoice:${item.id}`}>{item.invoice_number}</option>)}
              </select>
              <input name="title" required maxLength={200} placeholder="Change title" className="w-full border border-[#c9b58a]/15 bg-transparent px-3 py-2 text-sm" />
              <textarea name="description" required maxLength={10000} placeholder="Scope and reason" rows={2} className="w-full border border-[#c9b58a]/15 bg-transparent px-3 py-2 text-sm" />
              <input name="amount" required min="0" step="0.01" type="number" placeholder="Fee adjustment" className="w-full border border-[#c9b58a]/15 bg-transparent px-3 py-2 text-sm" />
              <button disabled={busy === "change-order"} className="text-xs uppercase tracking-[0.16em]" style={{ color: GOLD }}>{busy === "change-order" ? "Issuing…" : "Issue change order"}</button>
            </form>
          </section>
        )}

        <div className="grid gap-7 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.22em]" style={{ color: TITAN }}>Invoices</h2>
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <article key={invoice.id} className="border p-5" style={{ borderColor: "rgba(201,181,138,.12)", background: CARD }}>
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-sm">{invoice.invoice_number}</p><p className="mt-1 text-xs uppercase tracking-[0.16em]" style={{ color: TITAN }}>{invoice.status}</p></div>
                    <p className="font-heading text-xl" style={{ color: CREAM }}>{money(invoice.total_cents)}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" className="flex items-center gap-1 text-xs uppercase tracking-[0.14em]" style={{ color: GOLD }}><Download size={11} /> PDF</a>
                    {["issued", "overdue"].includes(invoice.status) && (
                      <button onClick={() => pay(invoice.id)} disabled={busy === invoice.id} className="text-xs uppercase tracking-[0.14em]" style={{ color: GOLD }}>{busy === invoice.id ? <Loader2 size={12} className="animate-spin" /> : "Pay securely"}</button>
                    )}
                  </div>
                </article>
              ))}
              {invoices.length === 0 && <p className="border p-6 text-sm" style={{ borderColor: "rgba(201,181,138,.1)", color: TITAN }}>No invoices in this engagement.</p>}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.22em]" style={{ color: TITAN }}>Change orders</h2>
            <div className="space-y-3">
              {changeOrders.map((item) => (
                <article key={item.id} className="border p-5" style={{ borderColor: "rgba(201,181,138,.12)", background: CARD }}>
                  <div className="flex items-start justify-between gap-4"><div><p className="text-sm">{item.change_order_number}</p><p className="mt-1 text-xs uppercase tracking-[0.16em]" style={{ color: TITAN }}>{item.status}</p></div><p className="font-heading text-xl">{money(item.amount_cents)}</p></div>
                  <h3 className="mt-4 text-sm" style={{ color: GOLD }}>{item.title}</h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: TITAN }}>{item.description}</p>
                  <div className="mt-4 flex gap-4">
                    <a href={`/api/change-orders/${item.id}/pdf`} target="_blank" className="flex items-center gap-1 text-xs uppercase tracking-[0.14em]" style={{ color: GOLD }}><Download size={11} /> PDF</a>
                    {user.role === "client" && item.status === "issued" && <>
                      <button onClick={() => decide(item.id, "accept")} className="text-xs uppercase tracking-[0.14em] text-emerald-300">Accept</button>
                      <button onClick={() => decide(item.id, "reject")} className="text-xs uppercase tracking-[0.14em] text-red-300">Reject</button>
                    </>}
                  </div>
                </article>
              ))}
              {changeOrders.length === 0 && <p className="border p-6 text-sm" style={{ borderColor: "rgba(201,181,138,.1)", color: TITAN }}>No change orders in this engagement.</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
