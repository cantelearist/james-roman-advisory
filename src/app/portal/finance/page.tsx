"use client";

import {
  AlertTriangle,
  Bell,
  Check,
  CircleDollarSign,
  Download,
  FilePlus2,
  FileSignature,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { usePortalAccess } from "@/components/portal/access-provider";
import { EmptyState, PageHeader } from "@/components/portal/portal-ui";

type Matter = { id: string; title: string; client_name?: string };
type Payment = { id: string; status: string; amount_cents: string | number; received_at?: string | null; created_at: string };
type Contract = {
  id: string; matter_id: string; matter_title: string; contract_number: string; title: string;
  status: string; original_amount_cents: string | number; issued_at?: string | null; created_at: string;
};
type Invoice = {
  id: string; matter_id: string; matter_title: string; client_name: string;
  invoice_number: string; status: string; total_cents: string | number; due_date?: string | null;
  issued_at?: string | null; paid_at?: string | null; created_at: string;
  line_items: Array<{ id: string; description: string; quantity: number; unit_amount_cents: string | number }>;
  payments: Payment[];
};
type ChangeOrder = {
  id: string; matter_id: string; matter_title: string; change_order_number: string; title: string;
  description: string; status: string; amount_cents: string | number; issued_at?: string | null; created_at: string;
  source_contract_number?: string | null; source_invoice_number?: string | null;
};
type RecordType = "invoice" | "contract" | "change_order";
type Action = { type: RecordType; id: string; action: string; title: string; consequence: string };

function money(value: string | number): string {
  return (Number(value) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function aging(invoice: Invoice): string {
  if (invoice.status === "paid") return "Paid";
  if (!invoice.due_date) return "No due date";
  const days = Math.ceil((new Date(invoice.due_date).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
}

export default function FinancePage() {
  const { can, access } = usePortalAccess();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [matterId, setMatterId] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState<"all" | RecordType>("all");
  const [showCreate, setShowCreate] = useState<RecordType | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState("");
  const [lineItems, setLineItems] = useState([{ description: "", quantity: 1, amount: "" }]);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [matterResponse, contractResponse, invoiceResponse, changeOrderResponse] = await Promise.all([
        fetch("/api/matters?limit=250", { cache: "no-store" }),
        fetch("/api/contracts", { cache: "no-store" }),
        fetch("/api/invoices", { cache: "no-store" }),
        fetch("/api/change-orders", { cache: "no-store" }),
      ]);
      const [matterData, contractData, invoiceData, changeOrderData] = await Promise.all([
        matterResponse.json(), contractResponse.json(), invoiceResponse.json(), changeOrderResponse.json(),
      ]);
      if (!invoiceResponse.ok) throw new Error(invoiceData.error ?? "Finance records could not be loaded.");
      setMatters(matterData.matters ?? []);
      setContracts(contractData.contracts ?? []);
      setInvoices(invoiceData.invoices ?? []);
      setChangeOrders(changeOrderData.changeOrders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Finance records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const records = useMemo(() => {
    const rows = [
      ...invoices.map((record) => ({ ...record, recordType: "invoice" as const, number: record.invoice_number, amount: record.total_cents })),
      ...contracts.map((record) => ({ ...record, recordType: "contract" as const, number: record.contract_number, amount: record.original_amount_cents })),
      ...changeOrders.map((record) => ({ ...record, recordType: "change_order" as const, number: record.change_order_number, amount: record.amount_cents })),
    ];
    return rows.filter((record) => {
      if (type !== "all" && record.recordType !== type) return false;
      if (matterId && record.matter_id !== matterId) return false;
      if (status && record.status !== status) return false;
      if (query && !`${record.number} ${record.matter_title} ${"title" in record ? record.title : ""}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    }).sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());
  }, [changeOrders, contracts, invoices, matterId, query, status, type]);

  const outstanding = invoices.filter((invoice) => ["issued", "processing", "overdue"].includes(invoice.status)).reduce((total, invoice) => total + Number(invoice.total_cents), 0);
  const paid = invoices.filter((invoice) => invoice.status === "paid").reduce((total, invoice) => total + Number(invoice.total_cents), 0);
  const overdue = invoices.filter((invoice) => invoice.status === "overdue" || (invoice.status === "issued" && invoice.due_date && new Date(invoice.due_date).getTime() < now));

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!showCreate) return;
    const form = new FormData(event.currentTarget);
    setBusy("create");
    setError("");
    const issue = form.get("issue") === "on";
    let endpoint = "";
    let payload: Record<string, unknown> = {};
    if (showCreate === "invoice") {
      endpoint = "/api/invoices";
      payload = {
        matterId: form.get("matterId"),
        contractId: form.get("contractId") || null,
        dueDate: form.get("dueDate") || null,
        issue,
        lineItems: lineItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitAmountCents: Math.round(Number(item.amount) * 100),
        })),
      };
    } else if (showCreate === "contract") {
      endpoint = "/api/contracts";
      payload = {
        matterId: form.get("matterId"), title: form.get("title"),
        originalAmountCents: Math.round(Number(form.get("amount")) * 100), issue,
      };
    } else {
      endpoint = "/api/change-orders";
      const source = String(form.get("source") ?? "");
      payload = {
        matterId: form.get("matterId"),
        sourceContractId: source.startsWith("contract:") ? source.slice(9) : null,
        sourceInvoiceId: source.startsWith("invoice:") ? source.slice(8) : null,
        title: form.get("title"), description: form.get("description"),
        amountCents: Math.round(Number(form.get("amount")) * 100), issue,
      };
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "The financial record could not be created.");
    else {
      setShowCreate(null);
      setLineItems([{ description: "", quantity: 1, amount: "" }]);
      setSuccess(issue ? "Record issued and notification queued." : "Draft saved for review.");
      await load();
    }
    setBusy("");
  }

  async function performAction() {
    if (!pendingAction) return;
    setBusy(pendingAction.id);
    setError("");
    const endpoint = pendingAction.type === "invoice" ? `/api/invoices/${pendingAction.id}`
      : pendingAction.type === "contract" ? `/api/contracts/${pendingAction.id}`
      : `/api/change-orders/${pendingAction.id}`;
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: pendingAction.action }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "The action could not be completed.");
    else {
      setSuccess(pendingAction.action === "remind" ? "Payment reminder queued." : "Financial record updated.");
      setPendingAction(null);
      await load();
    }
    setBusy("");
  }

  async function pay(invoice: Invoice) {
    setBusy(invoice.id);
    const response = await fetch(`/api/invoices/${invoice.id}/checkout`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Secure checkout could not be opened.");
    else window.location.href = data.url;
    setBusy("");
  }

  function requestAction(action: Action) {
    setPendingAction(action);
  }

  function canManage(recordType: RecordType): boolean {
    return recordType === "invoice" ? can("finance.manage") : can("contracts.manage");
  }

  return (
    <div className="portal-page">
      <PageHeader
        eyebrow="Contracts and billing"
        title="Finance"
        description={access.role === "client"
          ? "Review issued contracts, invoices, change orders and payment status."
          : "Draft, review, issue and reconcile engagement financial records."}
        actions={
          <>
            <button className="portal-secondary-button" onClick={load}><RefreshCw size={14} />Refresh</button>
            {(can("finance.manage") || can("contracts.manage")) && <button className="portal-primary-button" onClick={() => setShowCreate(can("finance.manage") ? "invoice" : "contract")}><Plus size={15} />New record</button>}
          </>
        }
      />

      <section className="portal-finance-summary">
        <div><CircleDollarSign size={18} /><span><strong>{money(outstanding)}</strong>Outstanding</span></div>
        <div className={overdue.length ? "is-critical" : undefined}><AlertTriangle size={18} /><span><strong>{overdue.length}</strong>Overdue invoices</span></div>
        <div><ShieldCheck size={18} /><span><strong>{money(paid)}</strong>Collected</span></div>
        <div><ReceiptText size={18} /><span><strong>{invoices.filter((invoice) => invoice.status === "draft").length}</strong>Draft invoices</span></div>
      </section>

      <div className="portal-finance-tabs">
        {(["all", "invoice", "contract", "change_order"] as const).map((value) => <button key={value} className={type === value ? "is-active" : undefined} onClick={() => setType(value)}>{value === "all" ? "All records" : value.replace("_", " ")}<span>{value === "all" ? records.length : value === "invoice" ? invoices.length : value === "contract" ? contracts.length : changeOrders.length}</span></button>)}
      </div>

      <div className="portal-board-toolbar">
        <label className="portal-board-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search number, engagement or title" /></label>
        <select className="portal-toolbar-select" value={matterId} onChange={(event) => setMatterId(event.target.value)}><option value="">All engagements</option>{matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.title}</option>)}</select>
        <select className="portal-toolbar-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["draft", "issued", "processing", "paid", "overdue", "accepted", "rejected", "void"].map((item) => <option key={item}>{item}</option>)}</select>
      </div>

      {error && <div className="portal-inline-error" role="alert"><span>{error}</span><button onClick={() => setError("")}><X size={14} /></button></div>}
      {success && <div className="portal-inline-success" role="status"><span>{success}</span><button onClick={() => setSuccess("")}><X size={14} /></button></div>}

      <section className="portal-card portal-finance-table-wrap">
        {loading ? (
          <div className="portal-board-loading">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>
        ) : records.length === 0 ? (
          <EmptyState icon={CircleDollarSign} title="No financial records match this view" description="Draft and issued contracts, invoices and change orders will appear here." />
        ) : (
          <div className="portal-finance-table">
            <div className="portal-finance-row portal-finance-header"><span>Record</span><span>Engagement</span><span>Status</span><span>Amount</span><span>Timing</span><span>Actions</span></div>
            {records.map((record) => (
              <div className="portal-finance-row" key={`${record.recordType}-${record.id}`}>
                <button onClick={() => record.recordType === "invoice" && setSelectedInvoice(invoices.find((invoice) => invoice.id === record.id) ?? null)}>
                  <span className="portal-finance-type">{record.recordType === "invoice" ? <ReceiptText size={15} /> : record.recordType === "contract" ? <FileSignature size={15} /> : <FilePlus2 size={15} />}</span>
                  <div><strong>{record.number}</strong><small>{record.recordType.replace("_", " ")}{"title" in record && record.title ? ` · ${record.title}` : ""}</small></div>
                </button>
                <span>{record.matter_title}</span>
                <span className={`portal-finance-status portal-finance-status-${record.status}`}>{record.status}</span>
                <strong>{money(record.amount)}</strong>
                <span>{record.recordType === "invoice" ? aging(record as Invoice) : formatDate("issued_at" in record ? record.issued_at : null)}</span>
                <div className="portal-finance-actions">
                  {record.recordType === "invoice" && <a href={`/api/invoices/${record.id}/pdf`} target="_blank" rel="noreferrer" className="portal-icon-button" aria-label={`Download ${record.number}`}><Download size={14} /></a>}
                  {record.recordType === "change_order" && <a href={`/api/change-orders/${record.id}/pdf`} target="_blank" rel="noreferrer" className="portal-icon-button" aria-label={`Download ${record.number}`}><Download size={14} /></a>}
                  {canManage(record.recordType) && record.status === "draft" && <button className="portal-secondary-button" onClick={() => requestAction({ type: record.recordType, id: record.id, action: "issue", title: `Issue ${record.number}?`, consequence: "The record becomes client-visible and an email notification will be queued." })}><Send size={12} />Issue</button>}
                  {record.recordType === "invoice" && ["issued", "overdue"].includes(record.status) && (
                    can("finance.manage")
                      ? <button className="portal-secondary-button" onClick={() => requestAction({ type: "invoice", id: record.id, action: "remind", title: `Send reminder for ${record.number}?`, consequence: "A payment reminder will be sent to permitted client recipients." })}><Bell size={12} />Remind</button>
                      : access.role === "client" ? <button className="portal-primary-button" onClick={() => pay(record as Invoice)} disabled={busy === record.id}>Pay securely</button> : null
                  )}
                  {record.recordType === "change_order" && record.status === "issued" && access.role === "client" && <><button className="portal-primary-button" onClick={() => requestAction({ type: "change_order", id: record.id, action: "accept", title: `Accept ${record.number}?`, consequence: "Acceptance is recorded permanently. A supplemental invoice may be created." })}><Check size={12} />Accept</button><button className="portal-secondary-button" onClick={() => requestAction({ type: "change_order", id: record.id, action: "reject", title: `Reject ${record.number}?`, consequence: "The rejection is recorded on this engagement." })}>Reject</button></>}
                  {canManage(record.recordType) && !["paid", "accepted", "void"].includes(record.status) && <button className="portal-icon-button portal-danger-icon" onClick={() => requestAction({ type: record.recordType, id: record.id, action: "void", title: `Void ${record.number}?`, consequence: "The record will remain in the audit history but can no longer be acted upon." })} aria-label={`Void ${record.number}`}><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <div className="portal-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="create-finance-title">
          <button className="portal-command-scrim" onClick={() => setShowCreate(null)} aria-label="Close create form" />
          <section className="portal-dialog portal-finance-dialog">
            <header><div><p className="portal-eyebrow">Financial record</p><h2 id="create-finance-title">Create {showCreate.replace("_", " ")}</h2></div><button className="portal-icon-button" onClick={() => setShowCreate(null)}><X size={18} /></button></header>
            <div className="portal-segmented portal-record-type-switch">
              {(["invoice", "contract", "change_order"] as const).filter((value) => canManage(value)).map((value) => <button key={value} className={showCreate === value ? "is-active" : undefined} onClick={() => setShowCreate(value)}>{value.replace("_", " ")}</button>)}
            </div>
            <form onSubmit={createRecord}>
              <label className="portal-field"><span>Engagement</span><select name="matterId" required defaultValue={matterId}><option value="" disabled>Select engagement</option>{matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.title}{matter.client_name ? ` · ${matter.client_name}` : ""}</option>)}</select></label>
              {showCreate === "invoice" ? (
                <>
                  <div className="portal-line-item-heading"><span>Line items</span><button type="button" onClick={() => setLineItems((items) => [...items, { description: "", quantity: 1, amount: "" }])}><Plus size={12} />Add line</button></div>
                  <div className="portal-line-items">
                    {lineItems.map((item, index) => (
                      <div key={index}>
                        <label className="portal-field"><span>Description</span><input value={item.description} onChange={(event) => setLineItems((items) => items.map((line, lineIndex) => lineIndex === index ? { ...line, description: event.target.value } : line))} required /></label>
                        <label className="portal-field"><span>Qty</span><input type="number" min="1" max="1000" value={item.quantity} onChange={(event) => setLineItems((items) => items.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: Number(event.target.value) } : line))} required /></label>
                        <label className="portal-field"><span>Unit amount</span><input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => setLineItems((items) => items.map((line, lineIndex) => lineIndex === index ? { ...line, amount: event.target.value } : line))} required /></label>
                        <button type="button" className="portal-icon-button" onClick={() => setLineItems((items) => items.length === 1 ? items : items.filter((_, lineIndex) => lineIndex !== index))} aria-label="Remove line item"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="portal-form-grid">
                    <label className="portal-field"><span>Related contract</span><select name="contractId" defaultValue=""><option value="">None</option>{contracts.filter((contract) => !matterId || contract.matter_id === matterId).map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_number} · {contract.title}</option>)}</select></label>
                    <label className="portal-field"><span>Due date</span><input name="dueDate" type="date" /></label>
                  </div>
                  <div className="portal-invoice-total"><span>Invoice total</span><strong>{money(lineItems.reduce((sum, item) => sum + Number(item.quantity) * Math.round(Number(item.amount || 0) * 100), 0))}</strong></div>
                </>
              ) : showCreate === "contract" ? (
                <div className="portal-form-grid">
                  <label className="portal-field portal-field-wide"><span>Contract title</span><input name="title" required /></label>
                  <label className="portal-field"><span>Original amount</span><input name="amount" type="number" min="0" step="0.01" required /></label>
                </div>
              ) : (
                <>
                  <label className="portal-field"><span>Original contract or invoice</span><select name="source" required defaultValue=""><option value="" disabled>Select source record</option>{contracts.map((contract) => <option key={contract.id} value={`contract:${contract.id}`}>{contract.contract_number} · {contract.title}</option>)}{invoices.map((invoice) => <option key={invoice.id} value={`invoice:${invoice.id}`}>{invoice.invoice_number} · {money(invoice.total_cents)}</option>)}</select></label>
                  <label className="portal-field"><span>Change title</span><input name="title" required /></label>
                  <label className="portal-field"><span>Description and justification</span><textarea name="description" rows={5} required /></label>
                  <label className="portal-field"><span>Amount</span><input name="amount" type="number" min="0" step="0.01" required /></label>
                </>
              )}
              <label className="portal-check-field portal-issue-checkbox"><input type="checkbox" name="issue" /><span><strong>Issue immediately</strong><small>Otherwise this record remains a private draft for review.</small></span></label>
              <footer><button type="button" className="portal-secondary-button" onClick={() => setShowCreate(null)}>Cancel</button><button className="portal-primary-button" disabled={busy === "create"}>{busy === "create" ? "Saving…" : "Save record"}</button></footer>
            </form>
          </section>
        </div>
      )}

      {selectedInvoice && (
        <div className="portal-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="invoice-details-title">
          <button className="portal-command-scrim" onClick={() => setSelectedInvoice(null)} aria-label="Close invoice details" />
          <aside className="portal-drawer portal-invoice-drawer">
            <header><div><p className="portal-eyebrow">Invoice record</p><h2 id="invoice-details-title">{selectedInvoice.invoice_number}</h2></div><button className="portal-icon-button" onClick={() => setSelectedInvoice(null)}><X size={18} /></button></header>
            <section className="portal-invoice-overview"><span className={`portal-finance-status portal-finance-status-${selectedInvoice.status}`}>{selectedInvoice.status}</span><strong>{money(selectedInvoice.total_cents)}</strong><p>{selectedInvoice.matter_title} · {selectedInvoice.client_name}</p><small>{aging(selectedInvoice)}</small></section>
            <section className="portal-invoice-lines"><header><span>Description</span><span>Qty</span><span>Amount</span></header>{selectedInvoice.line_items.map((item) => <div key={item.id}><span>{item.description}</span><span>{item.quantity}</span><strong>{money(Number(item.quantity) * Number(item.unit_amount_cents))}</strong></div>)}</section>
            <section className="portal-payment-history"><h3>Payment activity</h3>{selectedInvoice.payments?.length ? selectedInvoice.payments.map((payment) => <div key={payment.id}><span className={`portal-finance-status portal-finance-status-${payment.status}`}>{payment.status}</span><strong>{money(payment.amount_cents)}</strong><time>{formatDate(payment.received_at || payment.created_at)}</time></div>) : <p>No payment attempts recorded.</p>}</section>
            <a className="portal-secondary-button portal-invoice-download" href={`/api/invoices/${selectedInvoice.id}/pdf`} target="_blank" rel="noreferrer"><Download size={14} />Open invoice PDF</a>
          </aside>
        </div>
      )}

      {pendingAction && (
        <div className="portal-dialog-overlay" role="alertdialog" aria-modal="true" aria-labelledby="finance-action-title">
          <button className="portal-command-scrim" onClick={() => setPendingAction(null)} aria-label="Close confirmation" />
          <section className="portal-dialog portal-save-dialog">
            <header><div><p className="portal-eyebrow">Confirm action</p><h2 id="finance-action-title">{pendingAction.title}</h2></div><button className="portal-icon-button" onClick={() => setPendingAction(null)}><X size={18} /></button></header>
            <form onSubmit={(event) => { event.preventDefault(); void performAction(); }}><p className="portal-dialog-copy">{pendingAction.consequence}</p><footer><button type="button" className="portal-secondary-button" onClick={() => setPendingAction(null)}>Cancel</button><button className={pendingAction.action === "void" || pendingAction.action === "reject" ? "portal-danger-button" : "portal-primary-button"} disabled={busy === pendingAction.id}>Confirm {pendingAction.action}</button></footer></form>
          </section>
        </div>
      )}
    </div>
  );
}
