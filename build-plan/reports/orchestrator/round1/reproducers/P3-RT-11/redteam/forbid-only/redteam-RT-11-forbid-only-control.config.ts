// RT-11 attack 3, control: the same configuration with forbidOnly set as P0-A1's instruction asks
// (`forbidOnly: !!process.env.CI`). With CI=1 the same command must exit 1.
import base from '../../playwright.config';

export default { ...base, testDir: '.', testIgnore: [], webServer: undefined, forbidOnly: !!process.env.CI };
