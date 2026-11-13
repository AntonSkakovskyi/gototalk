import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/features/auth/components/AuthLayout/AuthLayout';
import { OnboardingWizard } from '@/features/profile/components/OnboardingWizard/OnboardingWizard';
import { onboardingRedirectTarget } from '@/features/profile/lib/onboarding-redirect';

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();

  return (
    <AuthLayout title={t('profile.onboarding.title')}>
      <OnboardingWizard
        onCompleted={() =>
          void navigate(onboardingRedirectTarget(state), { replace: true })
        }
      />
    </AuthLayout>
  );
}
