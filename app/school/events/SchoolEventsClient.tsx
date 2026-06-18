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

const emptyEvent = {
  title: "",
  event_type: "school_event",
  description: "",
  venue: "",
  starts_at: "",
  ends_at: "",
  capacity: "",
};

const eventTypes = ["school_event", "grading", "class", "seminar", "meeting", "social"];

function displayDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SchoolEventsClient() {
  const [token, setToken] = useState("");
  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [form, setForm] = useState(emptyBooking);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [canCreateEvents, setCanCreateEvents] = useState(false);
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
    setCanCreateEvents(Boolean(payload.can_create_events));
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

  function updateEventField(field: keyof typeof emptyEvent, value: string) {
    setEventForm((current) => ({ ...current, [field]: value }));
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

  async function saveEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/events/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventForm),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to create event.");
      return;
    }

    setEventForm(emptyEvent);
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

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}

      <section className="two-column-workspace">
        {canCreateEvents ? (
        <form className="admin-form" onSubmit={saveEvent}>
          <h2>Create school event</h2>
          <label>
            Event name
            <input value={eventForm.title} onChange={(event) => updateEventField("title", event.target.value)} required />
          </label>
          <label>
            Event type
            <select value={eventForm.event_type} onChange={(event) => updateEventField("event_type", event.target.value)}>
              {eventTypes.map((type) => (
                <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <label>
            Venue
            <input value={eventForm.venue} onChange={(event) => updateEventField("venue", event.target.value)} />
          </label>
          <label>
            Start date and time
            <input type="datetime-local" value={eventForm.starts_at} onChange={(event) => updateEventField("starts_at", event.target.value)} required />
          </label>
          <label>
            End date and time
            <input type="datetime-local" value={eventForm.ends_at} onChange={(event) => updateEventField("ends_at", event.target.value)} />
          </label>
          <label>
            Capacity
            <input min="0" type="number" value={eventForm.capacity} onChange={(event) => updateEventField("capacity", event.target.value)} />
          </label>
          <label>
            Notes for attendees
            <textarea className="order-summary-text" rows={4} value={eventForm.description} onChange={(event) => updateEventField("description", event.target.value)} />
          </label>
          <button className="primary-button compact" disabled={busy} type="submit">Create event</button>
        </form>
        ) : null}

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
      <section className="event-card-grid">
        {events.length === 0 ? (
          <article className="empty-state">No open events are available for your school yet.</article>
        ) : (
          events.map((eventItem) => {
            const attendeeCount = (bookingsByEvent[eventItem.id] ?? []).length;
            return (
              <article className="event-card" key={eventItem.id}>
                <div>
                  <p className="eyebrow">{eventItem.event_type}</p>
                  <h2>{eventItem.title}</h2>
                  <p className="muted">{eventItem.description || "No notes added."}</p>
                </div>
                <div className="event-mini-grid">
                  <span className="event-mini-card"><strong>{displayDate(eventItem.starts_at)}</strong><small>Starts</small></span>
                  <span className="event-mini-card"><strong>{eventItem.venue || "No venue"}</strong><small>Venue</small></span>
                  <span className="event-mini-card"><strong>{eventItem.provinces?.name ?? "National"}</strong><small>Province</small></span>
                  <span className="event-mini-card"><strong>{attendeeCount}</strong><small>Your attendees</small></span>
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
