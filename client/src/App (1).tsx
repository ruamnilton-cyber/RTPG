import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout";
import { useAuth } from "./state/auth";
import { CashPage } from "./pages/cash";
import { CustomersPage } from "./pages/customers";
import { DashboardPage } from "./pages/dashboard";
import { FinanceHubPage } from "./pages/finance-hub";
import { InventoryPage } from "./pages/inventory";
import { KdsPage } from "./pages/kds";
import { LoginPage } from "./pages/login";
import { OrganizationPage } from "./pages/organization";
import { OrdersCenterPage } from "./pages/orders-center";
import { ProductsPage } from "./pages/products";
import { QrCodesPage } from "./pages/qrcodes";
import { AiPanelPage } from "./pages/ai-panel";
import { RecipesPage } from "./pages/recipes";
import { ReportsCenterPage } from "./pages/reports-center";
import { ReportsPage } from "./pages/reports";
import { ReservationsPage } from "./pages/reservations";
import { SaasClientsPage } from "./pages/saas-clients";
import { SettingsPage } from "./pages/settings";
import { SuppliesPage } from "./pages/supplies";
import { TablesPage } from "./pages/tables";
import { UsersPage } from "./pages/users";

function ProtectedShell() {
  const { token, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Carregando sessão...</div>;
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/clientes-saas" element={<SaasClientsPage />} />
        <Route path="/produtos" element={<ProductsPage />} />
        <Route path="/insumos" element={<SuppliesPage />} />
        <Route path="/fichas" element={<RecipesPage />} />
        <Route path="/estoque" element={<InventoryPage />} />
        <Route path="/mesas" element={<TablesPage />} />
        <Route path="/qrcodes" element={<QrCodesPage />} />
        <Route path="/dre" element={<ReportsPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="/cozinha" element={<KdsPage />} />
        <Route path="/clientes" element={<CustomersPage />} />
        <Route path="/caixa" element={<CashPage />} />
        <Route path="/financeiro" element={<FinanceHubPage />} />
        <Route path="/organizacao" element={<OrganizationPage />} />
        <Route path="/pedidos" element={<OrdersCenterPage />} />
        <Route path="/ia" element={<AiPanelPage />} />
        <Route path="/relatorios" element={<ReportsCenterPage />} />
        <Route path="/reservas" element={<ReservationsPage />} />
      </Route>
    </Routes>
  );
}
