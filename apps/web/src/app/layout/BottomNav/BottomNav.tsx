import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import classes from './BottomNav.module.scss';
import { TABS } from './tabs';

export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className={classes.nav} aria-label={t('nav.label')}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end
          className={({ isActive }) =>
            isActive ? `${classes.link} ${classes.active}` : classes.link
          }
        >
          {t(`nav.${tab.key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
