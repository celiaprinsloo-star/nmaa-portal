import AdminGuard from "../AdminGuard";
import ComplianceClient from "./ComplianceClient";

export default function AdminCompliancePage() {
  return (
    <AdminGuard>
      <ComplianceClient />
    </AdminGuard>
  );
}
