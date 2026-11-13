import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/app/layout/AppLayout/AppLayout';
import { ConsentPage } from '@/pages/consent/ConsentPage';
import {
  PublicOnly,
  RequireAuth,
  RequireConsent,
  RequireNoConsent,
} from '@/app/router/guards/guards';
import {
  RequireNoProfile,
  RequireProfile,
} from '@/app/router/guards/profile-guards';
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage';
import { LoginPage } from '@/pages/login/LoginPage';
import { RegisterPage } from '@/pages/register/RegisterPage';
import { DialogPage } from '@/pages/dialog/DialogPage';
import { HistoryPage } from '@/pages/history/HistoryPage';
import { NewSessionPage } from '@/pages/new-session/NewSessionPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { SessionPage } from '@/pages/session/SessionPage';
import { WordsPage } from '@/pages/words/WordsPage';

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
          <Route element={<RequireNoProfile />}>
            <Route path="onboarding" element={<OnboardingPage />} />
          </Route>
          <Route element={<RequireProfile />}>
            <Route element={<AppLayout />}>
              <Route index element={<SessionPage />} />
              <Route path="sessions/new" element={<NewSessionPage />} />
              <Route path="sessions/:id" element={<DialogPage />} />
              <Route path="words" element={<WordsPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
