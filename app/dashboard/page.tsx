"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Profile, UserRole } from "@/lib/types";

type DashboardCard = {
  title: string;
  description: string;
  href?: string;
};

type CalendarItem = {
  id: string;
  type: "event" | "tournament" | "compliance";
  title: string;
  date: string;
  end_date: string | null;
  location: string | null;
  status: string | null;
  owner: string | null;
  href: string;
};

const cardSets: Record<UserRole, DashboardCard[]> = {
  super_admin: [
    { title: "Approvals", description: "Review pending users and assign access.", href: "/admin/approvals" },
    { title: "Schools", description: "Manage school records and affiliation status.", href: "/admin/schools" },
    { title: "Students", description: "View students, ranks, and membership status.", href: "/students" },
    { title: "Instructors", description: "Review instructor rank, collar level, and certification status.", href: "/instructors" },
    { title: "Provinces", description: "Maintain the national province structure.", href: "/admin/provinces" },
    { title: "Compliance", description: "Track submissions, expiry dates, and requirements.", href: "/admin/compliance" },
    { title: "Orders", description: "Process school uniform, gear, patch, and belt orders.", href: "/admin/orders" },
    { title: "Portal documents", description: "Upload constitution and shared school resources.", href: "/admin/documents" },
    { title: "Events", description: "Coordinate national and provincial events.", href: "/admin/events" },
    { title: "Tournaments", description: "Manage tournaments and entries.", href: "/admin/tournaments" },
    { title: "Reports", description: "Reporting will be added in the next feature pass." },
  ],
  national_admin: [
    { title: "Approvals", description: "Review pending users and assign access.", href: "/admin/approvals" },
    { title: "Schools", description: "Manage school records and affiliation status.", href: "/admin/schools" },
    { title: "Students", description: "Add students, ranks, and membership status.", href: "/students" },
    { title: "Instructors", description: "Review instructor rank, collar level, and certification status.", href: "/instructors" },
    { title: "Provinces", description: "Maintain the national province structure.", href: "/admin/provinces" },
    { title: "Compliance", description: "Track submissions, expiry dates, and requirements.", href: "/admin/compliance" },
    { title: "Orders", description: "Process school uniform, gear, patch, and belt orders.", href: "/admin/orders" },
    { title: "Portal documents", description: "Upload constitution and shared school resources.", href: "/admin/documents" },
    { title: "Events", description: "Coordinate national and provincial events.", href: "/admin/events" },
    { title: "Tournaments", description: "Manage tournaments and entries.", href: "/admin/tournaments" },
    { title: "Reports", description: "Reporting will be added in the next feature pass." },
  ],
  provincial_admin: [
    { title: "Province schools", description: "View schools in your province." },
    { title: "Students", description: "Monitor provincial student status.", href: "/students" },
    { title: "Events", description: "Track events in your province." },
    { title: "Compliance", description: "Review provincial compliance status." },
  ],
  school_owner: [
    { title: "My school", description: "Maintain school contact and registration information.", href: "/school/details" },
    { title: "Students", description: "Manage student membership status and ranks.", href: "/students" },
    { title: "Instructors", description: "Track instructors and training status.", href: "/school/instructors" },
    { title: "Compliance", description: "Submit and monitor compliance documents.", href: "/school/compliance" },
    { title: "Events", description: "Add attendees for upcoming NMAA events.", href: "/school/events" },
    { title: "Ordering", description: "Build uniform, sparring gear, patches, and belt orders.", href: "/school/orders" },
    { title: "Resources", description: "View the NMAA South Africa constitution and shared documents.", href: "/resources" },
    { title: "Tournament results", description: "Add student results for tournaments.", href: "/school/results" },
  ],
  instructor: [
    { title: "Events", description: "Add attendees for upcoming NMAA events.", href: "/school/events" },
    { title: "Tournament results", description: "Add student results for tournaments.", href: "/school/results" },
    { title: "Resources", description: "View the NMAA South Africa constitution and shared documents.", href: "/resources" },
  ],
};

const calendarShellStyle = {
  width: "min(1180px, 100%)",
  margin: "0 auto 22px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 360px",
  gap: "18px",
  alignItems: "start",
} satisfies React.CSSProperties;

const calendarPanelStyle = {
  display: "grid",
  gap: "14px",
  padding: "18px",
  background: "#ffffff",
  border: "1px solid #d9dee7",
  borderRadius: "8px",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.06)",
} satisfies React.CSSProperties;

const calendarGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: "6px",
} satisfies React.CSSProperties;

const typeLabels = {
  event: "Event",
  tournament: "Tournament",
  compliance: "Compliance",
};

function itemDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  });
}

function itemTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || value.length <= 10) return "";
  return date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function monthDays(baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = Array.from({ length: firstDay.getDay() }, () => null as Date | null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function itemKeyForDay(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        window.location.href = "/login?next=/dashboard";
        return;
      }

      const response = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        window.location.href = "/login?next=/dashboard";
        return;
      }

      const payload = await response.json();

      if (payload.profile.approval_status !== "approved" || !payload.profile.role) {
        window.location.href = "/pending-approval";
        return;
      }

      setProfile(payload.profile);

      const calendarResponse = await fetch("/api/calendar", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (calendarResponse.ok) {
        const calendarPayload = await calendarResponse.json();
        setCalendarItems(calendarPayload.items ?? []);
      }

      setLoading(false);
    }

    loadSession();
  }, []);

  if (loading) {
    return <main className="app-page">Loading dashboard...</main>;
  }

  if (!profile?.role) {
    return null;
  }

  const cards = cardSets[profile.role];
  const days = monthDays(viewMonth);
  const monthTitle = viewMonth.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  const itemsByDay = calendarItems.reduce<Record<string, CalendarItem[]>>((grouped, item) => {
    const key = itemKeyForDay(item.date);
    grouped[key] = [...(grouped[key] ?? []), item];
    return grouped;
  }, {});
  const upcomingItems = calendarItems.slice(0, 8);

  function moveMonth(direction: number) {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function resetMonth() {
    setViewMonth(new Date());
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome, {profile.full_name}</h1>
          <p className="muted">Role: {profile.role.replaceAll("_", " ")}</p>
        </div>
        <div className="row-actions">
          {(profile.role === "super_admin" || profile.role === "national_admin") && (
            <Link className="primary-button compact" href="/admin/approvals">
              Review approvals
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>
      <section className="card-grid">
        {cards.map((card) => (
          <article className="feature-card" key={card.title}>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            {card.href ? (
              <Link className="text-link" href={card.href}>
                Open
              </Link>
            ) : null}
          </article>
        ))}
      </section>

      <section className="section-title">
        <h2>Calendar</h2>
        <p>Events, tournaments, and important compliance dates.</p>
      </section>
      <section style={calendarShellStyle}>
        <article style={calendarPanelStyle}>
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <div>
              <p className="eyebrow">Month view</p>
              <h2 style={{ margin: "4px 0 6px", fontSize: 24 }}>{monthTitle}</h2>
            </div>
            <div className="row-actions">
              <button className="secondary-button compact" onClick={() => moveMonth(-1)} type="button">Previous</button>
              <button className="secondary-button compact" onClick={resetMonth} type="button">This month</button>
              <button className="secondary-button compact" onClick={() => moveMonth(1)} type="button">Next</button>
            </div>
          </div>
          <div style={calendarGridStyle}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <strong key={day} style={{ color: "#627084", fontSize: 12 }}>{day}</strong>
            ))}
            {days.map((day, index) => {
              const key = day ? `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}` : `empty-${index}`;
              const dayItems = day ? itemsByDay[key] ?? [] : [];

              return (
                <div
                  key={key}
                  style={{
                    minHeight: 88,
                    padding: 8,
                    background: day ? "#f8fafc" : "transparent",
                    border: day ? "1px solid #d9dee7" : "1px solid transparent",
                    borderRadius: 8,
                  }}
                >
                  {day ? (
                    <>
                      <strong style={{ display: "block", marginBottom: 6 }}>{day.getDate()}</strong>
                      <div style={{ display: "grid", gap: 4 }}>
                        {dayItems.slice(0, 3).map((item) => (
                          <Link
                            href={item.href}
                            key={`${item.type}-${item.id}`}
                            style={{
                              overflow: "hidden",
                              padding: "3px 5px",
                              borderRadius: 6,
                              background: item.type === "compliance" ? "#fff4f2" : item.type === "tournament" ? "#eff6ff" : "#ecfdf3",
                              color: item.type === "compliance" ? "#b42318" : item.type === "tournament" ? "#1d4ed8" : "#027a48",
                              fontSize: 11,
                              fontWeight: 800,
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.title}
                          </Link>
                        ))}
                        {dayItems.length > 3 ? <span className="small-note">+{dayItems.length - 3} more</span> : null}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>
        <aside style={calendarPanelStyle}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Upcoming</h2>
          {upcomingItems.length === 0 ? (
            <p className="muted">No upcoming calendar items yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {upcomingItems.map((item) => (
                <Link
                  className="list-row"
                  href={item.href}
                  key={`${item.type}-${item.id}`}
                  style={{ gridTemplateColumns: "1fr", padding: 12 }}
                >
                  <div>
                    <p className="eyebrow">{typeLabels[item.type]}</p>
                    <h2 style={{ margin: "4px 0", fontSize: 16 }}>{item.title}</h2>
                    <p className="muted">
                      {itemDate(item.date)} {itemTime(item.date)} {item.location ? `| ${item.location}` : ""}
                    </p>
                    {item.owner ? <p className="small-note">{item.owner}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
