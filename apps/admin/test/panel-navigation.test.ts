import { describe, expect, it } from 'vitest';
import { panelLoginPath, safePanelReturn, selectedStore } from '../src/lib/panel-navigation';

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';

describe('panel navigation', () => {
  it('restores the requested seller or platform profile after login', () => {
    for (const path of ['/vendedor/tienda', '/admin/tiendas/perfil']) {
      const search = '?id=' + b;
      const login = new URL(panelLoginPath({ pathname: path, search }), 'https://panel.mayami.app');
      expect(login.pathname).toBe('/login');
      expect(safePanelReturn(login.searchParams.get('returnTo'))).toBe(path + search);
    }
  });
  it('only preserves recognized panel URLs and parameters', () => {
    for (const raw of ['//other.example', 'https://other.example', '/admin/../login', '/login', '/vendedor#session']) {
      expect(safePanelReturn(raw)).toBeNull();
    }
    expect(safePanelReturn('/admin?code=private&tab=settings')).toBe('/admin?tab=settings');
    expect(safePanelReturn('/vendedor/tienda?id=bad')).toBe('/sin-acceso');
  });
  it('an explicitly requested shop cannot fall back to a different membership', () => {
    const first = {id: a}, second = {id: b};
    expect(selectedStore([first, second], b, a)).toBe(second);
    expect(selectedStore([first], b, a)).toBeNull();
    expect(selectedStore([first], '', a)).toBeNull();
    expect(selectedStore([first, second], null, b)).toBe(second);
  });
});
