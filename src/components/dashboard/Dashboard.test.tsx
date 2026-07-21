import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Dashboard } from './Dashboard';

describe('Dashboard — required page order', () => {
  it('renders Setups before Market Context, and Market Context before the Top 50 Scanner', () => {
    const { container } = render(<Dashboard />);
    const text = container.textContent ?? '';

    const setupsIndex = text.indexOf('Setups');
    const marketContextIndex = text.indexOf('Market Context');
    const scannerIndex = text.indexOf('Top 50 Market Scanner');

    expect(setupsIndex).toBeGreaterThan(-1);
    expect(marketContextIndex).toBeGreaterThan(-1);
    expect(scannerIndex).toBeGreaterThan(-1);
    expect(setupsIndex).toBeLessThan(marketContextIndex);
    expect(marketContextIndex).toBeLessThan(scannerIndex);
  });
});
