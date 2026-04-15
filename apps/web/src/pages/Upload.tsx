import { useState } from 'react';
import { SHOPEE_VIDEO_LIMITS } from '@publica/shared';

export function UploadPage(): JSX.Element {
  const [files, setFiles] = useState<File[]>([]);

  function validate(f: File): { ok: boolean; reason?: string } {
    if (!(SHOPEE_VIDEO_LIMITS.ALLOWED_MIME_TYPES as readonly string[]).includes(f.type)) {
      return { ok: false, reason: `Tipo ${f.type} não suportado` };
    }
    if (f.size > SHOPEE_VIDEO_LIMITS.MAX_FILE_SIZE_BYTES) {
      return {
        ok: false,
        reason: `Tamanho ${(f.size / 1024 / 1024).toFixed(1)} MB excede ${
          SHOPEE_VIDEO_LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024
        } MB`,
      };
    }
    return { ok: true };
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Upload</h1>
        <p className="text-text-muted mt-2">
          Envie vídeos em lote. Limites oficiais Shopee:{' '}
          {SHOPEE_VIDEO_LIMITS.MIN_DURATION_SECONDS}–{SHOPEE_VIDEO_LIMITS.MAX_DURATION_SECONDS}s,
          até {SHOPEE_VIDEO_LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.
        </p>
      </header>

      <section className="card border-dashed border-white/10">
        <label className="block cursor-pointer">
          <input
            type="file"
            multiple
            accept="video/mp4,video/quicktime,video/x-msvideo"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <div className="text-center py-12">
            <div className="font-display text-lg mb-1">Clique para selecionar vídeos</div>
            <div className="text-sm text-text-muted">MP4, MOV ou AVI</div>
          </div>
        </label>
      </section>

      {files.length > 0 && (
        <section className="card">
          <h2 className="font-display text-xl font-semibold mb-4">Arquivos selecionados</h2>
          <ul className="divide-y divide-white/5">
            {files.map((f) => {
              const v = validate(f);
              return (
                <li key={f.name} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{f.name}</div>
                    <div className="text-text-muted">
                      {(f.size / 1024 / 1024).toFixed(2)} MB · {f.type || 'tipo desconhecido'}
                    </div>
                  </div>
                  {v.ok ? (
                    <span className="text-accent-green text-xs font-medium">Válido</span>
                  ) : (
                    <span className="text-accent-red text-xs">{v.reason}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            className="btn-primary mt-6"
            disabled
            title="Pipeline de upload será implementado na Fase 1"
          >
            Iniciar upload (Fase 1 pendente)
          </button>
        </section>
      )}
    </div>
  );
}
