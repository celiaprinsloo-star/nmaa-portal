"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Event as PortalEvent, EventBooking } from "@/lib/types";

const emptyBooking = {
  event_id: "",
  attendee_name: "",
  attendee_email: "",
  attendee_phone: "",
  attendee_type: "student",
  notes: "",
};

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

export default function SchoolEventsClient() {
  const [token, setToken] = useState("");
  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [form, setForm] = useState(emptyBooking);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const bookingsByEvent = useMemo(() => {
    return bookings.reduce<Record<string, EventBooking[]>>((grouped, booking) => {
      grouped[booking.event_id] = [...(grouped[booking.event_id] ?? []), booking];
      return grouped;
    }, {});
  }, [bookings]);

  async function loadEvents(activeToken: string) {
    const response = await fetch("/api/events", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load events.");
      return;
    }

    const nextEvents = payload.events ?? [];
    setEvents(nextEvents);
    setBookings(payload.bookings ?? []);
    setForm((current) => ({
      ...current,
      event_id: current.event_id || nextEvents[0]?.id || "",
    }));
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/school/events";
        return;
      }

      setToken(activeToken);
      await loadEvents(activeToken);
    }

    loadSession();
  }, []);

  function updateField(field: keyof typeof emptyBooking, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectEvent(eventId: string) {
    setForm((current) => ({ ...current, event_id: eventId }));
    window.setTimeout(() => {
      document.getElementById("attendee-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function saveBooking(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to add attendee.");
      return;
    }

    setForm((current) => ({
      ...emptyBooking,
      event_id: current.event_id,
    }));
    await loadEvents(token);
  }

  async function deleteBooking(id: string) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/events/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to remove attendee.");
      return;
    }

    await loadEvents(token);
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">School workspace</p>
          <h1>Events</h1>
          <p className="muted">View upcoming events and add attendees for your school.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/school">School sections</Link>
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section style={shellStyle}><p className="form-error">{error}</p></section> : null}

      <section className="two-column-workspace">
        <form className="admin-form" id="attendee-form" onSubmit={saveBooking}>
          <h2>Add attendee</h2>
          <label>
            Event
            <select value={form.event_id} onChange={(event) => updateField("event_id", event.target.value)} required>
              {events.map((eventItem) => (
                <option key={eventItem.id} value={eventItem.id}>{eventItem.title}</option>
              ))}
            </select>
          </label>
          <label>
            Attendee name
            <input value={form.attendee_name} onChange={(event) => updateField("attendee_name", event.target.value)} required />
          </label>
          <label>
            Type
            <select value={form.attendee_type} onChange={(event) => updateField("attendee_type", event.target.value)}>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="parent">Parent</option>
              <option value="guest">Guest</option>
            </select>
          </label>
          <label>
            Email
            <input type="email" value={form.attendee_email} onChange={(event) => updateField("attendee_email", event.target.value)} />
          </label>
          <label>
            Phone
            <input value={form.attendee_phone} onChange={(event) => updateField("attendee_phone", event.target.value)} />
          </label>
          <label>
            Notes
            <textarea className="order-summary-text" rows={4} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
          </label>
          <button className="primary-button compact" disabled={busy || events.length === 0} type="submit">Add attendee</button>
        </form>

        <section className="stat-panel">
          <h2>Your event activity</h2>
          <div className="stat-grid">
            <article>
              <strong>{events.length}</strong>
              <span>Available events</span>
            </article>
            <article>
              <strong>{bookings.length}</strong>
              <span>Attendees added</span>
            </article>
          </div>
          <p className="muted">Use the event cards to choose the correct event before adding attendees.</p>
        </section>
      </section>

      <section className="section-title">
        <h2>Available events</h2>
        <p>Open events that apply to your school.</p>
      </section>
      <section style={{ ...shellStyle, ...cardGridStyle }}>
        {events.length === 0 ? (
          <article className="empty-state">No open events are available for your school yet.</article>
        ) : (
          events.map((eventItem) => {
            const attendeeCount = (bookingsByEvent[eventItem.id] ?? []).length;
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
                  <span style={miniCardStyle}><strong>{attendeeCount}</strong><small>Your attendees</small></span>
                </div>
                <button className="secondary-button compact" onClick={() => selectEvent(eventItem.id)} type="button">
                  Add attendee to this event
                </button>
              </article>
            );
          })
        )}
      </section>

      <section className="section-title">
        <h2>Your attendees</h2>
        <p>People your school has added to events.</p>
      </section>
      <section className="content-shell table-list">
        {bookings.length === 0 ? (
          <article className="empty-state">No attendees added yet.</article>
        ) : (
          bookings.map((booking) => (
            <article className="list-row" key={booking.id}>
              <div>
                <h2>{booking.attendee_name}</h2>
                <p>{booking.events?.title ?? "Event"} | {booking.attendee_type ?? "attendee"} | {booking.status}</p>
                <p className="muted">{booking.attendee_email || "No email"} | {booking.attendee_phone || "No phone"}</p>
              </div>
              <button className="danger-button compact" disabled={busy} onClick={() => deleteBooking(booking.id)} type="button">Remove</button>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
