import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../api/client';

interface ConsentState {
  accepted: boolean;
  noticeVersion: string;
  acceptedAt: string | null;
}

interface RpaJob {
  id: string;
  videoLocalPath: string | null;
  caption: string;
  hashtags: string[];
  scheduledFor: string | null;
  status: 'PENDING' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  lastError: string | null;
  createdAt: string;
}

const STATUS_COLOR: Record<RpaJob['status'], string> = {
  PENDING: 'text-text-muted bg-white/5',
  CLAIMED: 'text-accent-blue bg-accent-blue/10',
  RUNNING: 'text-accent-yellow bg-accent-yellow/10',
  COMPLETED: 'text-accent-green bg-accent-green/10',
  FAILED: 'text-accent-red bg-accent-red/10',
  CANCELLED: 'text-text-muted bg-white/5',
};

export function RpaBotPage(): JSX.Element {
  const qc = useQueryClient();
  const consent = useQuery<ConsentState>({
    queryKey: ['rpa', 'consent'],
    queryFn: () => apiFetch('/rpa/consent'),
  });

  const jobs = useQuery<RpaJob[]>({
    queryKey: ['rpa', 'jobs'],
    queryFn: () => apiFetch('/rpa/jobs'),
    enabled: consent.data?.accepted === true,
    refetchInterval: 8_000,
  });

  if (consent.isLoading) return <p className="text-text-muted">Carregando...</p>;

  if (!consent.data?.accepted) {
    return <ConsentGate noticeVersion={consent.data?.noticeVersion ?? ''} />;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">RPA — Feed Shopee Video</h1>
        <p className="text-text-muted mt-2">
          Módulo <strong>não-oficial</strong>, opt-in. O agente roda na máquina do operador via
          Playwright.
        </p>
      </header>

      <div className="card border-accent-orange/30 bg-accent-orange/5 text-sm">
        <div className="font-semibold text-accent-orange mb-1">⚠️ Lembrete</div>
        <p className="text-text-secondary">
          Você aceitou os riscos em{' '}
          {consent.data.acceptedAt &&
            new Date(consent.data.acceptedAt).toLocaleString('pt-BR')}
          . Automação do Seller Centre viola o espírito do ToS da Shopee; use com conta dedicada e
          monitore rejeições. Kill switch: cancelar jobs ou desligar o agent via{' '}
          <code>Ctrl+C</code>.
        </p>
      </div>

      <NewJobForm />

      <section className="card">
        <h2 className="font-display text-xl font-semibold mb-4">Jobs recentes</h2>
        {jobs.isLoading && <p className="text-text-muted">Carregando...</p>}
        {jobs.data?.length === 0 && (
          <p className="text-text-muted text-sm">Nenhum job ainda.</p>
        )}
        {jobs.data && jobs.data.length > 0 && (
          <ul className="divide-y divide-white/5">
            {jobs.data.map((j) => (
              <li key={j.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{j.caption}</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {j.videoLocalPath} · criado{' '}
                    {new Date(j.createdAt).toLocaleString('pt-BR')}
                    {j.scheduledFor && (
                      <>
                        {' '}
                        · agendado para {new Date(j.scheduledFor).toLocaleString('pt-BR')}
                      </>
                    )}
                  </div>
                  {j.lastError && (
                    <div className="text-xs text-accent-red mt-1">{j.lastError}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLOR[j.status]
                    }`}
                  >
                    {j.status}
                  </span>
                  {['PENDING', 'CLAIMED', 'RUNNING'].includes(j.status) && (
                    <button
                      className="text-accent-red hover:underline text-xs"
                      onClick={() => {
                        apiFetch(`/rpa/jobs/${j.id}/cancel`, { method: 'POST' }).then(() =>
                          qc.invalidateQueries({ queryKey: ['rpa', 'jobs'] }),
                        );
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ConsentGate({ noticeVersion }: { noticeVersion: string }): JSX.Element {
  const qc = useQueryClient();
  const [confirmations, setConfirmations] = useState({
    understandsTosRisk: false,
    acceptsDetectionRisk: false,
    runsLocallyOnOwnMachine: false,
  });

  const accept = useMutation({
    mutationFn: () =>
      apiFetch('/rpa/consent', {
        method: 'POST',
        body: JSON.stringify({ noticeVersion, confirmations }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rpa', 'consent'] }),
  });

  const allChecked = Object.values(confirmations).every(Boolean);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">RPA — Feed Shopee Video</h1>
        <p className="text-text-muted mt-2">
          Este módulo é <strong>opt-in e não-oficial</strong>. Leia e confirme antes de habilitar.
        </p>
      </header>

      <div className="card border-accent-red/30 bg-accent-red/5 space-y-3 text-sm">
        <h2 className="font-display text-lg font-semibold text-accent-red">
          Riscos que você está assumindo
        </h2>
        <ul className="space-y-2 text-text-secondary list-disc list-inside">
          <li>
            <strong>Violação do ToS da Shopee:</strong> automação de Seller Centre pode resultar em
            banimento do seller. Use conta dedicada, nunca sua conta principal.
          </li>
          <li>
            <strong>Detecção de automação:</strong> Playwright é detectável via fingerprinting,
            timing e CDP traces. Não há garantia de estabilidade.
          </li>
          <li>
            <strong>Mudanças de layout:</strong> cada atualização da UI Shopee pode quebrar o robô.
            Você é responsável por atualizar selectors em <code>apps/rpa-bot/src/selectors.ts</code>
            .
          </li>
          <li>
            <strong>Sem SLA:</strong> este é um caminho não-suportado. Se quebrar, não há a quem
            reclamar.
          </li>
        </ul>
      </div>

      <div className="card space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmations.understandsTosRisk}
            onChange={(e) =>
              setConfirmations({ ...confirmations, understandsTosRisk: e.target.checked })
            }
          />
          <span className="text-sm">
            Entendo que automatizar o Seller Centre pode violar o Termo de Serviço da Shopee e que
            meu seller pode ser banido.
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmations.acceptsDetectionRisk}
            onChange={(e) =>
              setConfirmations({ ...confirmations, acceptsDetectionRisk: e.target.checked })
            }
          />
          <span className="text-sm">
            Aceito o risco de detecção de automação e assumo a responsabilidade pela manutenção dos
            selectors.
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmations.runsLocallyOnOwnMachine}
            onChange={(e) =>
              setConfirmations({ ...confirmations, runsLocallyOnOwnMachine: e.target.checked })
            }
          />
          <span className="text-sm">
            Vou rodar o agente em máquina sob meu controle (não em SaaS compartilhado) e nunca vou
            habilitar RPA em uma conta Shopee que não seja minha.
          </span>
        </label>

        <button
          className="btn-primary w-full disabled:opacity-40"
          disabled={!allChecked || accept.isPending}
          onClick={() => accept.mutate()}
        >
          {accept.isPending ? 'Salvando...' : 'Aceitar e habilitar RPA neste workspace'}
        </button>
      </div>
    </div>
  );
}

function NewJobForm(): JSX.Element {
  const qc = useQueryClient();
  const [videoLocalPath, setPath] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [scheduledFor, setScheduled] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/rpa/jobs', {
        method: 'POST',
        body: JSON.stringify({
          videoLocalPath,
          caption,
          hashtags: hashtags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rpa', 'jobs'] });
      setPath('');
      setCaption('');
      setHashtags('');
      setScheduled('');
    },
  });

  return (
    <section className="card space-y-3">
      <h2 className="font-display text-xl font-semibold">Novo job RPA</h2>
      <p className="text-xs text-text-muted">
        O arquivo precisa estar na pasta <code>VIDEOS_ROOT</code> da máquina onde o agente roda.
      </p>
      <input
        className="w-full bg-bg-primary border border-white/10 rounded-lg px-3 py-2"
        placeholder="videoLocalPath (ex.: promo.mp4)"
        value={videoLocalPath}
        onChange={(e) => setPath(e.target.value)}
      />
      <textarea
        className="w-full bg-bg-primary border border-white/10 rounded-lg px-3 py-2"
        placeholder="Legenda"
        rows={3}
        maxLength={2000}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <input
        className="w-full bg-bg-primary border border-white/10 rounded-lg px-3 py-2"
        placeholder="Hashtags separadas por vírgula"
        value={hashtags}
        onChange={(e) => setHashtags(e.target.value)}
      />
      <input
        type="datetime-local"
        className="w-full bg-bg-primary border border-white/10 rounded-lg px-3 py-2"
        value={scheduledFor}
        onChange={(e) => setScheduled(e.target.value)}
      />
      <button
        className="btn-primary disabled:opacity-40"
        disabled={!videoLocalPath || !caption || create.isPending}
        onClick={() => create.mutate()}
      >
        {create.isPending ? 'Criando...' : 'Enfileirar job'}
      </button>
      {create.isError && (
        <p className="text-xs text-accent-red">{(create.error as Error).message}</p>
      )}
    </section>
  );
}
