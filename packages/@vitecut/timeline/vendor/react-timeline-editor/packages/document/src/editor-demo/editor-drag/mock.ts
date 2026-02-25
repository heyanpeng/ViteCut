import { TimelineEffect, TimelineRow } from '@xzdarcy/timeline-engine';

export const mockEffect: Record<string, TimelineEffect> = {
  effect0: {
    id: "effect0",
    name: "效果0",
  },
  effect1: {
    id: "effect1",
    name: "效果1",
  },
  effect2: {
    id: "effect2",
    name: "效果2",
  },
};

export const mockData: TimelineRow[] = [
  {
    id: "0",
    actions: [
      {
        id: "action00",
        start: 0,
        end: 2,
        effectId: "effect0",
      },
    ],
  },
  {
    id: "1",
    actions: [
      {
        id: "action10",
        start: 1.5,
        end: 5,
        effectId: "effect1",
      }
    ],
  },
  {
    id: "2",
    actions: [
      {
        id: "action20",
        start: 3,
        end: 4,
        effectId: "effect2",
      },
    ],
  },
  {
    id: "3",
    actions: [
      {
        id: "action30",
        start: 4,
        end: 4.5,
        effectId: "effect0",
      },
      {
        id: "action31",
        start: 6,
        end: 8,
        effectId: "effect1",
      },
    ],
  },
  {
    id: "4",
    actions: [
      {
        id: "action40",
        start: 0.5,
        end: 3,
        effectId: "effect2",
      },
    ],
  },
  {
    id: "5",
    actions: [
      {
        id: "action50",
        start: 2,
        end: 6,
        effectId: "effect0",
      },
      {
        id: "action51",
        start: 7,
        end: 9,
        effectId: "effect1",
      },
    ],
  },
  {
    id: "6",
    actions: [
      {
        id: "action60",
        start: 1,
        end: 4,
        effectId: "effect1",
      },
    ],
  },
  {
    id: "7",
    actions: [
      {
        id: "action70",
        start: 3.5,
        end: 5.5,
        effectId: "effect2",
      },
      {
        id: "action71",
        start: 8,
        end: 10,
        effectId: "effect0",
      },
    ],
  },
  {
    id: "8",
    actions: [
      {
        id: "action80",
        start: 0,
        end: 1.5,
        effectId: "effect1",
      },
    ],
  },
  {
    id: "9",
    actions: [
      {
        id: "action90",
        start: 5,
        end: 8,
        effectId: "effect2",
      },
    ],
  },
];
