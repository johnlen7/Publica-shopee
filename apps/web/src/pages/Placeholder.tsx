interface Props {
  title: string;
  description: string;
  phase?: string;
}

export function PlaceholderPage({ title, description, phase }: Props): JSX.Element {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="text-text-muted mt-2">{description}</p>
      </header>
      <div className="card">
        <div className="text-sm text-text-muted">
          {phase ? `Implementação prevista para ${phase}.` : 'Tela em construção.'}
        </div>
      </div>
    </div>
  );
}
