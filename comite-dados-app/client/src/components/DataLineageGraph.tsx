import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  MarkerType,
  Background,
  Controls,
  MiniMap,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, GitBranch, ArrowRight, AlertTriangle } from "lucide-react";

interface LineageNode {
  id: string;
  data: { 
    label: string; 
    qualityScore?: number;
    isCascadeImpacted?: boolean;
  };
  position: { x: number; y: number };
  style?: any;
}

interface LineageEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  markerEnd?: any;
  style?: any;
}

interface DataLineageGraphProps {
  data: Array<{
    sourceName: string;
    targetName: string;
    type: string;
    sourceScore?: number;
    targetScore?: number;
    transformationRule?: string | null;
  }>;
  standaloneNodes?: Array<{
    name: string;
    qualityScore?: number | null;
  }>;
  onSelectAsset?: (name: string) => void;
  highlightImpact?: string | null; // nó a partir do qual propagar alertas
}

// ─── Calcula quais nós são impactados downstream a partir de um nó-raiz ──────
function computeCascadeImpact(rootName: string, edges: DataLineageGraphProps['data']): Set<string> {
  const adj: Record<string, string[]> = {};
  edges.forEach(e => {
    if (!adj[e.sourceName]) adj[e.sourceName] = [];
    adj[e.sourceName].push(e.targetName);
  });

  const visited = new Set<string>();
  const queue = [rootName];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    (adj[node] || []).forEach(n => queue.push(n));
  }
  visited.delete(rootName); // Não marcar o próprio nó como "impactado"
  return visited;
}

