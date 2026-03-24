export type WorkflowRunStatus = "running" | "idle" | "failed";

export interface WorkflowListItem {
  id: string;
  name: string;
  status: WorkflowRunStatus;
  nodeCount: number;
  lastRun: string;
}

export interface GetWorkflowListParams {
  search?: string;
  status?: "all" | WorkflowRunStatus;
}

let MOCK_WORKFLOW_LIST: WorkflowListItem[] = [
  {
    id: "wf-01",
    name: "电商主图批量生成",
    status: "running",
    nodeCount: 8,
    lastRun: "2分钟前",
  },
  {
    id: "wf-02",
    name: "短视频封面自动出图",
    status: "idle",
    nodeCount: 6,
    lastRun: "今天 13:24",
  },
  {
    id: "wf-03",
    name: "人物设定图反推与重绘",
    status: "failed",
    nodeCount: 9,
    lastRun: "今天 10:08",
  },
  {
    id: "wf-04",
    name: "商品图转视频首尾帧链路",
    status: "idle",
    nodeCount: 11,
    lastRun: "昨天 20:16",
  },
  {
    id: "wf-05",
    name: "人像写真风格统一出图",
    status: "running",
    nodeCount: 7,
    lastRun: "刚刚",
  },
  {
    id: "wf-06",
    name: "商品白底图自动抠图与修图",
    status: "idle",
    nodeCount: 10,
    lastRun: "今天 09:42",
  },
  {
    id: "wf-07",
    name: "教育课件封面批量生成",
    status: "failed",
    nodeCount: 5,
    lastRun: "今天 08:17",
  },
  {
    id: "wf-08",
    name: "旅行 Vlog 首尾帧自动补全",
    status: "running",
    nodeCount: 12,
    lastRun: "1分钟前",
  },
  {
    id: "wf-09",
    name: "品牌海报多尺寸同步导出",
    status: "idle",
    nodeCount: 9,
    lastRun: "昨天 18:05",
  },
  {
    id: "wf-10",
    name: "动漫角色设定图重绘链路",
    status: "failed",
    nodeCount: 8,
    lastRun: "昨天 14:21",
  },
  {
    id: "wf-11",
    name: "短剧剧情分镜批量生成",
    status: "running",
    nodeCount: 13,
    lastRun: "3分钟前",
  },
  {
    id: "wf-12",
    name: "新媒体卡点视频画面生成",
    status: "idle",
    nodeCount: 6,
    lastRun: "今天 11:30",
  },
  {
    id: "wf-13",
    name: "产品详情页卖点图自动排版",
    status: "idle",
    nodeCount: 14,
    lastRun: "昨天 22:09",
  },
  {
    id: "wf-14",
    name: "活动 KV 海报与横版封面联动生成",
    status: "failed",
    nodeCount: 15,
    lastRun: "今天 07:55",
  },
  {
    id: "wf-15",
    name: "二次元头像风格迁移与修复",
    status: "running",
    nodeCount: 9,
    lastRun: "5分钟前",
  },
  {
    id: "wf-16",
    name: "知识科普图文视频封面自动化流程",
    status: "idle",
    nodeCount: 11,
    lastRun: "昨天 16:44",
  },
];

export async function getWorkflowList(
  params: GetWorkflowListParams = {}
): Promise<WorkflowListItem[]> {
  const search = (params.search ?? "").trim().toLowerCase();
  const status = params.status ?? "all";

  // Current implementation uses local mock data; replace with fetch('/api/workflows')
  // when backend endpoint is ready.
  await Promise.resolve();

  return MOCK_WORKFLOW_LIST.filter((item) => {
    const statusMatch = status === "all" || item.status === status;
    const searchMatch = !search || item.name.toLowerCase().includes(search);
    return statusMatch && searchMatch;
  });
}

export async function deleteWorkflow(id: string): Promise<void> {
  // Current implementation uses local mock data; replace with DELETE /api/workflows/:id
  // when backend endpoint is ready.
  await Promise.resolve();
  MOCK_WORKFLOW_LIST = MOCK_WORKFLOW_LIST.filter((item) => item.id !== id);
}
