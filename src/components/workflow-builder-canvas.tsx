type WorkflowBuilderCanvasProps = {
  edges: Array<{
    branchKey?: string | null;
    id: string;
    label?: string | null;
    sourceNodeId: string;
    targetNodeId: string;
  }>;
  nodes: Array<{
    actionType?: string | null;
    approvalRequired: boolean;
    conditionType?: string | null;
    config: unknown;
    id: string;
    label: string;
    name: string;
    nodeType: "TRIGGER" | "CONDITION" | "ACTION";
    positionX: number;
    positionY: number;
    triggerType?: string | null;
  }>;
};

function getNodeTone(nodeType: WorkflowBuilderCanvasProps["nodes"][number]["nodeType"]) {
  switch (nodeType) {
    case "TRIGGER":
      return "border-[rgba(61,122,88,0.24)] bg-[rgba(61,122,88,0.08)]";
    case "CONDITION":
      return "border-[rgba(171,133,58,0.24)] bg-[rgba(171,133,58,0.08)]";
    default:
      return "border-[rgba(55,92,153,0.22)] bg-[rgba(55,92,153,0.08)]";
  }
}

function formatNodeConfig(config: unknown) {
  if (!config || typeof config !== "object") {
    return null;
  }

  return JSON.stringify(config);
}

export function WorkflowBuilderCanvas({ edges, nodes }: WorkflowBuilderCanvasProps) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div className="overflow-x-auto rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
      <div className="text-lg font-semibold">Builder canvas</div>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Nodes represent triggers, conditions, and actions. Edges show the path between them for the current version.
      </p>
      <div className="relative mt-5 h-[560px] min-w-[960px] rounded-[2rem] border border-dashed border-[var(--color-line)] bg-[linear-gradient(to_right,rgba(32,43,69,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(32,43,69,0.04)_1px,transparent_1px)] [background-size:32px_32px]">
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {edges.map((edge) => {
            const sourceNode = nodeById.get(edge.sourceNodeId);
            const targetNode = nodeById.get(edge.targetNodeId);

            if (!sourceNode || !targetNode) {
              return null;
            }

            const startX = sourceNode.positionX + 170;
            const startY = sourceNode.positionY + 48;
            const endX = targetNode.positionX;
            const endY = targetNode.positionY + 48;
            const controlX = startX + (endX - startX) / 2;
            const pathDefinition = `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
            const labelX = startX + (endX - startX) / 2;
            const labelY = Math.min(startY, endY) - 12;

            return (
              <g key={edge.id}>
                <path
                  d={pathDefinition}
                  fill="none"
                  stroke="rgba(32,43,69,0.28)"
                  strokeWidth="2"
                />
                {edge.label ? (
                  <text
                    fill="rgba(32,43,69,0.62)"
                    fontSize="11"
                    textAnchor="middle"
                    x={labelX}
                    y={labelY}
                  >
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            className={`absolute w-[170px] rounded-2xl border px-4 py-4 shadow-sm ${getNodeTone(node.nodeType)}`}
            style={{ left: node.positionX, top: node.positionY }}
          >
            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
              <span>{node.nodeType}</span>
              {node.approvalRequired ? (
                <span className="rounded-full border border-[var(--color-line)] bg-white px-2 py-1 normal-case tracking-normal">
                  Approval
                </span>
              ) : null}
            </div>
            <div className="mt-2 font-medium">{node.name}</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">{node.label}</div>
            {formatNodeConfig(node.config) ? (
              <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-xs text-[var(--color-muted)]">
                {formatNodeConfig(node.config)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
