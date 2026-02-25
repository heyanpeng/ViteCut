---
title: 快速上手
---


`react-timeline-editor` 是基于react开发的，用于快速搭建时间线编辑能力的组件。

主要可用于构建动画编辑器、视频编辑器等。

![timeline](/assets/timeline.gif)


## 使用方式

```
npm install @xzdarcy/react-timeline-editor
```

```tsx | pure
import React from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';

export const TimelineEditor = () => {
  return (
    <Timeline     
      editorData={[]}
      effects={{}}
    />
  )
}
```
