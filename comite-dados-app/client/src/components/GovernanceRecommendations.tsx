import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, ShieldAlert, ArrowRight, Sparkles } from "lucide-react";

export interface Recommendation {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  impact: string;
  estimatedEffort: "quick" | "medium" | "complex";
  action: string;
  relatedAssets?: string[];
}

interface GovernanceRecommendationsProps {
  recommendations: Recommendation[];
  onImplement?: (rec: Recommendation) => void;
}

export function GovernanceRecommendations({
  recommendations,
  onImplement,
}: GovernanceRecommendationsProps) {
  const priorityColors = {
    critical: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300",
    high: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300",
    medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
    low: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  };

  const effortLabels = {
    quick: "Rápido",
    medium: "Médio",
    complex: "Complexo",
  };

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <Card key={rec.id} className="border border-border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs font-semibold ${priorityColors[rec.priority]}`}>
                    {rec.priority.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {rec.category.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Esforço: {effortLabels[rec.estimatedEffort] || rec.estimatedEffort}
                  </span>
                </div>

                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  {rec.title}
                </h4>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {rec.description}
                </p>

                <div className="text-xs text-gray-500 flex flex-col gap-1 pt-1">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Impacto: <span className="font-normal">{rec.impact}</span>
                  </span>
                  {rec.relatedAssets && rec.relatedAssets.length > 0 && (
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Ativos Relacionados:{" "}
                      <span className="font-mono bg-gray-50 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">
                        {rec.relatedAssets.join(", ")}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {onImplement && (
                <Button
                  size="sm"
                  onClick={() => onImplement(rec)}
                  className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                >
                  <ArrowRight className="h-4 w-4" />
                  {rec.action || "Implementar"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
