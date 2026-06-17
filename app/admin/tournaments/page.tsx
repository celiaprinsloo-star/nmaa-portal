import AdminGuard from "../AdminGuard";
import TournamentsClient from "./TournamentsClient";

export default function AdminTournamentsPage() {
  return (
    <AdminGuard>
      <TournamentsClient />
    </AdminGuard>
  );
}
