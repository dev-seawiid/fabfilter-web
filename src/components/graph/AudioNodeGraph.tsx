"use client";

import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  Background,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import SourceNode from "./nodes/SourceNode";
import AnalyserNodeDisplay from "./nodes/AnalyserNodeDisplay";
import FilterNode from "./nodes/FilterNode";
import GainNodeDisplay from "./nodes/GainNodeDisplay";
import DestinationNode from "./nodes/DestinationNode";
import SignalFlowEdge from "./edges/SignalFlowEdge";

/**
 * T055: AudioNodeGraph — Constitution I의 신호 흐름을 시각화.
 *
 * Source → AnalyserPre → Filter → Gain → AnalyserPost → Destination
 *
 * 정적 토폴로지이므로 노드/엣지를 모듈 레벨에서 정의한다.
 * React Flow는 DOM 기반이므로 Canvas 시각화와 성능 경쟁하지 않는다.
 */

// ── 커스텀 노드/엣지 타입 등록 ──

const nodeTypes: NodeTypes = {
  source: SourceNode,
  analyser: AnalyserNodeDisplay,
  filter: FilterNode,
  gain: GainNodeDisplay,
  destination: DestinationNode,
};

const edgeTypes: EdgeTypes = {
  signal: SignalFlowEdge,
};

// ── 정적 노드 배치 (좌→우, 수동 좌표) ──

const NODE_Y = 40;
const NODE_GAP_X = 180;

const initialNodes: Node[] = [
  {
    id: "source",
    type: "source",
    position: { x: 0, y: NODE_Y },
    data: {},
    draggable: false,
  },
  {
    id: "analyser-pre",
    type: "analyser",
    position: { x: NODE_GAP_X, y: NODE_Y },
    data: { variant: "pre" },
    draggable: false,
  },
  {
    id: "filter",
    type: "filter",
    position: { x: NODE_GAP_X * 2, y: NODE_Y },
    data: {},
    draggable: false,
  },
  {
    id: "gain",
    type: "gain",
    position: { x: NODE_GAP_X * 3, y: NODE_Y },
    data: {},
    draggable: false,
  },
  {
    id: "analyser-post",
    type: "analyser",
    position: { x: NODE_GAP_X * 4, y: NODE_Y },
    data: { variant: "post" },
    draggable: false,
  },
  {
    id: "destination",
    type: "destination",
    position: { x: NODE_GAP_X * 5, y: NODE_Y },
    data: {},
    draggable: false,
  },
];

// ── 정적 엣지 (5개 연결) ──

const initialEdges: Edge[] = [
  {
    id: "e-src-apre",
    source: "source",
    target: "analyser-pre",
    type: "signal",
  },
  {
    id: "e-apre-flt",
    source: "analyser-pre",
    target: "filter",
    type: "signal",
  },
  { id: "e-flt-gain", source: "filter", target: "gain", type: "signal" },
  {
    id: "e-gain-apost",
    source: "gain",
    target: "analyser-post",
    type: "signal",
  },
  {
    id: "e-apost-dest",
    source: "analyser-post",
    target: "destination",
    type: "signal",
  },
];

// ── React Flow 기본 옵션 ──

const proOptions = { hideAttribution: true };
const fitViewOptions = { padding: 0.15 };

export default function AudioNodeGraph() {
  return (
    <ReactFlow
      nodes={initialNodes}
      edges={initialEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      proOptions={proOptions}
      fitView
      fitViewOptions={fitViewOptions}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      className="!bg-transparent"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={0.5}
        color="rgba(255, 255, 255, 0.04)"
      />
    </ReactFlow>
  );
}
