// 应用配置接口 - 合并了路由和示例的配置
// 这个接口包含了路由配置和示例展示所需的所有字段
export interface AppConfig {
  id: string;
  path: string;
  componentName: string;
  title: string;
  description: string;
  route: string;
  icon: string;
  color: string;
  status: 'ready' | 'planned' | 'development';
}

// 应用配置数组 - 统一管理所有示例的路由和展示信息
export const appConfigs: AppConfig[] = [
  {
    id: 'row-drag',
    path: '/row-drag',
    componentName: 'RowDrag',
    title: 'RowDrag',
    description: 'RowDrag 示例描述',
    route: '/row-drag',
    icon: '⭐',
    color: '#b15a40',
    status: 'ready',
  },
  {
    id: 'main',
    path: '/main',
    componentName: 'MainPage',
    title: '主页面',
    description: '所有示例的导航页面',
    route: '/main',
    icon: '🏠',
    color: '#007acc',
    status: 'planned',
  },
  {
    id: 'basic',
    path: '/basic',
    componentName: 'BasicExample',
    title: '基础示例',
    description: '展示React基础功能和组件交互',
    route: '/basic',
    icon: '⚛️',
    color: '#007acc',
    status: 'planned',
  },
  {
    id: 'timeline',
    path: '/timeline',
    componentName: 'TimelineExample',
    title: '时间线编辑器',
    description: '时间线编辑器的基本功能演示',
    route: '/timeline',
    icon: '⏰',
    color: '#ff6b6b',
    status: 'planned',
  },
  // {
  //   id: 'animation',
  //   path: '/animation',
  //   componentName: 'AnimationExample',
  //   title: '动画示例',
  //   description: 'CSS动画效果和过渡演示',
  //   route: '/animation',
  //   icon: '🎬',
  //   color: '#51cf66',
  //   status: 'planned',
  // },
  // {
  //   id: 'advanced',
  //   path: '/advanced',
  //   componentName: 'AdvancedExample',
  //   title: '高级功能',
  //   description: '时间线编辑器的高级特性',
  //   route: '/advanced',
  //   icon: '🚀',
  //   color: '#fcc419',
  //   status: 'planned',
  // },
  // {
  //   id: 'integration',
  //   path: '/integration',
  //   componentName: 'IntegrationExample',
  //   title: '集成示例',
  //   description: '与其他库的集成演示',
  //   route: '/integration',
  //   icon: '🔗',
  //   color: '#ae3ec9',
  //   status: 'planned',
  // },
  // {
  //   id: 'customization',
  //   path: '/customization',
  //   componentName: 'CustomizationExample',
  //   title: '自定义主题',
  //   description: '主题定制和样式扩展',
  //   route: '/customization',
  //   icon: '🎨',
  //   color: '#20c997',
  //   status: 'development',
  // },
];

// 获取可用的路由配置（状态为ready）
export const getAvailableRoutes = () => {
  return appConfigs.filter((config) => config.status === 'ready');
};

// 获取所有示例配置（用于主页面展示）
export const getExamples = () => {
  return appConfigs.filter((config) => config.id !== 'main');
};

// 根据ID查找配置
export const findConfigById = (id: string) => {
  return appConfigs.find((config) => config.id === id);
};

// 添加新配置（用于创建示例脚本）
export const addConfig = (configData: Omit<AppConfig, 'componentName' | 'route' | 'path'>) => {
  const newConfig: AppConfig = {
    ...configData,
    componentName: capitalizeFirst(configData.id),
    route: `/${configData.id}`,
    path: `/${configData.id}`,
  };

  appConfigs.push(newConfig);
  return newConfig;
};

// 辅助函数：首字母大写
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 导出路由配置（兼容原有接口）
export const routes = appConfigs.map((config) => ({
  id: config.id,
  path: config.path,
  componentName: config.componentName,
  title: config.title,
  description: config.description,
  status: config.status,
}));

// 导出示例配置（兼容原有接口）
export const examples = appConfigs
  .filter((config) => config.id !== 'main')
  .map((config) => ({
    id: config.id,
    title: config.title,
    description: config.description,
    route: config.route,
    icon: config.icon,
    color: config.color,
    status: config.status,
  }));
