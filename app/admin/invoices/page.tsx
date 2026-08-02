import AdminGuard from "../AdminGuard";
import InvoicesAdminClient from "./InvoicesAdminClient";

export default function AdminInvoicesPage() {
  return (
    <AdminGuard>
      <InvoicesAdminClient />
    </AdminGuard>
  );
}
