import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { UploadPage } from './pages/Upload';
import { PlaceholderPage } from './pages/Placeholder';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route
          path="agendamentos"
          element={
            <PlaceholderPage
              title="Agendamentos"
              description="Calendário e fila de publicações."
              phase="Fase 1 §1.4"
            />
          }
        />
        <Route
          path="analytics"
          element={
            <PlaceholderPage
              title="Analytics"
              description="Métricas operacionais e de performance."
              phase="Fase 2 (condicionada)"
            />
          }
        />
        <Route
          path="integracoes"
          element={
            <PlaceholderPage
              title="Integrações"
              description="Conexão de contas Shopee via autorização oficial."
              phase="Fase 1 §1.1"
            />
          }
        />
        <Route
          path="config"
          element={
            <PlaceholderPage
              title="Configurações"
              description="Preferências do workspace, templates e usuários."
              phase="Fase 1 §1.3 / Fase 3"
            />
          }
        />
      </Route>
    </Routes>
  );
}
