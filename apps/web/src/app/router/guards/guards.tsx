import { Navigate, Outlet, useLocation } from 'react-router';
import { redirectState, safeRedirectTarget } from '@/shared/router/safe-path';
import { useSession } from '@/shared/auth-session/session-store';

// While the session is unknown AuthBootstrap shows the loader, so guards render nothing.
export function RequireAuth() {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'unknown') {
    return null;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={redirectState(location)} />;
  }
  return <Outlet />;
}

export function RequireConsent() {
  const { user } = useSession();
  const location = useLocation();

  if (user && !user.consentAt) {
    return <Navigate to="/consent" replace state={redirectState(location)} />;
  }
  return <Outlet />;
}

export function RequireNoConsent() {
  const { user } = useSession();
  const { state } = useLocation();

  if (user?.consentAt) {
    return <Navigate to={safeRedirectTarget(state)} replace />;
  }
  return <Outlet />;
}

export function PublicOnly() {
  const { user } = useSession();
  const { state } = useLocation();

  if (user) {
    return user.consentAt ? (
      <Navigate to={safeRedirectTarget(state)} replace />
    ) : (
      <Navigate to="/consent" replace state={state} />
    );
  }
  return <Outlet />;
}
