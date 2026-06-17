import AdminGuard from "../AdminGuard";
import OrdersAdminClient from "./OrdersAdminClient";

export default function AdminOrdersPage() {
  return (
    <AdminGuard>
      <OrdersAdminClient />
    </AdminGuard>
  );
}
