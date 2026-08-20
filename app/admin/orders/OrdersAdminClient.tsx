"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { money } from "@/lib/orderCatalog";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { OrderCatalogItem, SchoolOrder } from "@/lib/types";

const statuses = ["submitted", "processing", "ordered", "ready", "returned", "completed", "cancelled"];
const paymentStatuses = ["outstanding", "paid"];
const emptyOrderFilters = { search: "", status: "", order_type: "", payment_status: "" };

const catalogGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "14px",
};

const catalogCardStyle: CSSProperties = {
  display: "grid",
  gap: "14px",
  alignItems: "stretch",
  padding: "16px",
  background: "#ffffff",
  border: "2px solid #d9dee7",
  borderRadius: "8px",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.08)",
};

const catalogPriceStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  padding: "12px",
  background: "#f8fafc",
  border: "1px solid #d9dee7",
  borderRadius: "8px",
};

const catalogChipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  margin: 0,
};

const catalogChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  padding: "0 8px",
  background: "#f8fafc",
  border: "1px solid #d9dee7",
  borderRadius: "999px",
  color: "#475569",
  fontSize: "12px",
  fontWeight: 800,
};

const emptyCatalogItem = {
  id: "",
  section: "",
  item: "",
  size: "",
  instructor_price: "",
  student_price: "",
  currency: "ZAR",
  note: "",
  special_order: false,
  in_stock: true,
  active: true,
  sort_order: "999",
};

