import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

interface PublishJobView {
  id: string;
  status: 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PENDING_PUBLISH_API';
  scheduledFor: string;
  timezone: string;
  lastError: string | null;
  retriesCount: number;
  video: {
    id: string;
    originalFilename: string;
    metadata: { title: string } | null;
  } | null;
  shopeeAccount: {
    id: string;
    shopId: string | null;
    status: string;
  } | null;
}

const STATUS_COLOR: Record<PublishJobView['status'], string> = {
  SCHEDULED: 'text-accent-blue bg-accent-blue/10',
  RUNNING: 'text-accent-yellow bg-accent-yellow/10',
  COMPLETED: 'text-accent-green bg-accent-green/10',
  FAILED: 'text-accent-red bg-accent-red/10',
  CANCELLED: 'text-text-muted bg-white/5',
  PENDING_PUBLISH_API: 'text-accent-orange bg-accent-orange/10',
};

export function SchedulePage(): JSX.Element {
  const jobs = useQuery<PublishJobView[]>({
    queryKey: ['schedule'],
    queryFn: () => apiFetch('/schedule'),
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Agendamentos</h1>
        <p className="text-text-muted mt-2">
          Jobs de aplicação de vídeo ao produto (`product.update_item`). Execução via fila BullMQ.
        </p>
      </header>

      <section className="card">
        {jobs.isLoading && <p className="text-text-muted">Carregando...</p>}
        {jobs.data?.length === 0 && (
          <p className="text-text-muted text-sm">
            Nenhum job agendado. Use a API <code>POST /schedule</code> para criar.
          </p>
        )}
        {jobs.data && jobs.data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="text-left py-2">Vídeo</th>
                <th className="text-left">Conta</th>
                <th className="text-left">Agendado para</th>
                <th className="text-left">Status</th>
                <th className="text-left">Retries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jobs.data.map((j) => (
                <tr key={j.id}>
                  <td className="py-3">
                    <div className="font-medium">
                      {j.video?.metadata?.title ?? j.video?.originalFilename ?? '—'}
                    </div>
                  </td>
                  <td className="text-text-muted">{j.shopeeAccount?.shopId ?? '—'}</td>
                  <td>
                    {new Date(j.scheduledFor).toLocaleString('pt-BR', {
                      timeZone: j.timezone,
                    })}
                  </td>
                  <td>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLOR[j.status]
                      }`}
                    >
                      {j.status}
                    </span>
                    {j.lastError && (
                      <div className="text-xs text-accent-red mt-1 max-w-xs truncate">
                        {j.lastError}
                      </div>
                    )}
                  </td>
                  <td>{j.retriesCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
