import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react's auto-cleanup only self-registers under Jest's
// global afterEach; under Vitest it has to be wired up explicitly, otherwise
// each render() accumulates in the jsdom document across tests in the same
// file instead of unmounting after each one.
afterEach(cleanup);
