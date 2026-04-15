import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../api/client';

interface Template {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  hashtags: string[];
  category: string | null;
  version: number;
  updatedAt: string;
}

export function TemplatesPage(): JSX.Element {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Template> | null>(null);

  const list = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => apiFetch('/templates'),
  });

  const save = useMutation({
    mutationFn: (t: Partial<Template>) =>
      t.id
        ? apiFetch(`/templates/${t.id}`, { method: 'PUT', body: JSON.stringify(t) })
        : apiFetch('/templates', { method: 'POST', body: JSON.stringify(t) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Templates de metadados</h1>
          <p className="text-text-muted mt-2">
            Reutilize título, descrição, hashtags e categoria para aplicar em lote.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setEditing({ name: '', hashtags: [] })}
        >
          + Novo template
        </button>
      </header>

      {editing && (
        <div className="card space-y-3">
          <h2 className="font-display text-xl font-semibold">
            {editing.id ? 'Editar template' : 'Novo template'}
          </h2>
          <input
            className="w-full bg-bg-primary border border-white/10 rounded-lg px-3 py-2"
            placeholder="Nome interno (ex.: Campanha Black Friday)"
            value={editing.name ?? ''}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
          <input
            className="w-full bg-bg-primary border border-white/10 rounded-lg px-3 py-2"
            placeholder="Título (aplicado ao listing)"
            maxLength={120}
            value={editing.title ?? ''}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          />
          <textarea
            className="w-full bg-bg-primary border border-white/10 rounded-lg px-3 py-2"
            placeholder="Descrição"
            rows={3}
            maxLength={2000}
            value={editing.description ?? ''}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })}
          />
          <input
            className="w-full bg-bg-primary border border-white/10 rounded-lg px-3 py-2"
            placeholder="Hashtags separadas por vírgula"
            value={(editing.hashtags ?? []).join(', ')}
            onChange={(e) =>
              setEditing({
                ...editing,
                hashtags: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          <div className="flex gap-2">
            <button
              className="btn-primary"
              disabled={!editing.name || save.isPending}
              onClick={() => save.mutate(editing)}
            >
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button className="btn-ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <section className="card">
        {list.isLoading && <p className="text-text-muted">Carregando...</p>}
        {list.data?.length === 0 && (
          <p className="text-text-muted text-sm">Nenhum template ainda.</p>
        )}
        {list.data && list.data.length > 0 && (
          <ul className="divide-y divide-white/5">
            {list.data.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-text-muted">
                    v{t.version} · {t.hashtags.length} hashtag(s) ·{' '}
                    {new Date(t.updatedAt).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="flex gap-2 text-sm">
                  <button className="btn-ghost" onClick={() => setEditing(t)}>
                    Editar
                  </button>
                  <button
                    className="text-accent-red hover:underline"
                    onClick={() => remove.mutate(t.id)}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
