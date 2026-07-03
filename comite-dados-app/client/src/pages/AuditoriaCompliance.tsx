import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LGPDCompliancePanel } from '@/components/LGPDCompliancePanel';
import { GovernanceRecommendations } from '@/components/GovernanceRecommendations';
import { Shield, AlertCircle, TrendingUp, RefreshCw, Loader, Sun, Moon, Globe, ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@shared/i18n/translations';

/**
 * Página dedicada para Compliance LGPD
 * Exibe análise completa, recomendações e status de conformidade
 * Integrada com dados reais do Databricks via tRPC
 * Suporte a i18n (Português e Inglês)
 */
export default function LGPDCompliance() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');

  const t = getTranslation(language);

  // Extract sessionId from URL if available
  const sessionId = location.split('/').pop();

  // Fetch compliance analysis data from backend
  const analyzeComplianceMutation = trpc.lgpd.analyzeCompliance.useMutation();
  const { data: complianceAnalysis, isPending: isLoadingAnalysis } = analyzeComplianceMutation;
  
  // Get stored Databricks config from session or localStorage
  const [databricksConfig, setDatabricksConfig] = useState<{
    host: string;
    token: string;
    catalog: string;
  } | null>(null);

  useEffect(() => {
    // Load config from localStorage (would typically come from session)
    const stored = localStorage.getItem('databricks_config');
    if (stored) {
      try {
        setDatabricksConfig(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored config:', e);
      }
    }
  }, []);

  // Trigger analysis on mount or when config changes
  const handleAnalyze = async () => {
    if (!databricksConfig) {
      alert(t.compliance.configNotFound);
      return;
    }
    
    try {
      analyzeComplianceMutation.mutate({
        databricksHost: databricksConfig.host,
        databricksToken: databricksConfig.token,
        catalog: databricksConfig.catalog,
      });
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  };

  // Normaliza LGPDAnalysis (estrutura aninhada do servidor) para estrutura flat usada no template
  const complianceData = complianceAnalysis
    ? {
        score: complianceAnalysis.summary.complianceScore,
        riskLevel: complianceAnalysis.summary.riskLevel,
        criticalIssues: complianceAnalysis.summary.criticalIssues,
        piiColumnsUntagged: complianceAnalysis.piiDetection.untaggedPiiRisk,
        retentionPolicies: complianceAnalysis.retention.policies.filter((p) => p.assessment === 'defined').length,
        encryptedTables: complianceAnalysis.encryption.encryptedTables,
        auditLogsEnabled: complianceAnalysis.audit.accessLogsEnabled,
        dsrReadiness: {
          export: complianceAnalysis.dsr.readyForExport,
          delete: complianceAnalysis.dsr.readyForDeletion,
          access: complianceAnalysis.dsr.readyForDSR,
        },
      }
    : {
        score: 45,
        riskLevel: 'high' as const,
        criticalIssues: 3,
        piiColumnsUntagged: 5,
        retentionPolicies: 0,
        encryptedTables: 2,
        auditLogsEnabled: false,
        dsrReadiness: {
          export: false,
          delete: false,
          access: false,
        },
      };

  const mockRecommendations = [
    {
      id: 'pii-tagging',
      priority: 'critical' as const,
      category: 'pii' as const,
      title: t.recommendations.piiTagging,
      description: t.recommendations.piiDescription,
      impact: t.recommendations.piiImpact,
      estimatedEffort: 'quick' as const,
      action: t.recommendations.piiAction,
      relatedAssets: ['customers.email', 'customers.cpf', 'orders.birth_date'],
    },
    {
      id: 'retention-policies',
      priority: 'critical' as const,
      category: 'retention' as const,
      title: t.recommendations.retentionPolicies,
      description: t.recommendations.retentionDescription,
      impact: t.recommendations.retentionImpact,
      estimatedEffort: 'medium' as const,
      action: t.recommendations.retentionAction,
      relatedAssets: ['customers', 'orders', 'transactions', 'logs'],
    },
    {
      id: 'audit-logs',
      priority: 'high' as const,
      category: 'audit' as const,
      title: t.recommendations.auditLogs,
      description: t.recommendations.auditDescription,
      impact: t.recommendations.auditImpact,
      estimatedEffort: 'quick' as const,
      action: t.recommendations.auditAction,
    },
    {
      id: 'encryption',
      priority: 'high' as const,
      category: 'encryption' as const,
      title: t.recommendations.encryption,
      description: t.recommendations.encryptionDescription,
      impact: t.recommendations.encryptionImpact,
      estimatedEffort: 'complex' as const,
      action: t.recommendations.encryptionAction,
      relatedAssets: ['customers', 'orders', 'payments', 'users'],
    },
    {
      id: 'dsr-workflow',
      priority: 'high' as const,
      category: 'access' as const,
      title: t.recommendations.dsrWorkflow,
      description: t.recommendations.dsrDescription,
      impact: t.recommendations.dsrImpact,
      estimatedEffort: 'complex' as const,
      action: t.recommendations.dsrAction,
    },
    {
      id: 'documentation',
      priority: 'medium' as const,
      category: 'documentation' as const,
      title: t.recommendations.documentation,
      description: t.recommendations.docDescription,
      impact: t.recommendations.docImpact,
      estimatedEffort: 'medium' as const,
      action: t.recommendations.docAction,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="mr-2"
            title="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t.compliance.title}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t.compliance.subtitle}
            </p>
          </div>
        </div>
        <div className="text-right space-y-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              title={`Mudar para tema ${theme === 'dark' ? t.common.lightTheme : t.common.darkTheme}`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 mr-2" />
                  {t.common.lightTheme}
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 mr-2" />
                  {t.common.darkTheme}
                </>
              )}
            </Button>
            <div className="flex gap-1 p-1 bg-gray-200 dark:bg-gray-700 rounded-md">
              <Button
                variant={language === 'pt' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLanguage('pt')}
                className="text-xs"
              >
                PT
              </Button>
              <Button
                variant={language === 'en' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLanguage('en')}
                className="text-xs"
              >
                EN
              </Button>
            </div>
          </div>
          <div>
            <div className="text-4xl font-bold text-gray-900 dark:text-white">
              {complianceData.score}
              <span className="text-lg text-gray-600">{t.compliance.score}</span>
            </div>
            <div className="text-sm font-semibold text-orange-600">
              {t.compliance.risk.toUpperCase()} {complianceData.riskLevel ? complianceData.riskLevel.toUpperCase() : 'DESCONHECIDO'}
            </div>
          </div>
          <Button 
            onClick={handleAnalyze} 
            disabled={isLoadingAnalysis}
            className="w-full"
          >
            {isLoadingAnalysis ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                {t.compliance.analyzing}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t.compliance.analyzeNow}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Critical Alert */}
      {complianceData.criticalIssues > 0 && (
        <Alert className="border-red-200 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-red-800">
            <strong>{complianceData.criticalIssues} {t.compliance.criticalIssues}</strong> {t.compliance.criticalIssuesDesc}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">{t.compliance.tabs.overview}</TabsTrigger>
          <TabsTrigger value="recommendations">
            {t.compliance.tabs.recommendations}
            {mockRecommendations.length > 0 && (
              <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
                {
                  mockRecommendations.filter((r) => r.priority === 'critical')
                    .length
                }
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pii">{t.compliance.tabs.pii}</TabsTrigger>
          <TabsTrigger value="progress">{t.compliance.tabs.progress}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <LGPDCompliancePanel
            score={complianceData.score}
            riskLevel={complianceData.riskLevel}
            criticalIssues={complianceData.criticalIssues}
            piiColumnsUntagged={complianceData.piiColumnsUntagged}
            retentionPolicies={complianceData.retentionPolicies}
            encryptedTables={complianceData.encryptedTables}
            auditLogsEnabled={complianceData.auditLogsEnabled}
            dsrReadiness={complianceData.dsrReadiness}
            recommendations={mockRecommendations.slice(0, 3)}
            language={language}
          />
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                {t.compliance.actionPlan}
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {mockRecommendations.length} {t.compliance.recommendationsCount}
            </p>
            <GovernanceRecommendations
              recommendations={mockRecommendations}
              onImplement={(rec) =>
                console.log('Implementando:', rec.title)
              }
            />
          </Card>
        </TabsContent>

        {/* PII Tab */}
        <TabsContent value="pii" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t.compliance.piiTitle}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4 bg-primary/10">
                <p className="text-sm text-gray-600 mb-1">{t.compliance.totalColumns}</p>
                <p className="text-3xl font-bold text-blue-600">128</p>
              </Card>
              <Card className="p-4 bg-orange-50">
                <p className="text-sm text-gray-600 mb-1">{t.compliance.piiIdentified}</p>
                <p className="text-3xl font-bold text-orange-600">18</p>
              </Card>
              <Card className="p-4 bg-destructive/10">
                <p className="text-sm text-gray-600 mb-1">{t.compliance.notTagged}</p>
                <p className="text-3xl font-bold text-destructive">5</p>
              </Card>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">
                {t.compliance.categoriesDetected}
              </h3>
              {[
                { name: t.compliance.piiCategories.email, count: 3, tagged: 3 },
                { name: t.compliance.piiCategories.cpf, count: 2, tagged: 0 },
                { name: t.compliance.piiCategories.birthDate, count: 4, tagged: 4 },
                { name: t.compliance.piiCategories.phone, count: 5, tagged: 5 },
                { name: t.compliance.piiCategories.address, count: 4, tagged: 1 },
              ].map((cat) => (
                <div key={cat.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{cat.name}</p>
                    <p className="text-sm text-gray-600">
                      {cat.tagged}/{cat.count} {t.compliance.tagged}
                    </p>
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(cat.tagged / cat.count) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                {t.compliance.scoreHistory}
              </h3>
              <div className="space-y-2">
                {[
                  { date: t.compliance.today, score: 45 },
                  { date: t.compliance.daysAgo(7), score: 40 },
                  { date: t.compliance.daysAgo(14), score: 35 },
                  { date: t.compliance.daysAgo(30), score: 30 },
                ].map((entry) => (
                  <div key={entry.date} className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">{entry.date}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-orange-600 h-2 rounded-full"
                          style={{ width: `${entry.score}%` }}
                        />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {entry.score}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                {t.compliance.nextSteps}
              </h3>
              <div className="space-y-2">
                {t.compliance.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <p className="text-sm text-gray-600">{step}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-6 bg-accent/10 border-green-200">
            <h3 className="font-semibold text-green-900 mb-2">{t.compliance.goal}</h3>
            <p className="text-sm text-green-800 mb-3">
              {t.compliance.goalDesc}
            </p>
            <div className="w-full bg-green-200 rounded-full h-3">
              <div className="bg-primary h-3 rounded-full" style={{ width: '45%' }} />
            </div>
            <p className="text-xs text-green-700 mt-2">45% do caminho</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
