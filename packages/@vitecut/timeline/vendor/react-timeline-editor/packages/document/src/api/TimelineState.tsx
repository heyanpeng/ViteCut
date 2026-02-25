import { useLang } from 'rspress/runtime';

export const TimelineState = () => {
  const lang = useLang();
  
  // 创建中英文字典
  const t = {
    '属性名': lang === 'zh' ? '属性名' : 'Property',
    '描述': lang === 'zh' ? '描述' : 'Description',
    '类型': lang === 'zh' ? '类型' : 'Type',
    'timeline所属的dom节点': lang === 'zh' ? 'timeline所属的dom节点' : 'DOM node that timeline belongs to',
    '运行监听器': lang === 'zh' ? '运行监听器' : 'Running listener',
    '是否正在播放': lang === 'zh' ? '是否正在播放' : 'Whether it is playing',
    '是否暂停中': lang === 'zh' ? '是否暂停中' : 'Whether it is paused',
    '设置当前播放时间': lang === 'zh' ? '设置当前播放时间' : 'Set current playback time',
    '获取当前播放时间': lang === 'zh' ? '获取当前播放时间' : 'Get current playback time',
    '设置播放速率': lang === 'zh' ? '设置播放速率' : 'Set playback rate',
    '获取播放速率': lang === 'zh' ? '获取播放速率' : 'Get playback rate',
    '重新渲染当前时间': lang === 'zh' ? '重新渲染当前时间' : 'Re-render current time',
    '运行': lang === 'zh' ? '运行' : 'Run',
    '暂停': lang === 'zh' ? '暂停' : 'Pause',
    '设置scrollLeft': lang === 'zh' ? '设置scrollLeft' : 'Set scrollLeft',
    '设置scrollTop': lang === 'zh' ? '设置scrollTop' : 'Set scrollTop',
  };
  
  return (
    <table>
      <thead>
        <tr>
          <th>{t['属性名']}</th>
          <th>{t['描述']}</th>
          <th>{t['类型']}</th>
        </tr>
      </thead>
      <tbody></tbody>
      <tbody>
        <tr>
          <td>target</td>
          <td>{t['timeline所属的dom节点']}</td>
          <td>
            <code>HTMLElement</code>
          </td>
        </tr>
        <tr>
          <td>listener</td>
          <td>{t['运行监听器']}</td>
          <td>
            <code>Emitter</code>
          </td>
        </tr>
        <tr>
          <td>isPlaying</td>
          <td>{t['是否正在播放']}</td>
          <td>
            <code>boolean</code>
          </td>
        </tr>
        <tr>
          <td>isPaused</td>
          <td>{t['是否暂停中']}</td>
          <td>
            <code>boolean</code>
          </td>
        </tr>
        <tr>
          <td>setTime</td>
          <td>{t['设置当前播放时间']}</td>
          <td>
            <code>(time: number) =&gt; void</code>
          </td>
        </tr>
        <tr>
          <td>getTime</td>
          <td>{t['获取当前播放时间']}</td>
          <td>
            <code>() =&gt; number</code>
          </td>
        </tr>
        <tr>
          <td>setPlayRate</td>
          <td>{t['设置播放速率']}</td>
          <td>
            <code>(rate: number) =&gt; void</code>
          </td>
        </tr>
        <tr>
          <td>getPlayRate</td>
          <td>{t['获取播放速率']}</td>
          <td>
            <code>() =&gt; number</code>
          </td>
        </tr>
        <tr>
          <td>reRender</td>
          <td>{t['重新渲染当前时间']}</td>
          <td>
            <code>() =&gt; void</code>
          </td>
        </tr>
        <tr>
          <td>play</td>
          <td>{t['运行']}</td>
          <td>
            <code>
              (param: {'{'} toTime?: number; autoEnd?: boolean; {'}'}) =&gt; boolean
            </code>
          </td>
        </tr>
        <tr>
          <td>pause</td>
          <td>{t['暂停']}</td>
          <td>
            <code>() =&gt; void</code>
          </td>
        </tr>
        <tr>
          <td>setScrollLeft</td>
          <td>{t['设置scrollLeft']}</td>
          <td>
            <code>(val: number) =&gt; void</code>
          </td>
        </tr>
        <tr>
          <td>setScrollTop</td>
          <td>{t['设置scrollTop']}</td>
          <td>
            <code>(val: number) =&gt; void</code>
          </td>
        </tr>
      </tbody>
    </table>
  );
};
