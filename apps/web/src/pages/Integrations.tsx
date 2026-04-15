import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useSearchParams } from 'react-router-dom';

interface ShopeeAccount {
  id: string;
  shopId: string | null;
  merchantId: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NEEDS_RECONNECT';
  tokenExpiresAt: string;
  lastRefreshedAt: string | null;
  connectedAt: string;
}

export function IntegrationsPage(): JSX.Element {
  const qc = useQueryClient();
  const [params] = useSearchParams();

  const accounts = useQuery<ShopeeAccount[]>({
    queryKey: ['integrations', 'shopee'],
    queryFn: () => apiFetch('/integrations/shopee'),
  });

  const authorize = useMutation({
    mutationFn: () =>
      apiFetch<{ authorizationUrl: string }>('/integrations/shopee/authorize', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: (r) => {
      window.location.href = r.authorizationUrl;
    },
  });

  const disconnect = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/integrations/shopee/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', 'shopee'] }),
  });

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Integrações Shopee</h1>
          <p className="text-text-muted mt-2">
            Conecte contas Shopee via fluxo oficial de autorização (OAuth v2).
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => authorize.mutate()}
          disabled={authorize.isPending}
        >
          {authorize.isPending ? 'Redirecionando...' : '+ Conectar conta'}
        </button>
      </header>

      {params.get('connected') && (
        <div className="card border-accent-green/30 bg-accent-green/10 text-accent-green text-sm">
          Conta conectada com sucesso.
        </div>
      )}
      {params.get('error') && (
        <div className="card border-accent-red/30 bg-accent-red/10 text-accent-red text-sm">
          Falha ao conectar: {params.get('error')}
        </div>
      )}
      {authorize.isError && (
        <div className="card border-accent-red/30 text-accent-red text-sm">
          {(authorize.error as Error).message}
        </div>
      )}

      <section className="card">
        <h2 className="font-display text-xl font-semibold mb-4">Contas conectadas</h2>
        {accounts.isLoading && <p className="text-text-muted">Carregando...</p>}
        {accounts.data?.length === 0 && (
          <p className="text-text-muted text-sm">
            Nenhuma conta conectada. Clique em "Conectar conta" para iniciar.
          </p>
        )}
        {accounts.data && accounts.data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="text-left py-2">Shop ID</th>
                <th className="text-left">Merchant</th>
                <th className="text-left">Status</th>
                <th className="text-left">Expira</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {accounts.data.map((a) => (
                <tr key={a.id}>
                  <td className="py-3">{a.shopId ?? '—'}</td>
                  <td>{a.merchantId ?? '—'}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>{new Date(a.tokenExpiresAt).toLocaleString('pt-BR')}</td>
                  <td className="text-right">
                    <button
                      className="text-accent-red hover:underline text-xs"
                      onClick={() => disconnect.mutate(a.id)}
                    >
                      Desconectar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: ShopeeAccount['status'] }): JSX.Element {
  const map = {
    ACTIVE: 'bg-accent-green/15 text-accent-green',
    EXPIRED: 'bg-accent-yellow/15 text-accent-yellow',
    REVOKED: 'bg-accent-red/15 text-accent-red',
    NEEDS_RECONNECT: 'bg-accent-orange/15 text-accent-orange',
  } as const;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
}
