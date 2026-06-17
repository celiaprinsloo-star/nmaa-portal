"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Event as PortalEvent, EventBooking, Province, School } from "@/lib/types";

type SchoolOption = Pick<School, "id" | "province_id" | "name">;

const emptyEvent = {
  title: "",
  event_type: "general",
  province_id: "",
  school_id: "",
  venue: "",
  starts_at: "",
  ends_at: "",
  capacity: "",
  status: "open",
  description: "",
};

const eventTypes = ["general", "grading", "seminar", "training", "meeting", "tournament"];
const eventStatuses = ["open", "published", "draft", "closed", "cancelled"];

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function displayDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const shellStyle = {
  width: "min(1280px, 100%)",
  margin: "0 auto",
} as const;

const cardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "14px",
  alignItems: "stretch",
} as const;

const eventCardStyle = {
  display: "grid",
  gap: "14px",
  padding: "18px",
  background: "#fff",
  border: "1px solid #d9dee7",
  borderRadius: "8px",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.08)",
} as const;

const miniGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
} as const;

const miniCardStyle = {
  display: "grid",
  gap: "4px",
  padding: "12px",
  background: "#f8fafc",
  border: "1px solid #d9dee7",
  borderRadius: "8px",
} as const;

export default function EventsAdminClient() {
  const [token, setToken] = useState("");
  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [form, setForm] = useState(emptyEvent);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const bookingsByEvent = useMemo(() => {
    return bookings.reduce<Record<string, EventBooking[]>>((grouped, booking) => {
      grouped[booking.event_id] = [...(grouped[booking.event_id] ?? []), booking];
      return grouped;
    }, {});
  }, [bookings]);

  async function loadEvents(activeToken: string) {
    const response = await fetch("/api/admin/events", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load events.");
      return;
    }

    setEvents(payload.events ?? []);
    setBookings(payload.bookings ?? []);
    setProvinces(payload.provinces ?? []);
    setSchools(payload.schools ?? []);
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/admin/events";
        return;
      }

      setToken(activeToken);
      await loadEvents(activeToken);
    }

    loadSession();
  }, []);

  function updateField(field: keyof typeof emptyEvent, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyEvent);
  }

  function editEvent(eventItem: PortalEvent) {
    setEditingId(eventItem.id);
    setForm({
      title: eventItem.title,
      event_type: eventItem.event_type,
      province_id: eventItem.province_id ?? "",
      school_id: eventItem.school_id ?? "",
      venue: eventItem.venue ?? "",
      starts_at: toDateTimeLocal(eventItem.starts_at),
      ends_at: toDateTimeLocal(eventItem.ends_at),
      capacity: eventItem.capacity?.toString() ?? "",
      status: eventItem.status,
      description: eventItem.description ?? "",
    });

    window.setTimeout(() => {
      document.getElementById("event-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function saveEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(editingId ? `/api/admin/events/${editingId}` : "/api/admin/events", {
      method: editingId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save event.");
      return;
    }

    resetForm();
    await loadEvents(token);
  }

  async function deleteEvent(id: string) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/events/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete event.");
      return;
    }

    await loadEvents(token);
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Admin</p>
          <h1>Events</h1>
          <p className="muted">Create events, manage details, and see school attendees.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section style={shellStyle}><p className="form-error">{error}</p></section> : null}

      <section className="two-column-workspace">
        <form className="admin-form" id="event-form" onSubmit={saveEvent}>
          <h2>{editingId ? "Edit event" : "Create event"}</h2>
          <label>
            Event name
            <input value={form.title} onChange={(event) => updateField("title", event.target.value)} required />
          </label>
          <label>
            Event type
            <select value={form.event_type} onChange={(event) => updateField("event_type", event.target.value)}>
              {eventTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Province
            <select value={form.province_id} onChange={(event) => updateField("province_id", event.target.value)}>
              <option value="">All provinces</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>{province.name}</option>
              ))}
            </select>
          </label>
          <label>
            Specific school
            <select value={form.school_id} onChange={(event) => updateField("school_id", event.target.value)}>
              <option value="">All schools in selected area</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </label>
          <label>
            Venue
            <input value={form.venue} onChange={(event) => updateField("venue", event.target.value)} />
          </label>
          <label>
            Start date and time
            <input type="datetime-local" value={form.starts_at} onChange={(event) => updateField("starts_at", event.target.value)} required />
          </label>
          <label>
            End date and time
            <input type="datetime-local" value={form.ends_at} onChange={(event) => updateField("ends_at", event.target.value)} />
          </label>
          <label>
            Capacity
            <input min="0" type="number" value={form.capacity} onChange={(event) => updateField("capacity", event.target.value)} />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
              {eventStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Notes for schools
            <textarea className="order-summary-text" rows={4} value={form.description} onChange={(event) => updateField("description", event.target.value)} />
          </label>
          <div className="button-row">
            <button className="primary-button compact" disabled={busy} type="submit">
              {editingId ? "Save event" : "Create event"}
            </button>
            {editingId ? (
              <button className="secondary-button compact" onClick={resetForm} type="button">Cancel edit</button>
            ) : null}
          </div>
        </form>

        <section className="stat-panel">
          <h2>Event overview</h2>
          <div className="stat-grid">
            <article>
              <strong>{events.length}</strong>
              <span>Total events</span>
            </article>
            <article>
              <strong>{events.filter((eventItem) => ["open", "published"].includes(eventItem.status)).length}</strong>
              <span>Visible to schools</span>
            </article>
            <article>
              <strong>{bookings.length}</strong>
              <span>Attendees added</span>
            </article>
          </div>
          <p className="muted">Only open and published events are visible to school owners.</p>
        </section>
      </section>

      <section className="section-title">
        <h2>Manage events</h2>
        <p>Each card shows the event scope, timing, and attendee count.</p>
      </section>
      <section style={{ ...shellStyle, ...cardGridStyle }}>
        {events.length === 0 ? (
          <article className="empty-state">No events created yet.</article>
        ) : (
          events.map((eventItem) => {
            const eventBookings = bookingsByEvent[eventItem.id] ?? [];
            return (
              <article key={eventItem.id} style={eventCardStyle}>
                <div>
                  <p className="eyebrow">{eventItem.event_type}</p>
                  <h2 style={{ margin: "4px 0 6px", fontSize: 22 }}>{eventItem.title}</h2>
                  <p className="muted">{eventItem.description || "No notes added."}</p>
                </div>
                <div style={miniGridStyle}>
                  <span style={miniCardStyle}><strong>{displayDate(eventItem.starts_at)}</strong><small>Starts</small></span>
                  <span style={miniCardStyle}><strong>{eventItem.venue || "No venue"}</strong><small>Venue</small></span>
                  <span style={miniCardStyle}><strong>{eventItem.provinces?.name ?? "National"}</strong><small>Province</small></span>
                  <span style={miniCardStyle}><strong>{eventItem.schools?.name ?? "All schools"}</strong><small>School</small></span>
                  <span style={miniCardStyle}><strong>{eventBookings.length}</strong><small>Attendees</small></span>
                  <span style={miniCardStyle}><strong>{eventItem.capacity ?? "No limit"}</strong><small>Capacity</small></span>
                </div>
                <div className="row-actions" style={{ justifyContent: "space-between" }}>
                  <span className={`status-pill status-${eventItem.status}`}>{eventItem.status}</span>
                  <span className="row-actions">
                    <button className="secondary-button compact" onClick={() => editEvent(eventItem)} type="button">Edit</button>
                    <button className="danger-button compact" disabled={busy} onClick={() => deleteEvent(eventItem.id)} type="button">Delete</button>
                  </span>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="section-title">
        <h2>Attendees</h2>
        <p>Schools add these from their own event page.</p>
      </section>
      <section className="content-shell table-list">
        {bookings.length === 0 ? (
          <article className="empty-state">No attendees added yet.</article>
        ) : (
          bookings.map((booking) => (
            <article className="list-row" key={booking.id}>
              <div>
                <h2>{booking.attendee_name}</h2>
                <p>
                  {booking.events?.title ?? "Event"} | {booking.schools?.name ?? "No school"} | {booking.attendee_type ?? "attendee"}
                </p>
                <p className="muted">{booking.attendee_email || "No email"} | {booking.attendee_phone || "No phone"}</p>
              </div>
              <span className={`status-pill status-${booking.status}`}>{booking.status}</span>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
