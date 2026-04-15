import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { UploadPage } from './pages/Upload';
import { IntegrationsPage } from './pages/Integrations';
import { SchedulePage } from './pages/Schedule';
import { TemplatesPage } from './pages/Templates';
import { RpaBotPage } from './pages/RpaBot';
import { PlaceholderPage } from './pages/Placeholder';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="agendamentos" element={<SchedulePage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="integracoes" element={<IntegrationsPage />} />
        <Route path="rpa" element={<RpaBotPage />} />
        <Route
          path="analytics"
          element={
            <PlaceholderPage
              title="Analytics"
              description="Métricas operacionais: tempo médio de upload, taxa de sucesso, falhas por categoria."
              phase="Fase 2"
            />
          }
        />
        <Route
          path="config"
          element={
            <PlaceholderPage
              title="Configurações"
              description="Preferências do workspace, usuários e RBAC."
              phase="Fase 3"
            />
          }
        />
      </Route>
    </Routes>
  );
}
