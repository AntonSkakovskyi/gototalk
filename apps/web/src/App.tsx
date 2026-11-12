import { Title } from '@mantine/core';
import classes from './App.module.scss';
import { APP_TITLE } from './strings.js';

export function App() {
  return (
    <main className={classes.root}>
      <Title order={1}>{APP_TITLE}</Title>
    </main>
  );
}
