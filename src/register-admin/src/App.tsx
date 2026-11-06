import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MembersPage from './pages/MembersPage';
import MemberPage from './pages/MemberPage';
import PendingPage from './pages/PendingPage';
import OrganizationPage from './pages/OrganizationPage';
import PriestsPage from './pages/PriestsPage';
import UsersPage from './pages/UsersPage';
import AuditPage from './pages/AuditPage';
import AccountPage from './pages/AccountPage';
import PrintListPage from './pages/PrintListPage';
import FamilyReportPage from './pages/FamilyReportPage';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Laddar…</div>;
  if (!user) return <LoginPage />;

  return (
    <Routes>
      {/* Utskriftssidor utan meny */}
      <Route path="/print/members" element={<PrintListPage />} />
      <Route path="/print/family/:id" element={<FamilyReportPage />} />

      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/new" element={<MemberPage />} />
        <Route path="members/:id" element={<MemberPage />} />
        <Route path="pending" element={<PendingPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="priests" element={<PriestsPage />} />
        {user.role !== 'Church' && <Route path="users" element={<UsersPage />} />}
        {user.role === 'Root' && <Route path="audit" element={<AuditPage />} />}
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
