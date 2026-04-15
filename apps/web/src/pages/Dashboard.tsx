import { useHealth } from '../hooks/useHealth';

const kpis = [
  { label: 'Enviados', value: '—', accent: 'text-accent-blue' },
  { label: 'Em fila', value: '—', accent: 'text-accent-yellow' },
  { label: 'Publicados', value: '—', accent: 'text-accent-green' },
  { label: 'Falhas', value: '—', accent: 'text-accent-red' },
];

export function DashboardPage(): JSX.Element {
  const health = useHealth();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <p className="text-text-muted mt-2">
          Visão consolidada de uploads, fila e publicações Shopee Video.
        </p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <div className="stat-label">{k.label}</div>
            <div className={`stat-number ${k.accent}`}>{k.value}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="font-display text-xl font-semibold mb-4">Saúde da plataforma</h2>
        {health.isLoading && <p className="text-text-muted">Verificando serviços...</p>}
        {health.isError && (
          <p className="text-accent-red">API offline. Verifique se `pnpm dev` está ativo.</p>
        )}
        {health.data && (
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="stat-label">Status</dt>
              <dd className="mt-1">{health.data.status}</dd>
            </div>
            <div>
              <dt className="stat-label">Uptime</dt>
              <dd className="mt-1">{health.data.uptime}s</dd>
            </div>
            <div>
              <dt className="stat-label">Postgres</dt>
              <dd className="mt-1">{health.data.checks.db}</dd>
            </div>
            <div>
              <dt className="stat-label">Redis</dt>
              <dd className="mt-1">{health.data.checks.redis}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="card">
        <h2 className="font-display text-xl font-semibold mb-2">Próximos passos (Fase 1)</h2>
        <ul className="list-disc list-inside text-text-secondary space-y-1 text-sm">
          <li>Conectar conta Shopee via integração oficial</li>
          <li>Implementar pipeline de upload multipart (init → parts → complete → poll)</li>
          <li>Agendamento com fila BullMQ</li>
          <li>Templates de metadados reutilizáveis</li>
        </ul>
      </section>
    </div>
  );
}
