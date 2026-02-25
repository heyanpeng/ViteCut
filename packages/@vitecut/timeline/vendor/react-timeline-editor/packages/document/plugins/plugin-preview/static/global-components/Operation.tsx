import { useLang } from '@rspress/core/runtime';
import { useCallback, useEffect, useRef, useState } from 'react';
import IconCode from './icons/Code';
import IconLaunch from './icons/Launch';
import IconRefresh from './icons/Refresh';
import './Operation.less';

const locales = {
  zh: {
    refresh: '刷新页面',
    goBack: '返回',
    open: '在新页面打开',
  },
  en: {
    refresh: 'Refresh',
    goBack: 'Go back',
    open: 'Open in new page',
  },
};

const MobileOperation = (props: { url: string; changeCodeVisible: () => void; refresh?: () => void; }) => {
  const { url, changeCodeVisible, refresh } = props;
  const [showQRCode, setShowQRCode] = useState(false);
  const lang = useLang();
  const triggerRef = useRef(null);
  const t = lang === 'zh' ? locales.zh : locales.en;

  const openNewPage = () => {
    window.open(url);
  };

  const contains = function (root: HTMLElement | null, ele: Node | null) {
    if (!root) {
      return false;
    }
    if (root.contains) {
      return root.contains(ele);
    }
    let node = ele;
    while (node) {
      if (node === root) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  };

  const onClickOutside = useCallback(
    (ev: MouseEvent) => {
      if (!contains(triggerRef.current, ev.target as Node)) {
        setShowQRCode(false);
      }
    },
    [triggerRef],
  );

  useEffect(() => {
    if (showQRCode) {
      document.addEventListener('mousedown', onClickOutside, false);
    } else {
      document.removeEventListener('mousedown', onClickOutside, false);
    }
  }, [showQRCode]);

  return (
    <div className={'custom-preview-operations'}>
      <div className="custom-preview-operations-left">
        {refresh && (
          <button onClick={refresh} aria-label={t.refresh} className="operations-refresh">
            <IconRefresh />
          </button>
        )}
        <button onClick={openNewPage} aria-label={t.open} className="operations-open">
          <IconLaunch />
        </button>
      </div>
      <div className="custom-preview-operations-right">
        <button onClick={changeCodeVisible} aria-label={t.open} className="operations-open">
          <IconCode />
        </button>
      </div>
    </div>
  );
};

export default MobileOperation;
