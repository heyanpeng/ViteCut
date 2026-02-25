import { pluginPreview } from './plugins/plugin-preview';
import * as path from 'node:path';
import { defineConfig } from 'rspress/config';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  globalStyles: path.join(__dirname, 'styles/index.css'),
  title: 'React Timeline Editor',
  icon: '/icon.png',
  logoText: 'React Timeline Editor',
  lang: 'en',
  ssg: false,
  logo: {
    light: '/icon.png',
    dark: '/icon.png',
  },
  markdown: {
    showLineNumbers: true,
    defaultWrapCode: true,
  },
  locales: [
    {
      lang: 'en',
      // 导航栏切换语言的标签
      label: 'English',
      title: 'Rspress',
      description: 'Static Site Generator',
    },
    {
      lang: 'zh',
      label: '简体中文',
      title: 'Rspress',
      description: '静态网站生成器',
    },
  ],
  themeConfig: {
    locales: [
      {
        lang: 'en',
        label: 'English',
        searchPlaceholderText: 'Search Docs',
      },
      {
        lang: 'zh',
        label: '简体中文',
        searchPlaceholderText: '搜索文档',
      },
    ],
    darkMode: false,
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/xzdarcy/react-timeline-editor',
      },
    ],
  },
  plugins: [
    pluginPreview({
      iframeOptions: {
        builderConfig: {
          resolve: {
            alias: {
              '@xzdarcy/react-timeline-editor': path.join(__dirname, '../timeline/src/index.tsx'),
              '@src': path.join(__dirname, 'src'),
            },
          },
        },
      },
      previewLanguages: ['jsx', 'tsx', 'css', 'less', 'ts'],
    }),
  ],
  builderConfig: {
    server: {
      middlewareMode: false,
    },
    resolve: {
      alias: {
        '@xzdarcy/react-timeline-editor': path.join(__dirname, '../timeline/src/index.tsx'),
        '@src': path.join(__dirname, 'src'),
      },
    },
  },
});
