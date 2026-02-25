import React from 'react';
import { useNavigate } from 'react-router-dom';
import { examples } from '../../config/app-config';
import './index.less';

const MainPage: React.FC = () => {
  const getStatusBadge = (status: 'ready' | 'planned' | 'development') => {
    const statusConfig = {
      ready: { text: '可用', color: '#28a745', bgColor: '#d4edda' },
      development: { text: '开发中', color: '#ffc107', bgColor: '#fff3cd' },
      planned: { text: '计划中', color: '#6c757d', bgColor: '#e9ecef' },
    };

    const config = statusConfig[status];
    return (
      <span
        style={{
          padding: '2px 8px',
          fontSize: '12px',
          borderRadius: '12px',
          color: config.color,
          backgroundColor: config.bgColor,
          fontWeight: 'bold',
        }}
      >
        {config.text}
      </span>
    );
  };

  const navigate = useNavigate();

  const handleExampleClick = (example: typeof examples[number]) => {
    if (example.status === 'ready') {
      // 使用React Router进行导航
      navigate(example.route);
    } else {
      alert(`示例 "${example.title}" 当前不可用或正在开发中。`);
    }
  };

  return (
    <div className="main-page">
      {/* 头部 */}
      <div className="header">
        <h1>React Timeline Editor</h1>
        <p>示例项目导航</p>
        <div className="launcher-info">
          <span style={{ marginRight: '8px' }}>🚀</span>
          使用启动器选择不同的示例进行测试
        </div>
      </div>

      {/* 示例网格 */}
      <div className="examples-grid">
        {examples.map((example) => (
          <div
            key={example.id}
            onClick={() => handleExampleClick(example)}
            className={`example-card ${example.status === 'ready' ? 'ready' : ''}`}
            style={
              {
                '--example-color': example.color,
              } as React.CSSProperties
            }
          >
            {/* 状态角标 */}
            <div className="status-badge">{getStatusBadge(example.status)}</div>

            {/* 图标 */}
            <div className="example-icon">{example.icon}</div>

            {/* 标题 */}
            <h3 className="example-title">{example.title}</h3>

            {/* 描述 */}
            <p className="example-description">{example.description}</p>

            {/* 操作按钮 */}
            <div className="example-action">
              <button disabled={example.status !== 'ready'} className={example.status === 'ready' ? 'ready' : ''}>
                {example.status === 'ready' ? '启动示例' : '即将推出'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 使用说明 */}
      <div className="instructions">
        <h3>使用说明</h3>
        <div style={{ display: 'grid', gap: '15px' }}>
          <div className="step-item">
            <div className="step-number" style={{ '--step-color': '#007acc' } as React.CSSProperties}>
              1
            </div>
            <div className="step-content">
              <strong>启动开发服务器</strong>
              <p>
                在项目根目录执行: <code>yarn example run</code>
              </p>
            </div>
          </div>

          <div className="step-item">
            <div className="step-number" style={{ '--step-color': '#51cf66' } as React.CSSProperties}>
              2
            </div>
            <div className="step-content">
              <strong>选择示例</strong>
              <p>在启动器中选择要测试的示例页面</p>
            </div>
          </div>

          <div className="step-item">
            <div className="step-number" style={{ '--step-color': '#fcc419' } as React.CSSProperties}>
              3
            </div>
            <div className="step-content">
              <strong>开始开发</strong>
              <p>开发服务器将自动启动，支持热重载</p>
            </div>
          </div>
        </div>
      </div>

      {/* 页脚 */}
      <div className="footer">
        <p>React Timeline Editor Example - 开发测试环境</p>
      </div>
    </div>
  );
};

export default MainPage;
