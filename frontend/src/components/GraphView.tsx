import { useMemo, useState } from "react";
import ReactFlow, { Background, type Edge, type Node } from "reactflow";
import type { GraphJson, GraphNode } from "../types";

interface GraphViewProps {
  graph: GraphJson;
  currentNodeId: string;
}

const nodeOrder: Record<string, number> = {
  opening: 0,
  discovery: 1,
  value_explanation: 2,
  objection_handling: 3,
  price_negotiation: 4,
  closing: 5,
  success: 6,
  dead_end: 6,
};

const nodeTypeLabels: Record<string, string> = {
  opening: "Открытие",
  discovery: "Выявление потребностей",
  value_explanation: "Объяснение ценности",
  objection_handling: "Работа с возражением",
  price_negotiation: "Обсуждение цены",
  competitor_comparison: "Сравнение с конкурентом",
  concession: "Уступка",
  closing: "Закрытие",
  success: "Успех",
  dead_end: "Тупик",
};

function displayNodeLabel(node: GraphNode) {
  return nodeTypeLabels[node.type] ?? node.label;
}

export default function GraphView({ graph, currentNodeId }: GraphViewProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const nodes = useMemo<Node[]>(() => {
    return graph.nodes.map((node, index) => {
      const order = nodeOrder[node.type] ?? index;
      const isCurrent = node.id === currentNodeId;
      const isSuccess = node.type === "success";
      const isDeadEnd = node.type === "dead_end";
      const x = isSuccess ? 40 : isDeadEnd ? 260 : order % 2 === 0 ? 40 : 260;
      const y = isSuccess || isDeadEnd ? 408 : order * 68;
      return {
        id: node.id,
        position: { x, y },
        data: { label: displayNodeLabel(node) },
        className: [
          "flow-node",
          isCurrent ? "flow-node-current" : "",
          !isCurrent ? "flow-node-muted" : "",
          isSuccess ? "flow-node-success" : "",
          isDeadEnd ? "flow-node-dead" : "",
        ].join(" "),
      };
    });
  }, [graph.nodes, currentNodeId]);

  const edges = useMemo<Edge[]>(() => {
    return graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.source === currentNodeId,
      type: "smoothstep",
      style: {
        strokeWidth: edge.source === currentNodeId ? 1.8 : 1.2,
        stroke: edge.source === currentNodeId ? "#8fb7ad" : "#d9dee6",
      },
    }));
  }, [graph.edges, currentNodeId]);

  return (
    <section className="panel graph-panel">
      <div className="panel-header">
        <h2>Граф переговоров</h2>
      </div>
      <div className="graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={0.4}
          maxZoom={1.4}
          nodesConnectable={false}
          nodesDraggable={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            setSelectedNode(graph.nodes.find((item) => item.id === node.id) ?? null);
          }}
        >
          <Background color="#eef1f4" gap={24} size={0.8} />
        </ReactFlow>
      </div>

      {selectedNode ? (
        <div className="node-details">
          <h3>{displayNodeLabel(selectedNode)}</h3>
          <p>{selectedNode.tutor_task}</p>
          <dl>
            <div>
              <dt>Настрой</dt>
              <dd>{selectedNode.counterparty_mood}</dd>
            </div>
            <div>
              <dt>Намерение</dt>
              <dd>{selectedNode.counterparty_intent}</dd>
            </div>
          </dl>
          <ul>
            {selectedNode.success_criteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
