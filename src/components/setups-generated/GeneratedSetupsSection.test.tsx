import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GeneratedSetupsSection } from './GeneratedSetupsSection';

describe('GeneratedSetupsSection — empty state', () => {
  it('shows the exact quality-criteria empty message when there are no visible setups', () => {
    render(<GeneratedSetupsSection />);
    expect(screen.getByText('Geen setups die momenteel voldoen aan de kwaliteitscriteria.')).toBeInTheDocument();
  });
});
