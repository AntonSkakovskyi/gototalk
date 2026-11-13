import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './app/AppLayout.js';
import { ConsentPage } from './auth/ConsentPage.js';
import {
  PublicOnly,
  RequireAuth,
  RequireConsent,
  RequireNoConsent,
} from './auth/guards.js';
import { LoginPage } from './auth/LoginPage.js';
import { RegisterPage } from './auth/RegisterPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { SessionPage } from './pages/SessionPage.js';
import { WordsPage } from './pages/WordsPage.js';

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<RequireNoConsent />}>
          <Route path="consent" element={<ConsentPage />} />
        </Route>
        <Route element={<RequireConsent />}>
          <Route element={<AppLayout />}>
            <Route index element={<SessionPage />} />
            <Route path="words" element={<WordsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
