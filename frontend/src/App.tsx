import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import UploadPage from "./pages/Upload";
import QueuePage from "./pages/Queue";
import InvoicesPage from "./pages/Invoices";
import InvoiceDetailPage from "./pages/InvoiceDetail";
import OcrReviewPage from "./pages/OcrReview";
import MatchingPage from "./pages/Matching";
import FraudPage from "./pages/Fraud";
import VendorsPage from "./pages/Vendors";
import PurchaseOrdersPage from "./pages/PurchaseOrders";
import GoodsReceiptsPage from "./pages/GoodsReceipts";
import ApprovalsPage from "./pages/Approvals";
import AuditPage from "./pages/Audit";
import ModelEvaluationPage from "./pages/ModelEvaluation";
import UsersPage from "./pages/Users";
import SettingsPage from "./pages/Settings";
import { Spinner } from "./components/UI";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading-block"><Spinner large /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:uid" element={<InvoiceDetailPage />} />
        <Route path="/invoices/:uid/ocr" element={<OcrReviewPage />} />
        <Route path="/matching" element={<MatchingPage />} />
        <Route path="/fraud" element={<FraudPage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/goods-receipts" element={<GoodsReceiptsPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/models" element={<ModelEvaluationPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
