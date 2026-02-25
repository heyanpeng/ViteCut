---
title: Getting Started
---


`react-timeline-editor` is a React-based component for quickly building timeline editing capabilities.

It can be mainly used to build animation editors, video editors, etc.

![timeline](/assets/timeline.gif)


## Installation

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
