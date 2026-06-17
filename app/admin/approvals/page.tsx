import AdminGuard from "../AdminGuard";
import ApprovalsClient from "./ApprovalsClient";

export default function AdminApprovalsPage() {
  return (
    <AdminGuard>
      <ApprovalsClient />
    </AdminGuard>
  );
}
