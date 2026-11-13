import { UnstyledButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import classes from './BottomNav.module.scss';
import { TABS } from './tabs';

export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className={classes.nav} aria-label={t('nav.label')}>
      {TABS.map((tab) => (
        <UnstyledButton
          key={tab.path}
          component={NavLink}
          to={tab.path}
          end
          className={classes.tab}
          fw={500}
          maw={120}
        >
          {t(`nav.${tab.key}`)}
        </UnstyledButton>
      ))}
    </nav>
  );
}
