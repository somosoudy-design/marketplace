// Focused app checks reuse the main configuration without starting the unrelated web panel.
import config from './playwright.config';
export default {
  ...config,
  projects: config.projects!.filter((project) => project.name === 'app'),
  webServer: [Array.isArray(config.webServer) ? config.webServer[0] : config.webServer!],
};
