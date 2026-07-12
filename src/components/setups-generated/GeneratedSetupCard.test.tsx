import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GeneratedSetupCard } from './GeneratedSetupCard';
import { makeGeneratedSetup } from '../../setups/testUtils/setupFixtures';

describe('GeneratedSetupCard — required visible indicators', () => {
  it('shows Signal strength without needing to open a disclosure', () => {
    const setup = makeGeneratedSetup({ signalStrength: 'High', risk: 'Low' });
    render(<GeneratedSetupCard setup={setup} priceOverride={{ price: 100, updatedAt: Date.now() }} />);
    expect(screen.getByText('Signal strength')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('shows Risk without needing to open a disclosure', () => {
    const setup = makeGeneratedSetup({ signalStrength: 'High', risk: 'Very high' });
    render(<GeneratedSetupCard setup={setup} priceOverride={{ price: 100, updatedAt: Date.now() }} />);
    expect(screen.getByText('Risk')).toBeInTheDocument();
    expect(screen.getByText('Very high')).toBeInTheDocument();
  });

  it('shows the trade type (Day trade / Swing trade) directly below the setup family', () => {
    const dayTrade = makeGeneratedSetup({ tradeHorizon: 'DAY_TRADE' });
    const { unmount } = render(<GeneratedSetupCard setup={dayTrade} priceOverride={{ price: 100, updatedAt: Date.now() }} />);
    expect(screen.getByText('Day trade')).toBeInTheDocument();
    unmount();

    const swingTrade = makeGeneratedSetup({ tradeHorizon: 'SWING_TRADE' });
    render(<GeneratedSetupCard setup={swingTrade} priceOverride={{ price: 100, updatedAt: Date.now() }} />);
    expect(screen.getByText('Swing trade')).toBeInTheDocument();
  });

  it('shows the expected duration', () => {
    const setup = makeGeneratedSetup({ expectedDuration: '4–24 uur' });
    render(<GeneratedSetupCard setup={setup} priceOverride={{ price: 100, updatedAt: Date.now() }} />);
    expect(screen.getByText('4–24 uur')).toBeInTheDocument();
  });

  it('renders the trade type immediately after the setup family label in DOM order', () => {
    const setup = makeGeneratedSetup({ tradeHorizon: 'DAY_TRADE' });
    const { container } = render(<GeneratedSetupCard setup={setup} priceOverride={{ price: 100, updatedAt: Date.now() }} />);
    const text = container.textContent ?? '';
    const familyIndex = text.indexOf('Trend continuation breakout');
    const horizonIndex = text.indexOf('Day trade');
    expect(familyIndex).toBeGreaterThan(-1);
    expect(horizonIndex).toBeGreaterThan(familyIndex);
  });
});
