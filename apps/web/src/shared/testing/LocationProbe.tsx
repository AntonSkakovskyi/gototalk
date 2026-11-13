import { useLocation } from 'react-router';

export function LocationProbe() {
  const { pathname, search, state } = useLocation();

  return (
    <div data-testid="location">
      <span data-testid="location-path">{`${pathname}${search}`}</span>
      <span data-testid="location-state">{JSON.stringify(state)}</span>
    </div>
  );
}
