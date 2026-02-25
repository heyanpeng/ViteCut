import React from 'react';
import ReactDOM from 'react-dom/client';
import RowDrag from '../components/row-drag';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <RowDrag />
  </React.StrictMode>
);
