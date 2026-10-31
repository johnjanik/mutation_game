// RT-11 attack 3: the repository's Playwright configuration, unchanged except that it collects the fixture
// of this directory and starts no server. Every other option, forbidOnly included, is the repository's.
// Run: CI=1 npx playwright test --config redteam/forbid-only/redteam-RT-11-forbid-only.config.ts --list
// Expected under SPEC 7.7 and the RT-11 lens: exit 1 ("focused item found" / forbidOnly). Observed: exit 0.
import base from '../../playwright.config';

export default { ...base, testDir: '.', testIgnore: [], webServer: undefined };
