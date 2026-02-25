import Theme from 'rspress/theme';
import { AfterHero } from './AfterHero';

// 以下展示所有的 Props
const Layout = () => (
  <Theme.Layout
    /* Home 页 Hero 部分之后 */
    afterHero={<AfterHero />}
  />
);

export default {
  ...Theme,
  Layout,
};

export * from 'rspress/theme';
