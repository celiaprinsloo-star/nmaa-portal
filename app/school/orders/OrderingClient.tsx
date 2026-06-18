"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { money } from "@/lib/orderCatalog";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { OrderCatalogItem, SchoolOrder } from "@/lib/types";

const orderingLayoutStyle: CSSProperties = {
  width: "min(1280px, 100%)",
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
  gap: "20px",
  alignItems: "start",
};

const catalogStyle: CSSProperties = {
  display: "grid",
  gap: "18px",
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: "14px",
  padding: "18px",
  background: "#ffffff",
  border: "1px solid #d9dee7",
  borderRadius: "8px",
  boxShadow: "0 16px 34px rgba(15, 23, 42, 0.08)",
};

const productGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "12px",
};

const productCardStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "1fr auto auto",
  gap: "12px",
  minHeight: "220px",
  padding: "16px",
  background: "#f8fafc",
  border: "1px solid #d9dee7",
  borderRadius: "8px",
};

const priceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
};

const priceCellStyle: CSSProperties = {
  display: "grid",
  gap: "3px",
  padding: "10px",
  background: "#ffffff",
  border: "1px solid #d9dee7",
  borderRadius: "8px",
};

const summaryPanelStyle: CSSProperties = {
  display: "grid",
  gap: "14px",
  position: "sticky",
  top: "18px",
  padding: "18px",
  background: "#ffffff",
  border: "1px solid #d9dee7",
  borderRadius: "8px",
  boxShadow: "0 18px 38px rgba(15, 23, 42, 0.12)",
};

