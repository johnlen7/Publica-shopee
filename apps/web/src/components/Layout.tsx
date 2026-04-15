import { NavLink, Outlet } from 'react-router-dom';
import { useHealth } from '../hooks/useHealth';

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/upload', label: 'Upload' },
  { to: '/agendamentos', label: 'Agendamentos' },
  { to: '/templates', label: 'Templates' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/integracoes', label: 'Integrações' },
  { to: '/config', label: 'Configurações' },
];

export function Layout(): JSX.Element {
  const health = useHealth();

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-[270px] bg-bg-secondary/90 backdrop-blur border-r border-white/5 flex-col p-5 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-orange to-accent-orange-2 grid place-items-center font-display font-bold">
            P
          </div>
          <div>
            <div className="font-display font-bold leading-tight">Publica Shopee</div>
            <div className="text-xs text-text-muted">Video Automator</div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-xl text-sm transition-colors ${
                  isActive
                    ? 'bg-accent-orange/15 text-accent-orange-2 font-medium'
                    : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="text-xs text-text-muted border-t border-white/5 pt-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                health.data?.status === 'ok'
                  ? 'bg-accent-green'
                  : health.data?.status === 'degraded'
                    ? 'bg-accent-yellow'
                    : 'bg-accent-red'
              }`}
            />
            <span>
              API: {health.data?.status ?? (health.isLoading ? 'verificando...' : 'offline')}
            </span>
          </div>
          {health.data && (
            <div className="mt-1">
              db {health.data.checks.db} · redis {health.data.checks.redis}
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-10 max-w-[1440px] w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