export default function OrdersAdminClient() {
  const [token, setToken] = useState("");
  const [orders, setOrders] = useState<SchoolOrder[]>([]);
  const [catalog, setCatalog] = useState<OrderCatalogItem[]>([]);
  const [catalogForm, setCatalogForm] = useState(emptyCatalogItem);
  const [editingCatalogId, setEditingCatalogId] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [discountDrafts, setDiscountDrafts] = useState<Record<string, string>>({});
  const [discountNoteDrafts, setDiscountNoteDrafts] = useState<Record<string, string>>({});
  const [itemDrafts, setItemDrafts] = useState<Record<string, Record<string, { quantity: string; instructor_price: string }>>>({});
  const [filters, setFilters] = useState(emptyOrderFilters);
  const [pagination, setPagination] = useState({ page: 1, page_size: 25, total: 0, has_more: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadOrders(activeToken: string, page = 1, append = false, activeFilters = filters) {
    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("page_size", "25");
    if (activeFilters.search) query.set("search", activeFilters.search);
    if (activeFilters.status) query.set("status", activeFilters.status);
    if (activeFilters.order_type) query.set("order_type", activeFilters.order_type);
    if (activeFilters.payment_status) query.set("payment_status", activeFilters.payment_status);
    const [ordersResponse, catalogResponse] = await Promise.all([
      fetch(`/api/admin/orders?${query.toString()}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      }),
      fetch("/api/admin/order-catalog", {
        headers: { Authorization: `Bearer ${activeToken}` },
      }),
    ]);
    const [payload, catalogPayload] = await Promise.all([ordersResponse.json(), catalogResponse.json()]);

    if (!ordersResponse.ok) {
      setError(payload.error ?? "Unable to load orders.");
      return;
    }

    if (!catalogResponse.ok) {
      setError(catalogPayload.error ?? "Unable to load catalogue.");
      return;
    }

    setOrders((current) => (append ? [...current, ...payload.orders] : payload.orders));
    setPagination(payload.pagination ?? { page, page_size: 25, total: payload.orders.length, has_more: false });
    setCatalog(catalogPayload.items);
    setStatusDrafts(
      Object.fromEntries(payload.orders.map((order: SchoolOrder) => [order.id, order.status])),
    );
    setPaymentDrafts(
      Object.fromEntries(payload.orders.map((order: SchoolOrder) => [order.id, order.payment_status])),
    );
    setNoteDrafts(
      Object.fromEntries(payload.orders.map((order: SchoolOrder) => [order.id, order.admin_notes ?? ""])),
    );
    setDiscountDrafts(
      Object.fromEntries(payload.orders.map((order: SchoolOrder) => [order.id, String(order.discount_zar ?? 0)])),
    );
    setDiscountNoteDrafts(
      Object.fromEntries(payload.orders.map((order: SchoolOrder) => [order.id, order.discount_note ?? ""])),
    );
    setItemDrafts(
      Object.fromEntries(
        payload.orders.map((order: SchoolOrder) => [
          order.id,
          Object.fromEntries(
            (order.school_order_items ?? []).map((item) => [
              item.id,
              {
                quantity: String(item.quantity),
                instructor_price: String(item.instructor_price ?? 0),
              },
            ]),
          ),
        ]),
      ),
    );
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/admin/orders";
        return;
      }

      setToken(activeToken);
      await loadOrders(activeToken);
    }

    loadSession();
    // The initial session load should run once; filters reload through the page controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateOrder(orderId: string) {
    setBusy(true);
    setError("");
    const order = orders.find((item) => item.id === orderId);
    const canAdjustPrices = !order?.invoice_id;

    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: statusDrafts[orderId],
        payment_status: paymentDrafts[orderId],
        admin_notes: noteDrafts[orderId],
        discount_zar: discountDrafts[orderId],
        discount_note: discountNoteDrafts[orderId],
        items: canAdjustPrices
          ? Object.entries(itemDrafts[orderId] ?? {}).map(([id, item]) => ({
              id,
              quantity: item.quantity,
              instructor_price: item.instructor_price,
            }))
          : [],
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to update order.");
      return;
    }

    await loadOrders(token);
  }

  function updateCatalogField(field: keyof typeof emptyCatalogItem, value: string | boolean) {
    setCatalogForm((current) => ({ ...current, [field]: value }));
  }

  function updateFilter(field: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function updateItemDraft(orderId: string, itemId: string, field: "quantity" | "instructor_price", value: string) {
    setItemDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? {}),
        [itemId]: {
          quantity: current[orderId]?.[itemId]?.quantity ?? "0",
          instructor_price: current[orderId]?.[itemId]?.instructor_price ?? "0",
          [field]: value,
        },
      },
    }));
  }

  function draftOrderTotal(order: SchoolOrder) {
    const lineTotals = (order.school_order_items ?? []).reduce(
      (totals, item) => {
        const draft = itemDrafts[order.id]?.[item.id];
        const quantity = Number(draft?.quantity ?? item.quantity) || 0;
        const price = Number(draft?.instructor_price ?? item.instructor_price ?? 0) || 0;
        const lineTotal = quantity * price;
        if (item.currency === "USD") totals.usd += lineTotal;
        else totals.zar += lineTotal;
        return totals;
      },
      { zar: 0, usd: 0 },
    );
    return {
      zar: Math.max(0, lineTotals.zar - (Number(discountDrafts[order.id] ?? order.discount_zar ?? 0) || 0)),
      usd: lineTotals.usd,
    };
  }

  function editCatalogItem(item: OrderCatalogItem) {
    setEditingCatalogId(item.id);
    setCatalogForm({
      id: item.id,
      section: item.section,
      item: item.item,
      size: item.size ?? "",
      instructor_price: item.instructor_price?.toString() ?? "",
      student_price: item.student_price?.toString() ?? "",
      currency: item.currency,
      note: item.note ?? "",
      special_order: item.special_order,
      in_stock: item.in_stock,
      active: item.active,
      sort_order: item.sort_order.toString(),
    });
  }

  function resetCatalogForm() {
    setEditingCatalogId("");
    setCatalogForm(emptyCatalogItem);
  }

  async function saveCatalogItem() {
    setBusy(true);
    setError("");

    const response = await fetch(editingCatalogId ? `/api/admin/order-catalog/${editingCatalogId}` : "/api/admin/order-catalog", {
      method: editingCatalogId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(catalogForm),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save catalogue item.");
      return;
    }

    resetCatalogForm();
    await loadOrders(token);
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Admin</p>
          <h1>Orders</h1>
          <p className="muted">Process submitted school uniform, gear, patch, and belt orders.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}

      <section className="section-title">
        <h2>Catalogue</h2>
        <p>Update prices, mark products out of stock, or add new order items.</p>
      </section>
      <section className="admin-workspace">
        <form className="admin-form" onSubmit={(event) => { event.preventDefault(); saveCatalogItem(); }}>
          <h2>{editingCatalogId ? "Edit item" : "Add item"}</h2>
          {!editingCatalogId ? <label>Item code<input value={catalogForm.id} onChange={(event) => updateCatalogField("id", event.target.value)} placeholder="auto if blank" /></label> : null}
          <label>Category<input value={catalogForm.section} onChange={(event) => updateCatalogField("section", event.target.value)} required /></label>
          <label>Item<input value={catalogForm.item} onChange={(event) => updateCatalogField("item", event.target.value)} required /></label>
          <label>Size<input value={catalogForm.size} onChange={(event) => updateCatalogField("size", event.target.value)} /></label>
          <label>Actual item price<input min="0" step="0.01" type="number" value={catalogForm.instructor_price} onChange={(event) => updateCatalogField("instructor_price", event.target.value)} /></label>
          <label>Recommended selling price<input min="0" step="0.01" type="number" value={catalogForm.student_price} onChange={(event) => updateCatalogField("student_price", event.target.value)} /></label>
          <label>Currency<select value={catalogForm.currency} onChange={(event) => updateCatalogField("currency", event.target.value)}><option value="ZAR">ZAR</option><option value="USD">USD</option></select></label>
          <label>Sort order<input type="number" value={catalogForm.sort_order} onChange={(event) => updateCatalogField("sort_order", event.target.value)} /></label>
          <label>Note<input value={catalogForm.note} onChange={(event) => updateCatalogField("note", event.target.value)} /></label>
          <label className="checkbox-label"><input checked={catalogForm.in_stock} onChange={(event) => updateCatalogField("in_stock", event.target.checked)} type="checkbox" /> In stock</label>
          <label className="checkbox-label"><input checked={catalogForm.special_order} onChange={(event) => updateCatalogField("special_order", event.target.checked)} type="checkbox" /> Special order</label>
          <label className="checkbox-label"><input checked={catalogForm.active} onChange={(event) => updateCatalogField("active", event.target.checked)} type="checkbox" /> Active</label>
          <div className="row-actions">
            <button className="primary-button compact" disabled={busy} type="submit">{editingCatalogId ? "Save item" : "Add item"}</button>
            {editingCatalogId ? <button className="secondary-button compact" onClick={resetCatalogForm} type="button">Cancel</button> : null}
          </div>
        </form>

        <section className="catalog-admin-list catalog-card-grid" style={catalogGridStyle}>
          {catalog.map((item) => (
            <article
              className={`catalog-admin-card ${!item.in_stock ? "out-of-stock" : ""}`}
              key={item.id}
              style={{ ...catalogCardStyle, opacity: item.in_stock ? 1 : 0.7 }}
            >
              <div className="catalog-item-main">
                <h2 style={{ margin: 0, fontSize: "18px" }}>{item.item}</h2>
                <p style={catalogChipRowStyle}>
                  <span style={catalogChipStyle}>{item.section}</span>
                  {item.size ? <span style={catalogChipStyle}>{item.size}</span> : null}
                  {item.special_order ? <span style={catalogChipStyle}>Special order</span> : null}
                </p>
                {item.note ? <p>{item.note}</p> : null}
              </div>
              <div className="catalog-price-card" style={catalogPriceStyle}>
                <strong>{money(item.instructor_price ?? undefined, item.currency)}</strong>
                <span>Actual item price</span>
              </div>
              <div className="catalog-price-card" style={catalogPriceStyle}>
                <strong>{item.student_price ? money(item.student_price, item.currency) : "-"}</strong>
                <span>Recommended selling</span>
              </div>
              <div className="catalog-stock-cell">
                <span className={`status-pill status-${item.in_stock ? "active" : "suspended"}`}>{item.in_stock ? "in stock" : "out of stock"}</span>
                {!item.active ? <span className="status-pill status-expired">inactive</span> : null}
              </div>
              <div className="row-actions">
                <button className="secondary-button compact" onClick={() => editCatalogItem(item)} type="button">Edit</button>
              </div>
            </article>
          ))}
        </section>
      </section>

      <section className="section-title">
        <h2>Submitted orders</h2>
        <p>Update each order as it moves through processing.</p>
      </section>
      <section className="content-shell table-list">
        <div className="admin-form">
          <h2>Find orders</h2>
          <label>Search<input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Contact name or email" /></label>
          <label>Status<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <label>Order type<select value={filters.order_type} onChange={(event) => updateFilter("order_type", event.target.value)}><option value="">All types</option><option value="purchase">Purchase</option><option value="consignment">Consignment for sizing</option></select></label>
          <label>Payment<select value={filters.payment_status} onChange={(event) => updateFilter("payment_status", event.target.value)}><option value="">All payment statuses</option>{paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <div className="row-actions">
            <button className="primary-button compact" onClick={() => loadOrders(token)} type="button">Apply filters</button>
            <button className="secondary-button compact" onClick={() => { setFilters(emptyOrderFilters); loadOrders(token, 1, false, emptyOrderFilters); }} type="button">Clear</button>
          </div>
          <p className="small-note">Showing {orders.length} of {pagination.total} orders.</p>
        </div>
        {orders.length === 0 ? (
          <article className="empty-state">No orders submitted yet.</article>
        ) : (
          orders.map((order) => (
            <article className="order-admin-card" key={order.id}>
              <div className="order-admin-header">
                <div>
                  <h2>{order.schools?.name ?? "School"} - Order {order.id.slice(0, 8)}</h2>
                  <dl className="detail-grid">
                    <div><dt>Date</dt><dd>{new Date(order.created_at).toLocaleString()}</dd></div>
                    <div><dt>Type</dt><dd>{order.order_type === "consignment" ? "Consignment for sizing" : "Purchase"}</dd></div>
                    <div><dt>Payment</dt><dd><span className={`status-pill status-${order.payment_status}`}>{order.payment_status}</span></dd></div>
                    <div><dt>Invoice</dt><dd>{order.invoice_number ?? "Not created yet"}</dd></div>
                    <div><dt>Contact</dt><dd>{order.contact_name ?? "No contact"}</dd></div>
                    <div><dt>Email</dt><dd>{order.contact_email ?? order.schools?.contact_email ?? "No email"}</dd></div>
                  </dl>
                </div>
                <span className={`status-pill status-${order.status}`}>{order.status}</span>
              </div>

              <div className="order-admin-lines">
                {order.school_order_items?.map((item) => (
                  <div className="order-admin-line" key={item.id}>
                    <span><strong>{item.quantity} x {item.item}</strong>{item.size ? ` | ${item.size}` : ""}</span>
                    <span>{item.currency === "USD" ? `$${Number(item.line_total).toFixed(2)}` : money(Number(item.line_total), "ZAR")}</span>
                  </div>
                ))}
              </div>

              <details className="content-shell" style={{ padding: 14 }}>
                <summary style={{ cursor: "pointer", fontWeight: 800 }}>Adjust order before invoicing</summary>
                <p className="small-note">
                  {order.invoice_id
                    ? `Locked because invoice ${order.invoice_number} has been created.`
                    : "Price changes and discounts are locked after the processing invoice is created."}
                </p>
                <div className="responsive-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Actual price</th>
                        <th>Draft line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.school_order_items ?? []).map((item) => {
                        const draft = itemDrafts[order.id]?.[item.id];
                        const quantity = draft?.quantity ?? String(item.quantity);
                        const price = draft?.instructor_price ?? String(item.instructor_price ?? 0);
                        const lineTotal = (Number(quantity) || 0) * (Number(price) || 0);
                        return (
                          <tr key={item.id}>
                            <td>{item.item}{item.size ? ` | ${item.size}` : ""}</td>
                            <td><input disabled={Boolean(order.invoice_id)} min="0" style={{ minWidth: 90 }} type="number" value={quantity} onChange={(event) => updateItemDraft(order.id, item.id, "quantity", event.target.value)} /></td>
                            <td><input disabled={Boolean(order.invoice_id)} min="0" step="0.01" style={{ minWidth: 120 }} type="number" value={price} onChange={(event) => updateItemDraft(order.id, item.id, "instructor_price", event.target.value)} /></td>
                            <td>{item.currency === "USD" ? `$${lineTotal.toFixed(2)}` : money(lineTotal, "ZAR")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="admin-form" style={{ marginTop: 12 }}>
                  <label>ZAR discount<input disabled={Boolean(order.invoice_id)} min="0" step="0.01" type="number" value={discountDrafts[order.id] ?? "0"} onChange={(event) => setDiscountDrafts((current) => ({ ...current, [order.id]: event.target.value }))} /></label>
                  <label>Discount note<input disabled={Boolean(order.invoice_id)} value={discountNoteDrafts[order.id] ?? ""} onChange={(event) => setDiscountNoteDrafts((current) => ({ ...current, [order.id]: event.target.value }))} placeholder="Reason for discount" /></label>
                </div>
              </details>

              {order.notes ? <p className="muted">School notes: {order.notes}</p> : null}
              {order.order_type === "consignment" ? (
                <p className="form-error">Consignment for sizing: items must be returned within two weeks. If not returned, the school owner remains responsible for the fees.</p>
              ) : null}

              <div className="order-admin-actions">
                <label>Status<select value={statusDrafts[order.id] ?? order.status} onChange={(event) => setStatusDrafts((current) => ({ ...current, [order.id]: event.target.value }))}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                <label>Payment<select value={paymentDrafts[order.id] ?? order.payment_status} onChange={(event) => setPaymentDrafts((current) => ({ ...current, [order.id]: event.target.value }))}>{paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                <label>Admin notes<input value={noteDrafts[order.id] ?? ""} onChange={(event) => setNoteDrafts((current) => ({ ...current, [order.id]: event.target.value }))} /></label>
                <button className="primary-button compact" disabled={busy} onClick={() => updateOrder(order.id)} type="button">Save</button>
              </div>

              <div className="order-admin-total">
                <strong>{money(draftOrderTotal(order).zar, "ZAR")}</strong>
                <strong>${draftOrderTotal(order).usd.toFixed(2)}</strong>
              </div>
            </article>
          ))
        )}
        {pagination.has_more ? (
          <button className="secondary-button" disabled={busy} onClick={() => loadOrders(token, pagination.page + 1, true)} type="button">Load more orders</button>
        ) : null}
      </section>
    </main>
  );
}
