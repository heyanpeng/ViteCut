import { snowflake } from "@vitecut/utils";
import { MarkerType, type Edge } from "@xyflow/react";
import { NODE_LIBRARY } from "./workflowConfig";
import type { WorkflowFlowNode } from "./workflowTypes";

export const createInitialFlow = (): { nodes: WorkflowFlowNode[]; edges: Edge[] } => {
  const nodeIds = {
    prompt: snowflake(),
    reference: snowflake(),
    image: snowflake(),
    video: snowflake(),
    save: snowflake(),
    timeline: snowflake(),
    reverse: snowflake(),
    optimize: snowflake(),
    params: snowflake(),
  } as const;

  const nodes: WorkflowFlowNode[] = [
    {
      id: nodeIds.prompt,
      type: "workflowNode",
      position: { x: 80, y: 110 },
      data: { ...NODE_LIBRARY[0] },
    },
    {
      id: nodeIds.reference,
      type: "workflowNode",
      position: { x: 80, y: 300 },
      data: { ...NODE_LIBRARY[1] },
    },
    {
      id: nodeIds.image,
      type: "workflowNode",
      position: { x: 620, y: 180 },
      data: { ...NODE_LIBRARY[5] },
    },
    {
      id: nodeIds.video,
      type: "workflowNode",
      position: { x: 900, y: 180 },
      data: { ...NODE_LIBRARY[6] },
    },
    {
      id: nodeIds.save,
      type: "workflowNode",
      position: { x: 1200, y: 90 },
      data: { ...NODE_LIBRARY[7] },
    },
    {
      id: nodeIds.timeline,
      type: "workflowNode",
      position: { x: 1200, y: 270 },
      data: { ...NODE_LIBRARY[8] },
    },
    {
      id: nodeIds.reverse,
      type: "workflowNode",
      position: { x: 320, y: 80 },
      data: { ...NODE_LIBRARY[2] },
    },
    {
      id: nodeIds.optimize,
      type: "workflowNode",
      position: { x: 320, y: 230 },
      data: { ...NODE_LIBRARY[3] },
    },
    {
      id: nodeIds.params,
      type: "workflowNode",
      position: { x: 320, y: 380 },
      data: { ...NODE_LIBRARY[4] },
    },
  ];

  const edges: Edge[] = [
    {
      id: snowflake(),
      source: nodeIds.prompt,
      target: nodeIds.optimize,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#79ffe1", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.reference,
      target: nodeIds.reverse,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#7dd3fc", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.reverse,
      target: nodeIds.optimize,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#34d399", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.optimize,
      target: nodeIds.params,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#22c55e", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.params,
      target: nodeIds.image,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#f59e0b", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.image,
      target: nodeIds.video,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#fda4af", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.video,
      target: nodeIds.save,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#d8b4fe", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.image,
      target: nodeIds.timeline,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#67e8f9", strokeWidth: 2 },
    },
  ];

  return { nodes, edges };
};

export const { nodes: INITIAL_NODES, edges: INITIAL_EDGES } = createInitialFlow();