export default function OrderingClient() {
  const [token, setToken] = useState("");
  const [catalog, setCatalog] = useState<OrderCatalogItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [orders, setOrders] = useState<SchoolOrder[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadOrders(activeToken: string) {
    const [ordersResponse, catalogResponse] = await Promise.all([
      fetch("/api/orders", {
        headers: { Authorization: `Bearer ${activeToken}` },
      }),
      fetch("/api/order-catalog", {
        headers: { Authorization: `Bearer ${activeToken}` },
      }),
    ]);
    const [payload, catalogPayload] = await Promise.all([ordersResponse.json(), catalogResponse.json()]);

    if (!ordersResponse.ok) {
      setError(payload.error ?? "Unable to load orders.");
      return;
    }

    if (!catalogResponse.ok) {
      setError(catalogPayload.error ?? "Unable to load order catalogue.");
      return;
    }

    setOrders(payload.orders);
    setCatalog(catalogPayload.items);
    setError("");
  }

  async function refreshOrders(activeToken: string) {
    const response = await fetch("/api/orders", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load orders.");
      return;
    }

    setOrders(payload.orders);
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/school/orders";
        return;
      }

      const response = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (!response.ok) {
        window.location.href = "/login?next=/school/orders";
        return;
      }

      const payload = await response.json();
      setToken(activeToken);
      setContactName(payload.profile.full_name ?? "");
      setContactEmail(payload.profile.email ?? "");
      await loadOrders(activeToken);
    }

    loadSession();
  }, []);

  const selectedItems = useMemo(
    () => catalog.filter((item) => item.in_stock && (quantities[item.id] ?? 0) > 0),
    [catalog, quantities],
  );

  const totals = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => {
          const quantity = quantities[item.id] ?? 0;
          if (item.currency === "ZAR" && item.instructor_price) sum.zar += item.instructor_price * quantity;
          if (item.currency === "USD" && item.instructor_price) sum.usd += item.instructor_price * quantity;
          return sum;
        },
        { zar: 0, usd: 0 },
      ),
    [quantities, selectedItems],
  );

  const groupedItems = catalog.reduce<Record<string, OrderCatalogItem[]>>((groups, item) => {
    groups[item.section] = [...(groups[item.section] ?? []), item];
    return groups;
  }, {});

  function setQuantity(itemId: string, value: string) {
    const quantity = Math.max(0, Number(value) || 0);
    setQuantities((current) => ({ ...current, [itemId]: quantity }));
  }

  async function submitOrder() {
    setBusy(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contact_name: contactName,
        contact_email: contactEmail,
        notes,
        items: selectedItems.map((item) => ({
          catalog_item_id: item.id,
          quantity: quantities[item.id] ?? 0,
        })),
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to submit order.");
      return;
    }

    setQuantities({});
    setNotes("");
    setMessage("Order submitted to admin for processing.");
    await refreshOrders(token);
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">School workspace</p>
          <h1>Ordering</h1>
          <p className="muted">Build and submit uniform, sparring gear, patch, and belt orders.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/school">School sections</Link>
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}
      {message ? <section className="content-shell"><p className="form-success">{message}</p></section> : null}

      <section className="ordering-layout" style={orderingLayoutStyle}>
        <section className="ordering-catalog" style={catalogStyle}>
          {Object.entries(groupedItems).map(([section, items]) => (
            <article className="order-section" key={section} style={sectionStyle}>
              <div className="order-section-header">
                <h2>{section}</h2>
                <span>{items.length} items</span>
              </div>
              <div className="shop-product-grid" style={productGridStyle}>
                {items.map((item) => (
                    <article
                      className={`shop-product-card ${quantities[item.id] ? "selected" : ""} ${!item.in_stock ? "out-of-stock" : ""}`}
                      key={item.id}
                      style={{
                        ...productCardStyle,
                        borderColor: quantities[item.id] ? "#0f766e" : "#d9dee7",
                        opacity: item.in_stock ? 1 : 0.62,
                      }}
                    >
                    <div className="shop-product-main">
                      <h3>{item.item}</h3>
                      <p>{item.size ?? item.section}</p>
                      {item.note ? <small>{item.note}</small> : null}
                      {!item.in_stock ? <small>Currently out of stock</small> : null}
                    </div>
                    <div className="shop-price-grid" style={priceGridStyle}>
                      <span style={priceCellStyle}><strong>{money(item.instructor_price ?? undefined, item.currency)}</strong><small>Actual item price</small></span>
                      <span style={priceCellStyle}><strong>{item.student_price ? money(item.student_price, item.currency) : "-"}</strong><small>Recommended selling price</small></span>
                    </div>
                    <label className="quantity-control">
                      Qty
                      <input
                        disabled={!item.in_stock}
                        min="0"
                        onChange={(event) => setQuantity(item.id, event.target.value)}
                        style={{ width: "100%", minHeight: "44px", marginTop: "6px" }}
                        type="number"
                        value={quantities[item.id] ?? 0}
                      />
                    </label>
                  </article>
                ))}
              </div>
            </article>
          ))}
          <section className="content-shell">
            <p className="muted">Please note that sizing for uniforms can be irregular. It is the school&apos;s responsibility to ensure the correct fit.</p>
          </section>
        </section>

        <aside className="order-summary-panel" style={summaryPanelStyle}>
          <h2>Cart</h2>
          <label>Contact person<input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
          <label>Contact email<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label>
          <label>Notes<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <div className="order-total-card"><strong>{money(totals.zar, "ZAR")}</strong><span>ZAR actual order total</span></div>
          <div className="order-total-card"><strong>${totals.usd.toFixed(2)}</strong><span>USD items total</span></div>
          <section className="cart-lines">
            {selectedItems.length === 0 ? (
              <p className="muted">No items selected.</p>
            ) : (
              selectedItems.map((item) => (
                <article key={item.id}>
                  <strong>{quantities[item.id]} x {item.item}</strong>
                  <span>{item.size ?? item.section}</span>
                </article>
              ))
            )}
          </section>
          <button className="primary-button compact" disabled={busy || selectedItems.length === 0} onClick={submitOrder} type="button">
            Submit order
          </button>
        </aside>
      </section>

      <section className="section-title">
        <h2>Submitted orders</h2>
        <p>Admin will update the status as each order is processed.</p>
      </section>
      <section className="content-shell table-list">
        {orders.length === 0 ? (
          <article className="empty-state">No submitted orders yet.</article>
        ) : (
          orders.map((order) => (
            <article className="list-row" key={order.id}>
              <div>
                <h2>Order {order.id.slice(0, 8)}</h2>
                <dl className="detail-grid">
                  <div><dt>Date</dt><dd>{new Date(order.created_at).toLocaleDateString()}</dd></div>
                  <div><dt>Total ZAR</dt><dd>{money(Number(order.total_zar), "ZAR")}</dd></div>
                  <div><dt>Total USD</dt><dd>${Number(order.total_usd).toFixed(2)}</dd></div>
                  <div><dt>Lines</dt><dd>{order.school_order_items?.length ?? 0}</dd></div>
                </dl>
                {order.admin_notes ? <p>{order.admin_notes}</p> : null}
              </div>
              <span className={`status-pill status-${order.status}`}>{order.status}</span>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
