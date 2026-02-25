import { NoSSR, usePageData, withBase } from '@rspress/core/runtime';
import { useCallback, useState } from 'react';
import { Tab, Tabs } from 'rspress/theme';
import './Container.less';
import MobileOperation from './Operation';

type ContainerProps = {
  children: React.ReactNode[];
  demoId: string;
  names: string;
  iframeHeight?: number;
};

const Container: React.FC<ContainerProps> = (props) => {
  const { children, demoId, names, iframeHeight = 300 } = props;
  const nameArr = names.split(',');
  const { page } = usePageData();
  const [showCode, setShowCode] = useState(false);
  const url = `/~demo/${demoId}`;

  const getPageUrl = () => {
    if (page?.devPort) {
      return `http://localhost:${page.devPort}/${demoId}`;
    }
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${withBase(url)}`;
    }
    // Do nothing in ssr
    return '';
  };
  // const [iframeKey, setIframeKey] = useState(0);
  // const refresh = useCallback(() => {
  //   setIframeKey(Math.random());
  // }, []);

  const changeCodeVisible = useCallback(() => {
    setShowCode(!showCode);
  }, [showCode]);

  
  const codes = children.slice(1);
  return (
    <NoSSR>
      <div className="custom-preview">
        <div className="custom-preview-device">
          {children[0]}
          {/* <iframe src={getPageUrl()} key={iframeKey} height={iframeHeight}></iframe> */}
        </div>
        <MobileOperation url={getPageUrl()} changeCodeVisible={changeCodeVisible} />
        {showCode && (
          <div className="custom-preview-code">
            <Tabs>
              {codes.map((item, index) => {
                return (
                  <Tab key={nameArr[index]} label={nameArr[index]}>
                    {item}
                  </Tab>
                );
              })}
            </Tabs>
          </div>
        )}
      </div>
    </NoSSR>
  );
};

export default Container;
