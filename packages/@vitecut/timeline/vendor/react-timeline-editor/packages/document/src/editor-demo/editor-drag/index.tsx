import { Timeline } from '@xzdarcy/react-timeline-editor';
import { cloneDeep } from 'lodash';
import React, { useState } from 'react';
import './index.less';
import { mockData, mockEffect } from './mock';

const defaultEditorData = cloneDeep(mockData);

const TimelineEditor = () => {
  const [data, setData] = useState(defaultEditorData);

  return (
    <div className="timeline-editor-example-drag">
      <Timeline
        onChange={setData}
        editorData={data}
        effects={mockEffect}
        hideCursor={false}
        enableRowDrag={true}
        onRowDragStart={(params) => {
          console.log('Row drag start:', params.row.id);
        }}
        onRowDragEnd={(params) => {
          console.log('Row drag end:', params.row.id);
        }}
      />
    </div>
  );
};

export default TimelineEditor;
