import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router';
import { profileQueryOptions } from '@/features/profile/api/profile-queries';
import { GateError, GateLoader } from './GateScreens/GateScreens';
import { ApiError } from '@/shared/api/http';
import { redirectState, safeRedirectTarget } from '@/shared/router/safe-path';

function isProfileMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function RequireProfile() {
  const profile = useQuery(profileQueryOptions());
  const location = useLocation();

  if (profile.data) {
    return <Outlet />;
  }
  if (isProfileMissing(profile.error)) {
    return (
      <Navigate to="/onboarding" replace state={redirectState(location)} />
    );
  }
  if (profile.isError) {
    return <GateError onRetry={() => void profile.refetch()} />;
  }
  return <GateLoader />;
}

export function RequireNoProfile() {
  const profile = useQuery(profileQueryOptions());
  const { state } = useLocation();

  if (profile.data) {
    return <Navigate to={safeRedirectTarget(state)} replace />;
  }
  if (isProfileMissing(profile.error)) {
    return <Outlet />;
  }
  if (profile.isError) {
    return <GateError onRetry={() => void profile.refetch()} />;
  }
  return <GateLoader />;
}
