import { rem, UnstyledButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link, matchPath, useLocation } from 'react-router';
import classes from './BottomNav.module.scss';
import { TABS } from './tabs';

const CURRENT_PAGE = 'page';

export function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <nav className={classes.nav} aria-label={t('nav.label')}>
      {TABS.map((tab) => {
        const active = tab.activePaths.some((path) => matchPath({ path, end: true }, pathname));

        return (
          <UnstyledButton
            key={tab.path}
            component={Link}
            to={tab.path}
            aria-current={active ? CURRENT_PAGE : undefined}
            className={classes.tab}
            fw={500}
            maw={rem(120)}
          >
            {t(`nav.${tab.key}`)}
          </UnstyledButton>
        );
      })}
    </nav>
  );
}
