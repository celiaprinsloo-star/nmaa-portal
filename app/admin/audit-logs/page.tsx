import AdminGuard from "../AdminGuard";
import AuditLogsClient from "./AuditLogsClient";

export default function AuditLogsPage() {
  return (
    <AdminGuard>
      <AuditLogsClient />
    </AdminGuard>
  );
}
