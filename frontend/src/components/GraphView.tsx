import { useMemo, useState } from "react";
import ReactFlow, { Background, MarkerType, type Edge, type Node } from "reactflow";
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

const MAIN_NODE_X = 150;
const SUCCESS_NODE_X = 42;
const DEAD_END_NODE_X = 258;
const NODE_Y_STEP = 76;
const TERMINAL_Y = 456;

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

function graphNodeOrder(node: GraphNode, index: number) {
  return nodeOrder[node.type] ?? index + 0.5;
}

function progressionNodes(graph: GraphJson) {
  return graph.nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.type !== "dead_end")
    .sort((left, right) => {
      const orderDiff = graphNodeOrder(left.node, left.index) - graphNodeOrder(right.node, right.index);
      return orderDiff || left.index - right.index;
    })
    .map(({ node }) => node);
}

export default function GraphView({ graph, currentNodeId }: GraphViewProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const nodes = useMemo<Node[]>(() => {
    return graph.nodes.map((node, index) => {
      const order = nodeOrder[node.type] ?? index;
      const isCurrent = node.id === currentNodeId;
      const isSuccess = node.type === "success";
      const isDeadEnd = node.type === "dead_end";
      const x = isSuccess ? SUCCESS_NODE_X : isDeadEnd ? DEAD_END_NODE_X : MAIN_NODE_X;
      const y = isSuccess || isDeadEnd ? TERMINAL_Y : order * NODE_Y_STEP;
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
    const path = progressionNodes(graph);

    return path.slice(0, -1).map((node, index) => ({
      id: `main-${node.id}-${path[index + 1].id}`,
      source: node.id,
      target: path[index + 1].id,
      animated: node.id === currentNodeId,
      type: "smoothstep",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
        color: node.id === currentNodeId ? "#6f9f93" : "#d9dee6",
      },
      style: {
        strokeWidth: node.id === currentNodeId ? 2 : 1.25,
        stroke: node.id === currentNodeId ? "#6f9f93" : "#d9dee6",
      },
    }));
  }, [graph, currentNodeId]);

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
