import AdminGuard from "../AdminGuard";
import DocumentsAdminClient from "./DocumentsAdminClient";

export default function AdminDocumentsPage() {
  return (
    <AdminGuard>
      <DocumentsAdminClient />
    </AdminGuard>
  );
}
