import AdminGuard from "../AdminGuard";
import EventsAdminClient from "./EventsAdminClient";

export default function AdminEventsPage() {
  return (
    <AdminGuard>
      <EventsAdminClient />
    </AdminGuard>
  );
}
