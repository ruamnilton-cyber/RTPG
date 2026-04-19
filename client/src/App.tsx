import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout";
import { OwnerLayout } from "./components/owner-layout";
import { RestaurantOwnerLayout } from "./components/restaurant-owner-layout";
import { useAuth } from "./state/auth";
import { AiPanelPage } from "./pages/ai-panel";
import { BarsPage } from "./pages/bars";
import { CashPage } from "./pages/cash";
import { CustomersPage } from "./pages/customers";
import { DashboardPage } from "./pages/dashboard";
import { FeatureCenterPage } from "./pages/feature-center";
import { FinanceHubPage } from "./pages/finance-hub";
import { InventoryPage } from "./pages/inventory";
import { KdsPage } from "./pages/kds";
import { LoginPage } from "./pages/login";
import { OrganizationPage } from "./pages/organization";
import { OwnerHubPage } from "./pages/owner-hub";
import { OwnerManagerPage } from "./pages/owner-manager";
import { OrdersCenterPage } from "./pages/orders-center";
import { ProductsPage } from "./pages/products";
import { QrCodesPage } from "./pages/qrcodes";
import { RecipesPage } from "./pages/recipes";
import { ReportsCenterPage } from "./pages/reports-center";
import { ReportsPage } from "./pages/reports";
import { ReservationsPage } from "./pages/reservations";
import { SaasClientsPage } from "./pages/saas-clients";
import { SettingsPage } from "./pages/settings";
import { SystemControlPage } from "./pages/system-control";
import { SuppliesPage } from "./pages/supplies";
import { TablesPage } from "./pages/tables";
import { UsersPage } from "./pages/users";

function RequireAuth() {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Carregando sessão...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

/** Dono do restaurante (ADMIN): painel próprio, sem o menu lateral da equipe. */
function AdminRestaurantRoutes() {
  return (
    <Routes>
      <Route path="/clientes-saas" element={<Navigate to="/meu-gestor/carteira" replace />} />
      <Route path="/meu-gestor" element={<OwnerLayout />}>
        <Route index element={<OwnerManagerPage />} />
        <Route path="carteira" element={<SaasClientsPage />} />
      </Route>
      <Route path="/painel-dono" element={<RestaurantOwnerLayout />}>
        <Route index element={<OwnerHubPage />} />
        <Route path="mesas" element={<TablesPage />} />
        <Route path="pedidos" element={<Navigate to="/painel-dono/mesas" replace />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="insumos" element={<SuppliesPage />} />
        <Route path="estoque" element={<InventoryPage />} />
        <Route path="fichas" element={<RecipesPage />} />
        <Route path="financeiro" element={<FinanceHubPage />} />
        <Route path="dre" element={<ReportsPage />} />
        <Route path="equipe" element={<UsersPage />} />
        <Route path="config" element={<SettingsPage />} />
        <Route path="caixa" element={<CashPage />} />
        <Route path="cozinha" element={<KdsPage />} />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="qrcodes" element={<QrCodesPage />} />
        <Route path="reservas" element={<ReservationsPage />} />
        <Route path="whatsapp" element={<AiPanelPage />} />
        <Route path="ia" element={<Navigate to="/painel-dono/whatsapp" replace />} />
        <Route path="relatorios" element={<ReportsCenterPage />} />
        <Route path="modulos" element={<FeatureCenterPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/meu-gestor" replace />} />
      <Route path="*" element={<Navigate to="/meu-gestor" replace />} />
    </Routes>
  );
}

function RestaurantAdminRoutes() {
  return (
    <Routes>
      <Route path="/clientes-saas" element={<Navigate to="/painel-dono" replace />} />
      <Route path="/meu-gestor/*" element={<Navigate to="/painel-dono" replace />} />
      <Route path="/painel-dono" element={<RestaurantOwnerLayout />}>
        <Route index element={<OwnerHubPage />} />
        <Route path="mesas" element={<TablesPage />} />
        <Route path="pedidos" element={<Navigate to="/painel-dono/mesas" replace />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="insumos" element={<SuppliesPage />} />
        <Route path="estoque" element={<InventoryPage />} />
        <Route path="fichas" element={<RecipesPage />} />
        <Route path="financeiro" element={<FinanceHubPage />} />
        <Route path="dre" element={<ReportsPage />} />
        <Route path="equipe" element={<UsersPage />} />
        <Route path="config" element={<SettingsPage />} />
        <Route path="caixa" element={<CashPage />} />
        <Route path="cozinha" element={<KdsPage />} />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="qrcodes" element={<QrCodesPage />} />
        <Route path="reservas" element={<ReservationsPage />} />
        <Route path="whatsapp" element={<AiPanelPage />} />
        <Route path="ia" element={<Navigate to="/painel-dono/whatsapp" replace />} />
        <Route path="relatorios" element={<ReportsCenterPage />} />
        <Route path="modulos" element={<FeatureCenterPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/painel-dono" replace />} />
      <Route path="*" element={<Navigate to="/painel-dono" replace />} />
    </Routes>
  );
}

function TeamRoutes() {
  return (
    <Routes>
      <Route path="/clientes-saas" element={<Navigate to="/" replace />} />
      <Route path="/meu-gestor/*" element={<Navigate to="/" replace />} />
      <Route path="/painel-dono/*" element={<Navigate to="/" replace />} />
      <Route path="/" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="bares" element={<BarsPage />} />
        <Route path="sistema" element={<SystemControlPage />} />
        <Route path="usuarios" element={<UsersPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="insumos" element={<SuppliesPage />} />
        <Route path="fichas" element={<RecipesPage />} />
        <Route path="estoque" element={<InventoryPage />} />
        <Route path="mesas" element={<TablesPage />} />
        <Route path="qrcodes" element={<QrCodesPage />} />
        <Route path="dre" element={<ReportsPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="cozinha" element={<KdsPage />} />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="caixa" element={<CashPage />} />
        <Route path="financeiro" element={<FinanceHubPage />} />
        <Route path="organizacao" element={<OrganizationPage />} />
        <Route path="pedidos" element={<OrdersCenterPage />} />
        <Route path="ia" element={<AiPanelPage />} />
        <Route path="relatorios" element={<ReportsCenterPage />} />
        <Route path="reservas" element={<ReservationsPage />} />
        <Route path="modulos" element={<FeatureCenterPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RoleSplitRoutes() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }
  const isPlatformAdmin = user.email === "admin@rtpg.local";
  if (isPlatformAdmin) {
    return <AdminRestaurantRoutes />;
  }
  if (user.role === "ADMIN") {
    return <RestaurantAdminRoutes />;
  }
  return <TeamRoutes />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/*" element={<RoleSplitRoutes />} />
      </Route>
    </Routes>
  );
}
