import React, { useState } from 'react';
import './index.less';
import { mockData, mockEffect } from './mock';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import { cloneDeep } from 'lodash';

interface RowDragProps {
  // 组件属性定义
}

const defaultEditorData = cloneDeep(mockData);

const RowDrag: React.FC<RowDragProps> = () => {
  const [data, setData] = useState(defaultEditorData);

  return (
    <div className="row-drag-container">
      <div className="page-header">
        <h1>RowDrag 示例</h1>
      </div>
      <p>这是 row-drag 示例的占位内容</p>
      <div className="row-drag-content">
        <Timeline
          onChange={setData}
          enableRowDrag={true}
          editorData={data}
          effects={mockEffect}
          hideCursor={false}
          autoScroll={true}
          onActionMoveEnd={() => {
            console.log('move end');
          }}
          onActionMoveStart={() => {
            console.log('move start');
          }}
          onActionMoving={() => {
            console.log('moveing');
          }}
          onClickRow={(row) => {
            console.log('click row', row);
          }}
          onRowDragStart={(params) => {
            console.log('row drag start', params.row);
          }}
          onRowDragEnd={(params) => {
            console.log('row drag end', params.row, params.editorData);
          }}
        />
      </div>
    </div>
  );
};

export default RowDrag;
