import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AuditoriaDashboard from "@/pages/AuditoriaDashboard";
import AuditoriaAudit from "@/pages/AuditoriaAudit";
import AuditoriaConnect from "@/pages/AuditoriaConnect";
import AuditoriaHistory from "@/pages/AuditoriaHistory";
import AuditoriaReport from "@/pages/AuditoriaReport";
import AuditoriaCompliance from "@/pages/AuditoriaCompliance";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Participants from "./pages/Participants";
import Meetings from "./pages/Meetings";
import MeetingDetail from "./pages/MeetingDetail";
import Organogram from "./pages/Organogram";
import RaciMatrix from "./pages/RaciMatrix";
import Implementation from "./pages/Implementation";
import AIAssistant from "./pages/AIAssistant";
import ServiceNow from "./pages/ServiceNow";
import InviteResponse from "./pages/InviteResponse";
import Notifications from "./pages/Notifications";
import ExportHistory from "./pages/ExportHistory";
import RoleManagement from "./pages/RoleManagement";
import TicketAlertSettings from "./pages/TicketAlertSettings";
import VCLayout from "./components/VCLayout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Feedback from "./pages/Feedback";
import DataCatalog from "./pages/DataCatalog";
import DataDictionary from "./pages/DataDictionary";
import DataLineage from "./pages/DataLineage";
import DataQuality from "./pages/DataQuality";
import ComplianceLGPD from "./pages/ComplianceLGPD";
import Home from "./pages/Home";
import AprovacoesFila from "./pages/AprovacoesFila";
import Glossario from "./pages/Glossario";
import AuditLog from "./pages/AuditLog";
import MaturityDashboard from "./pages/MaturityDashboard";
import LgpdReport from "./pages/LgpdReport";
import SlaPage from "./pages/SlaPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import DataContracts from "./pages/DataContracts";
import PiaPage from "./pages/PiaPage";
import DsarPage from "./pages/DsarPage";
import StatusPage from "./pages/StatusPage";
import MarketplacePage from "./pages/MarketplacePage";
import { BrandProvider } from "./contexts/BrandContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import LandingPage from "./pages/LandingPage";
import SetupWizard from "./pages/SetupWizard";
import { OnboardingTour } from "./components/OnboardingTour";
import WorkflowEditor from "./pages/WorkflowEditor";
import SignupPage from "./pages/SignupPage";
import IntakePage from "./pages/IntakePage";
import TagPolicies from "./pages/TagPolicies";
import PiiPolicies from "./pages/PiiPolicies";
import MaturityTiers from "./pages/MaturityTiers";
// Páginas unificadas (fusões)
import DicionarioCuradoria from "./pages/DicionarioCuradoria";
// Lacunas Lucid Data Governance
import MLOps from "./pages/MLOps";
import RiscosIA from "./pages/RiscosIA";
import BiConectores from "./pages/BiConectores";
import PortalLGPD from "./pages/PortalLGPD";
import OrganizacaoComite from "./pages/OrganizacaoComite";
import QualidadeSLA from "./pages/QualidadeSLA";
import GestaoDemandas from "./pages/GestaoDemandas";
import FilaAprovacoes from "./pages/FilaAprovacoes";
import IntegracoesConectores from "./pages/IntegracoesConectores";

function AuthenticatedApp() {
  return (
    <VCLayout>
      <OnboardingTour />
      <Switch>
        <Route path="/auditoria" component={AuditoriaDashboard} />
        <Route path="/auditoria/audit" component={AuditoriaAudit} />
        <Route path="/auditoria/connect" component={AuditoriaConnect} />
        <Route path="/auditoria/history" component={AuditoriaHistory} />
        <Route path="/auditoria/report/:sessionId" component={AuditoriaReport} />
        <Route path="/auditoria/compliance" component={AuditoriaCompliance} />
        <Route path="/" component={Dashboard} />
        <Route path="/ajuda" component={Home} />
        <Route path="/participantes" component={Participants} />
        <Route path="/reunioes" component={Meetings} />
        <Route path="/reunioes/:id" component={MeetingDetail} />
        <Route path="/organograma" component={Organogram} />
        <Route path="/raci" component={RaciMatrix} />
        <Route path="/implantacao" component={Implementation} />
        <Route path="/assistente-ia" component={AIAssistant} />
        <Route path="/servicenow" component={ServiceNow} />
        <Route path="/intake" component={IntakePage} />
        <Route path="/notificacoes" component={Notifications} />
        <Route path="/exportacoes" component={ExportHistory} />
        <Route path="/gerenciar-papeis" component={RoleManagement} />
        <Route path="/configuracoes/alertas-tickets" component={TicketAlertSettings} />
        <Route path="/feedback" component={Feedback} />
        <Route path="/catalogo" component={DataCatalog} />
        <Route path="/dicionario" component={DataDictionary} />
        <Route path="/linhagem" component={DataLineage} />
        <Route path="/qualidade" component={DataQuality} />
        <Route path="/compliance" component={ComplianceLGPD} />
        <Route path="/aprovacoes" component={AprovacoesFila} />
        <Route path="/glossario" component={Glossario} />
        <Route path="/audit-log" component={AuditLog} />
        <Route path="/maturidade" component={MaturityDashboard} />
        <Route path="/lgpd" component={LgpdReport} />
        <Route path="/sla" component={SlaPage} />
        <Route path="/integracoes" component={IntegrationsPage} />
        <Route path="/contratos" component={DataContracts} />
        <Route path="/pia" component={PiaPage} />
        <Route path="/dsar" component={DsarPage} />
        <Route path="/status" component={StatusPage} />
        <Route path="/marketplace" component={MarketplacePage} />
        <Route path="/setup" component={SetupWizard} />
        <Route path="/workflow" component={WorkflowEditor} />
        <Route path="/tag-policies" component={TagPolicies} />
        <Route path="/tags-governadas" component={TagPolicies} />
        <Route path="/politicas-pii" component={PiiPolicies} />
        <Route path="/autonomia-tiers" component={MaturityTiers} />
        {/* Rotas das páginas unificadas */}
        <Route path="/dicionario-curadoria" component={DicionarioCuradoria} />
        <Route path="/portal-lgpd" component={PortalLGPD} />
        <Route path="/organizacao" component={OrganizacaoComite} />
        <Route path="/qualidade-sla" component={QualidadeSLA} />
        <Route path="/demandas" component={GestaoDemandas} />
        <Route path="/fila-aprovacoes" component={FilaAprovacoes} />
        <Route path="/integracoes-conectores" component={IntegracoesConectores} />
        {/* Lacunas Lucid Data Governance */}
        <Route path="/mlops" component={MLOps} />
        <Route path="/riscos-ia" component={RiscosIA} />
        <Route path="/bi-conectores" component={BiConectores} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </VCLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <BrandProvider>
          <LanguageProvider>
          <Toaster />
          <Switch>
            <Route path="/convite/:token" component={InviteResponse} />
            <Route path="/plataforma" component={LandingPage} />
            <Route path="/cadastro" component={SignupPage} />
            <Route path="/login">{() => <Login />}</Route>
            <Route path="/esqueci-senha" component={ForgotPassword} />
            <Route path="/redefinir-senha" component={ResetPassword} />
            <Route component={AuthenticatedApp} />
          </Switch>
          </LanguageProvider>
          </BrandProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
