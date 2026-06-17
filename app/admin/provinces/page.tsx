import AdminGuard from "../AdminGuard";
import ProvincesClient from "./ProvincesClient";

export default function AdminProvincesPage() {
  return (
    <AdminGuard>
      <ProvincesClient />
    </AdminGuard>
  );
}
