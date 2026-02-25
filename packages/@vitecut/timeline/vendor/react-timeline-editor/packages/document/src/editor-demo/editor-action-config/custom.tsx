import React, { FC } from 'react';
import { TimelineAction, TimelineRow } from '@xzdarcy/timeline-engine';

export const CustomRender0: FC<{ action: TimelineAction; row: TimelineRow }> =
  ({ action, row }) => {
    return (
      <div className={'effect0'}>
        <div className={`effect0-text`}>{`Play Audio: ${(
          action.end - action.start
        ).toFixed(2)}s ${action.movable === false ? '（Cannot Move）' : ''} ${
          action.flexible === false ? '（Cannot Scale）' : ''
        }`}</div>
      </div>
    );
  };

export const CustomRender1: FC<{ action: TimelineAction; row: TimelineRow }> =
  ({ action, row }) => {
    return <div className={'effect1'}>
      <img src="/assets/flag.png"></img>
    </div>;
  };