function computeDirectionalDistances(
  rootName: string,
  edges: DataLineageGraphProps['data'],
  direction: 'upstream' | 'downstream'
): Map<string, number> {
  const adjacency: Record<string, string[]> = {};

  edges.forEach((edge) => {
    const from = direction === 'downstream' ? edge.sourceName : edge.targetName;
    const to = direction === 'downstream' ? edge.targetName : edge.sourceName;
    if (!adjacency[from]) adjacency[from] = [];
    adjacency[from].push(to);
  });

  const distances = new Map<string, number>();
  const queue: Array<{ name: string; distance: number }> = [{ name: rootName, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (distances.has(current.name)) continue;
    distances.set(current.name, current.distance);

    for (const next of adjacency[current.name] || []) {
      if (!distances.has(next)) {
        queue.push({ name: next, distance: current.distance + 1 });
      }
    }
  }

  distances.delete(rootName);
  return distances;
}

export function DataLineageGraph({ data, standaloneNodes = [], onSelectAsset, highlightImpact }: DataLineageGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if ((!data || data.length === 0) && standaloneNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    if ((!data || data.length === 0) && standaloneNodes.length > 0) {
      setNodes(
        standaloneNodes.map((node, index) => ({
          id: node.name,
          data: { label: node.name, qualityScore: node.qualityScore ?? 0 },
          position: { x: 160 + index * 240, y: 220 },
          style: {
            background: '#fff',
            color: '#1B3A8C',
            border: '2px solid #1B3A8C',
            borderRadius: '12px',
            padding: '10px',
            fontWeight: 'bold',
            fontSize: '11px',
            width: 180,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          },
        }))
      );
      setEdges([]);
      return;
    }

    // Calcula nós impactados em cascata (se um nó crítico for selecionado)
    const criticalNodes = new Set(
      data.filter(e => (e.sourceScore || 0) < 70 && (e.sourceScore || 0) > 0).map(e => e.sourceName)
    );
    const cascadeImpacted = new Set<string>();
    criticalNodes.forEach(n => {
      computeCascadeImpact(n, data).forEach(impacted => cascadeImpacted.add(impacted));
    });

    // Nós adicionalmente destacados pela seleção manual
    const manualImpact = highlightImpact ? computeCascadeImpact(highlightImpact, data) : new Set<string>();

    const newNodes: any[] = [];
    const newEdges: any[] = [];
    const nodeSet = new Set<string>();

    // Process nodes
    data.forEach((item) => {
      [
        { name: item.sourceName, score: item.sourceScore },
        { name: item.targetName, score: item.targetScore }
      ].forEach(({ name, score }) => {
        if (!nodeSet.has(name)) {
          const isCritical = criticalNodes.has(name);
          const isCascadeImpacted = cascadeImpacted.has(name);
          const isManualImpact = manualImpact.has(name);
          const isHealthy = (score || 0) >= 70;
          const isWarning = (score || 0) > 0 && (score || 0) < 70;

          let borderColor = '#1B3A8C';
          if (isCritical) borderColor = '#ef4444';
          else if (isCascadeImpacted) borderColor = '#f97316';
          else if (isManualImpact) borderColor = '#a855f7';
          else if (isHealthy) borderColor = '#10b981';
          else if (isWarning) borderColor = '#f59e0b';

          const shadowGlow = isCritical
            ? '0 0 0 2px rgba(239,68,68,0.25), 0 4px 6px -1px rgb(0 0 0 / 0.1)'
            : isCascadeImpacted
            ? '0 0 0 2px rgba(249,115,22,0.15), 0 4px 6px -1px rgb(0 0 0 / 0.1)'
            : isManualImpact
            ? '0 0 0 2px rgba(168,85,247,0.15), 0 4px 6px -1px rgb(0 0 0 / 0.1)'
            : '0 4px 6px -1px rgb(0 0 0 / 0.1)';

          newNodes.push({
            id: name,
            data: { label: name, qualityScore: score, isCascadeImpacted, isCritical, isManualImpact },
            position: { x: 0, y: 0 },
            style: {
              background: isCritical ? '#fef2f2' : isCascadeImpacted ? '#fff7ed' : isManualImpact ? '#faf5ff' : '#fff',
              color: '#1B3A8C',
              border: `2px solid ${borderColor}`,
              borderRadius: '12px',
              padding: '10px',
              fontWeight: 'bold',
              fontSize: '11px',
              width: 180,
              boxShadow: shadowGlow,
            }
          });
          nodeSet.add(name);
        }
      });
    });

    // Process edges — destaca arestas do caminho de cascata
    data.forEach((item, index) => {
      const isImpactEdge = criticalNodes.has(item.sourceName) && cascadeImpacted.has(item.targetName);
      const isManualEdge = highlightImpact === item.sourceName || manualImpact.has(item.sourceName);

      const edgeColor = isImpactEdge ? '#f97316' : isManualEdge ? '#a855f7' : '#1B3A8C';
      const edgeWidth = isImpactEdge || isManualEdge ? 3 : 2;

      newEdges.push({
        id: `e-${item.sourceName}-${item.targetName}-${index}`,
        source: item.sourceName,
        target: item.targetName,
        label: item.type === 'direto' ? '' : item.type,
        animated: item.type !== 'direto' || isImpactEdge || isManualEdge,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
        },
        style: {
          stroke: edgeColor,
          strokeWidth: edgeWidth,
        },
        labelStyle: { fill: '#64748b', fontWeight: 700, fontSize: '10px' },
        labelBgStyle: { fill: '#f8fafc' },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
      });
    });

    if (highlightImpact && nodeSet.has(highlightImpact)) {
      const upstreamDistances = computeDirectionalDistances(highlightImpact, data, 'upstream');
      const downstreamDistances = computeDirectionalDistances(highlightImpact, data, 'downstream');
      const horizontalGap = 280;
      const verticalGap = 120;
      const centerX = 460;
      const centerY = 220;

      const columns = new Map<number, string[]>();

      const assignColumn = (column: number, nodeId: string) => {
        if (!columns.has(column)) columns.set(column, []);
        columns.get(column)!.push(nodeId);
      };

      newNodes.forEach((node) => {
        let column = 0;
        if (node.id === highlightImpact) {
          column = 0;
        } else if (upstreamDistances.has(node.id)) {
          column = -upstreamDistances.get(node.id)!;
        } else if (downstreamDistances.has(node.id)) {
          column = downstreamDistances.get(node.id)!;
        }
        assignColumn(column, node.id);
      });

      for (const [column, nodeIds] of columns.entries()) {
        nodeIds.sort((left, right) => left.localeCompare(right));
        const totalHeight = (nodeIds.length - 1) * verticalGap;
        nodeIds.forEach((nodeId, index) => {
          const node = newNodes.find((item) => item.id === nodeId);
          if (!node) return;
          node.position = {
            x: centerX + column * horizontalGap,
            y: centerY - totalHeight / 2 + index * verticalGap,
          };
        });
      }
    } else {
      // Fallback: layout hierárquico simples para visão global
      const levels: Record<string, number> = {};
      const adj: Record<string, string[]> = {};
      const inDegree: Record<string, number> = {};

      nodeSet.forEach(n => { adj[n] = []; inDegree[n] = 0; });
      data.forEach(d => {
        adj[d.sourceName].push(d.targetName);
        inDegree[d.targetName]++;
      });

      const queue: string[] = [];
      nodeSet.forEach(n => {
        if (inDegree[n] === 0) {
          levels[n] = 0;
          queue.push(n);
        }
      });

      let i = 0;
      while(i < queue.length) {
        const u = queue[i++];
        (adj[u] || []).forEach(v => {
          levels[v] = Math.max(levels[v] || 0, levels[u] + 1);
          queue.push(v);
        });
      }

      const levelCounts: Record<number, number> = {};
      newNodes.forEach(node => {
        const lvl = levels[node.id] || 0;
        const posInLevel = levelCounts[lvl] || 0;
        node.position = {
          x: lvl * 300 + 50,
          y: posInLevel * 120 + 50
        };
        levelCounts[lvl] = posInLevel + 1;
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [data, standaloneNodes, highlightImpact, setNodes, setEdges]);

  const onNodeClick = useCallback((_: any, node: any) => {
    onSelectAsset?.(node.id);
  }, [onSelectAsset]);

  const criticalCount = useMemo(() => data.filter(e => (e.sourceScore || 0) > 0 && (e.sourceScore || 0) < 70).length, [data]);

  return (
    <div style={{ width: '100%', height: '600px' }} className="border rounded-2xl bg-white shadow-inner overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
      >
        <Background color="#f1f5f9" gap={20} />
        <Controls />
        <MiniMap 
          nodeStrokeColor="#1B3A8C" 
          nodeColor="#E8EDF8"
          style={{ height: 120, width: 150 }}
        />
        <Panel position="top-right" className="bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-blue-100 shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-gray-600">Saudável (≥70%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-[10px] font-bold text-gray-600">Alerta (40–69%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-[10px] font-bold text-gray-600">Crítico (&lt;40%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-[10px] font-bold text-gray-600">Impacto Cascata</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-[10px] font-bold text-gray-600">Simulação What-if</span>
          </div>
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 mt-1 p-1.5 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
              <span className="text-[10px] font-black text-red-600">{criticalCount} ativo(s) crítico(s)</span>
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}
