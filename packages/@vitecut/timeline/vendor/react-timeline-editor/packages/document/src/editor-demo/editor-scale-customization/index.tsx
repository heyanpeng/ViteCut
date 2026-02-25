import { Timeline } from '@xzdarcy/react-timeline-editor';
import { Input } from 'antd';
import { cloneDeep } from 'lodash';
import { useState } from 'react';
import './index.less';
import { mockData, mockEffect } from './mock';

const defaultEditorData = cloneDeep(mockData);

const TimelineEditor = () => {
  const [data, setData] = useState(defaultEditorData);
  const [scale, setScale] = useState(5);
  const [scaleSplitCount, setScaleSplitCount] = useState(10);
  const [scaleWidth, setScaleWidth] = useState(160);
  const [startLeft, setStartLeft] = useState(20);

  return (
    <div className="timeline-editor-example1">
      <div className='timeline-editor-config'>
        <div className='timeline-editor-config-item'>
          <span>scale：</span>
          <Input
            value={scale}
            onChange={(e) => {
              let value = e.target.value.replace(/[^\d]/g, '');
              setScale(Number(value));
            }}
          />
        </div>
        <div className='timeline-editor-config-item'>
          <span>scaleSplitCount：</span>
          <Input
            value={scaleSplitCount}
            onChange={(e) => {
              let value = e.target.value.replace(/[^\d]/g, '');
              setScaleSplitCount(Number(value));
            }}
          />
        </div>
        <div className='timeline-editor-config-item'>
          <span>scaleWidth：</span>
          <Input
            value={scaleWidth}
            onChange={(e) => {
              let value = e.target.value.replace(/[^\d]/g, '');
              setScaleWidth(Number(value));
            }}
          />
        </div>
        <div className='timeline-editor-config-item'>
          <span>startLeft：</span>
          <Input
            value={startLeft}
            onChange={(e) => {
              let value = e.target.value.replace(/[^\d]/g, '');
              setStartLeft(Number(value));
            }}
          />
        </div>
      </div>
      <Timeline onChange={setData} autoScroll={true} editorData={data} effects={mockEffect} scale={scale} startLeft={startLeft} scaleSplitCount={scaleSplitCount} scaleWidth={scaleWidth} />
    </div>
  );
};

export default TimelineEditor;
