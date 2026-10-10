/**
 * Sidebar chrome. One palette: the blue shell.
 */
export interface ShellTheme {
  page: string
  sidebar: string
  sidebarBorder: string
  panel: string
  panelLine: string
  nav: string
  navHighlight: string
  navBorder: string
  accent: string
  accentStrong: string
  accentBorder: string
  settings: string
  settingsHighlight: string
  settingsBorder: string
  tech: string
}

export const THEME: ShellTheme = {
  page: '#0f0f23',
  sidebar: '#1a1a2e',
  sidebarBorder: '#16213e',
  panel: '#16213e',
  panelLine: '#0f3460',
  nav: '#16213e',
  navHighlight: '#0f3460',
  navBorder: '#0f3460',
  accent: '#4a9eff',
  accentStrong: '#4CAF50',
  accentBorder: '#2e7d32',
  settings: '#7e57c2',
  settingsHighlight: '#9575cd',
  settingsBorder: '#5e35b1',
  tech: '#c084fc',
}
