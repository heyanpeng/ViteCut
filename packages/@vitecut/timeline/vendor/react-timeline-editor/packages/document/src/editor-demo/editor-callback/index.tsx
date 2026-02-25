import { Timeline } from '@xzdarcy/react-timeline-editor';
import { cloneDeep } from 'lodash';
import React, { useState } from 'react';
import './index.less';
import { mockData, mockEffect } from './mock';

const defaultEditorData = cloneDeep(mockData);

const TimelineEditor = () => {
  const [data, setData] = useState(defaultEditorData);

  return (
    <div className="timeline-editor-example5">
      <Timeline
        onChange={setData}
        editorData={data}
        effects={mockEffect}
        hideCursor={false}
        getActionRender={(action) => {
          if(action.id === 'action10') {
            return <div className="prompt">Can only resize from the left</div>
          }
        }}
        onActionResizing={({action, dir}) => {
          if(action.id === 'action10' && dir !== 'left') return false;
        }}
      />
    </div>
  );
};

export default TimelineEditor;
