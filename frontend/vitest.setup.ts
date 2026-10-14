// Registers the jest-dom matchers (toBeDisabled, toHaveTextContent, ...)
// against Vitest's expect, including their types.
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when the runner exposes a global afterEach.
// This project runs Vitest without globals, so unmount explicitly.
afterEach(() => {
  cleanup();
});
