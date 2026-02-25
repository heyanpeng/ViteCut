import { useLang } from 'rspress/runtime';

export const TimelineRow = () => {
  const lang = useLang();
  
  // 创建中英文字典
  const t = {
    '属性名': lang === 'zh' ? '属性名' : 'Property',
    '描述': lang === 'zh' ? '描述' : 'Description',
    '类型': lang === 'zh' ? '类型' : 'Type',
    '默认值': lang === 'zh' ? '默认值' : 'Default',
    '动作行id': lang === 'zh' ? '动作行id' : 'Action row ID',
    '行的动作列表': lang === 'zh' ? '行的动作列表' : 'Action list of the row',
    '自定义行高（默认由props中的rowHeight决定）': lang === 'zh' ? '自定义行高（默认由props中的rowHeight决定）' : 'Custom row height (determined by rowHeight in props by default)',
    '行是否选中': lang === 'zh' ? '行是否选中' : 'Whether the row is selected',
    '行的扩展类名': lang === 'zh' ? '行的扩展类名' : 'Extended class name of the row',
    '（必选）': lang === 'zh' ? '（必选）' : '(Required)',
    '--': lang === 'zh' ? '--' : '--',
    'false': lang === 'zh' ? 'false' : 'false',
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
          <td>{t['动作行id']}</td>
          <td>
            <code>string</code>
          </td>
          <td>
            <code>{t['（必选）']}</code>
          </td>
        </tr>
        <tr>
          <td>actions</td>
          <td>{t['行的动作列表']}</td>
          <td>
            <code>
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>[]
            </code>
          </td>
          <td>
            <code>{t['（必选）']}</code>
          </td>
        </tr>
        <tr>
          <td>rowHeight</td>
          <td>{t['自定义行高（默认由props中的rowHeight决定）']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>selected</td>
          <td>{t['行是否选中']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>{t['false']}</code>
          </td>
        </tr>
        <tr>
          <td>classNames</td>
          <td>{t['行的扩展类名']}</td>
          <td>
            <code>string[]</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
      </tbody>
    </table>
  );
};
