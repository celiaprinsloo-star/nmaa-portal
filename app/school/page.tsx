import Link from "next/link";
import BrandMark from "@/app/components/BrandMark";

export default function SchoolPage() {
  const sections = [
    {
      title: "School information",
      description: "Update contact details and view school stats.",
      href: "/school/details",
    },
    {
      title: "Instructors",
      description: "Manage instructor details and training status.",
      href: "/school/instructors",
    },
    {
      title: "Compliance",
      description: "Add and review safeguarding, first aid, NQF, and training documents.",
      href: "/school/compliance",
    },
    {
      title: "Events",
      description: "View events and add attendees from your school.",
      href: "/school/events",
    },
    {
      title: "Resources",
      description: "View the NMAA South Africa constitution and shared documents.",
      href: "/resources",
    },
    {
      title: "Ordering",
      description: "Build uniform, sparring gear, patches, and belt orders.",
      href: "/school/orders",
    },
    {
      title: "Tournament registration",
      description: "Register students for upcoming tournament categories.",
      href: "/school/tournaments",
    },
    {
      title: "Tournament results",
      description: "Record student entries, medals, and points.",
      href: "/school/results",
    },
  ];

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">School workspace</p>
          <h1>Choose a section</h1>
          <p className="muted">Each school task now has its own page.</p>
        </div>
        <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
      </header>

      <section className="card-grid">
        {sections.map((section) => (
          <article className="feature-card" key={section.href}>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <Link className="text-link" href={section.href}>Open</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
