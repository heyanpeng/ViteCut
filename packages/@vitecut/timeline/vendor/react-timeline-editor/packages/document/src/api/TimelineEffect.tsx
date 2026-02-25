import { useLang } from 'rspress/runtime';

export const TimelineEffect = () => {
  const lang = useLang();
  
  // 创建中英文字典
  const t = {
    '属性名': lang === 'zh' ? '属性名' : 'Property',
    '描述': lang === 'zh' ? '描述' : 'Description',
    '类型': lang === 'zh' ? '类型' : 'Type',
    '默认值': lang === 'zh' ? '默认值' : 'Default',
    '效果id': lang === 'zh' ? '效果id' : 'Effect ID',
    '效果名称': lang === 'zh' ? '效果名称' : 'Effect name',
    '效果运行代码': lang === 'zh' ? '效果运行代码' : 'Effect running code',
    '（必选）': lang === 'zh' ? '（必选）' : '(Required)',
    '--': lang === 'zh' ? '--' : '--',
  };
  
  return (
    <table>
      <thead>
        <tr>
          <th>{t['属性名']}</th>
          <th>{t['描述']}</th>
          <th>{t['类型']}</th>
          <th>{t['默认值']}</th>
        </tr>
      </thead>
      <tbody></tbody>
      <tbody>
        <tr>
          <td>id</td>
          <td>{t['效果id']}</td>
          <td>
            <code>string</code>
          </td>
          <td>
            <code>{t['（必选）']}</code>
          </td>
        </tr>
        <tr>
          <td>name</td>
          <td>{t['效果名称']}</td>
          <td>
            <code>string</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>source</td>
          <td>{t['效果运行代码']}</td>
          <td>
            <code>
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelineeffectsource`}>TimeLineEffectSource</a>
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export const TimeLineEffectSource = () => {
  const lang = useLang();
  
  // 创建中英文字典
  const t = {
    '属性名': lang === 'zh' ? '属性名' : 'Property',
    '描述': lang === 'zh' ? '描述' : 'Description',
    '类型': lang === 'zh' ? '类型' : 'Type',
    '默认值': lang === 'zh' ? '默认值' : 'Default',
    '在当前动作时间区域开始播放时回调': lang === 'zh' ? '在当前动作时间区域开始播放时回调' : 'Callback when starting to play in the current action time area',
    '时间进入动作时执行回调': lang === 'zh' ? '时间进入动作时执行回调' : 'Execute callback when time enters the action',
    '动作更新时回调': lang === 'zh' ? '动作更新时回调' : 'Callback when action updates',
    '时间离开动作时执行回调': lang === 'zh' ? '时间离开动作时执行回调' : 'Execute callback when time leaves the action',
    '在当前动作时间区域停止播放时回调': lang === 'zh' ? '在当前动作时间区域停止播放时回调' : 'Callback when stopping play in the current action time area',
    '--': lang === 'zh' ? '--' : '--',
  };
  
  return (
    <table>
      <thead>
        <tr>
          <th>{t['属性名']}</th>
          <th>{t['描述']}</th>
          <th>{t['类型']}</th>
          <th>{t['默认值']}</th>
        </tr>
      </thead>
      <tbody></tbody>
      <tbody>
        <tr>
          <td>start</td>
          <td>{t['在当前动作时间区域开始播放时回调']}</td>
          <td>
            <code>
              (param: <a href={`/${lang}/guide/intro/3-data-interface.html#effectsourceparam`}>EffectSourceParam</a>) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>enter</td>
          <td>{t['时间进入动作时执行回调']}</td>
          <td>
            <code>
              (param: <a href={`/${lang}/guide/intro/3-data-interface.html#effectsourceparam`}>EffectSourceParam</a>) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>update</td>
          <td>{t['动作更新时回调']}</td>
          <td>
            <code>(param: <a href={`/${lang}/guide/intro/3-data-interface.html#effectsourceparam`}>EffectSourceParam</a>) =&gt; void</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>leave</td>
          <td>{t['时间离开动作时执行回调']}</td>
          <td>
            <code>(param: <a href={`/${lang}/guide/intro/3-data-interface.html#effectsourceparam`}>EffectSourceParam</a>) =&gt; void</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>stop</td>
          <td>{t['在当前动作时间区域停止播放时回调']}</td>
          <td>
            <code>(param: <a href={`/${lang}/guide/intro/3-data-interface.html#effectsourceparam`}>EffectSourceParam</a>) =&gt; void</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export const EffectSourceParam = () => {
  const lang = useLang();
  const t = {
    '属性名': lang === 'zh' ? '属性名' : 'Property',
    '描述': lang === 'zh' ? '描述' : 'Description',
    '类型': lang === 'zh' ? '类型' : 'Type',
    '当前播放时间': lang === 'zh' ? '当前播放时间' : 'Current play time',
    '是否正在播放': lang === 'zh' ? '是否正在播放' : 'Is playing',
    '动作': lang === 'zh' ? '动作' : 'Action',
    '动作效果': lang === 'zh' ? '动作效果' : 'Action effect',
    '运行器': lang === 'zh' ? '运行器' : 'Engine',
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
          <td>time</td>
          <td>{t['当前播放时间']}</td>
          <td>
            <code>number</code>
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
          <td>action</td>
          <td>{t['动作']}</td>
          <td>
            <code>
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>
            </code>
          </td>
        </tr>
        <tr>
          <td>effect</td>
          <td>{t['动作效果']}</td>  
          <td>
            <code>
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelineeffect`}>TimelineEffect</a>
            </code>
          </td>
        </tr>
        <tr>
          <td>engine</td>
          <td>{t['运行器']}</td>
          <td>
            <code><a href={`/${lang}/guide/engine/2-api`}>TimelineEngine</a></code>
          </td>
        </tr>
      </tbody>
    </table>
  );
};
