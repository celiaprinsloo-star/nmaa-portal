import AdminGuard from "../AdminGuard";
import SchoolsClient from "./SchoolsClient";

export default function AdminSchoolsPage() {
  return (
    <AdminGuard>
      <SchoolsClient />
    </AdminGuard>
  );
}
