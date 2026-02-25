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
        flexible: false,
        movable: false,
        start: 3,
        end: 4,
        effectId: "effect0",
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
        effectId: "effect1",
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
        effectId: "effect0",
      },
    ],
  },
  {
    id: "5",
    actions: [
      {
        id: "action50",
        start: 2,
        end: 7,
        effectId: "effect1",
      },
      {
        id: "action51",
        start: 8.5,
        end: 10,
        effectId: "effect0",
      },
    ],
  },
  {
    id: "6",
    actions: [
      {
        id: "action60",
        flexible: false,
        start: 1,
        end: 5.5,
        effectId: "effect1",
      },
    ],
  },
  {
    id: "7",
    actions: [
      {
        id: "action70",
        movable: false,
        start: 5,
        end: 7,
        effectId: "effect0",
      },
      {
        id: "action71",
        start: 9,
        end: 11,
        effectId: "effect1",
      },
    ],
  },
  {
    id: "8",
    actions: [
      {
        id: "action80",
        start: 2.5,
        end: 6,
        effectId: "effect0",
      },
    ],
  },
  {
    id: "9",
    actions: [
      {
        id: "action90",
        start: 0,
        end: 1.5,
        effectId: "effect1",
      },
      {
        id: "action91",
        start: 4,
        end: 6.5,
        effectId: "effect0",
      },
      {
        id: "action92",
        start: 7.5,
        end: 9,
        effectId: "effect1",
      },
    ],
  },
  {
    id: "10",
    actions: [
      {
        id: "action100",
        flexible: false,
        movable: false,
        start: 6,
        end: 8,
        effectId: "effect0",
      },
    ],
  },
  {
    id: "11",
    actions: [
      {
        id: "action110",
        start: 1.5,
        end: 4,
        effectId: "effect1",
      },
    ],
  },
  {
    id: "12",
    actions: [
      {
        id: "action120",
        start: 3,
        end: 5.5,
        effectId: "effect0",
      },
      {
        id: "action121",
        start: 7,
        end: 10,
        effectId: "effect1",
      },
    ],
  },
  {
    id: "13",
    actions: [
      {
        id: "action130",
        flexible: false,
        start: 0,
        end: 2.5,
        effectId: "effect1",
      },
      {
        id: "action131",
        start: 4.5,
        end: 7,
        effectId: "effect0",
      },
    ],
  },
];
