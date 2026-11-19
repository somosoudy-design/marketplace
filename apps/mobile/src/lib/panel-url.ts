// Installed preview builds can still supply the original production origin.
const configured = process.env.EXPO_PUBLIC_PANEL_URL?.replace(/\/+$/, '');
export const panelOrigin = configured === 'https://kora-panel.expo.app' ? 'https://panel.mayami.app' : configured;
