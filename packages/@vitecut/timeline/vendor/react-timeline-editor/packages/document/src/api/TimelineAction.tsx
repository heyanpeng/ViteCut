import { useLang } from 'rspress/runtime';

export const TimelineAction = () => {
  const lang = useLang();
  
  // 创建中英文字典
  const t = {
    '属性名': lang === 'zh' ? '属性名' : 'Property',
    '描述': lang === 'zh' ? '描述' : 'Description',
    '类型': lang === 'zh' ? '类型' : 'Type',
    '默认值': lang === 'zh' ? '默认值' : 'Default',
    '动作id': lang === 'zh' ? '动作id' : 'Action ID',
    '动作开始时间': lang === 'zh' ? '动作开始时间' : 'Action start time',
    '动作结束时间': lang === 'zh' ? '动作结束时间' : 'Action end time',
    '动作所对应的效果id索引': lang === 'zh' ? '动作所对应的效果id索引' : 'Effect ID index corresponding to the action',
    '动作是否被选中': lang === 'zh' ? '动作是否被选中' : 'Whether the action is selected',
    '动作是否可伸缩': lang === 'zh' ? '动作是否可伸缩' : 'Whether the action can be resized',
    '动作是否可移动': lang === 'zh' ? '动作是否可移动' : 'Whether the action can be moved',
    '禁止动作运行': lang === 'zh' ? '禁止动作运行' : 'Disable action running',
    '动作最小开始时间限制': lang === 'zh' ? '动作最小开始时间限制' : 'Minimum start time limit for action',
    '（必选）': lang === 'zh' ? '（必选）' : '(Required)',
    '动作最大结束时间限制': lang === 'zh' ? '动作最大结束时间限制' : 'Maximum end time limit for action',
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
          <td>{t['动作id']}</td>
          <td>
            <code>string</code>
          </td>
          <td>
            <code>{t['（必选）']}</code>
          </td>
        </tr>
        <tr>
          <td>start</td>
          <td>{t['动作开始时间']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['（必选）']}</code>
          </td>
        </tr>
        <tr>
          <td>end</td>
          <td>{t['动作结束时间']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['（必选）']}</code>
          </td>
        </tr>
        <tr>
          <td>effectId</td>
          <td>{t['动作所对应的效果id索引']}</td>
          <td>
            <code>string</code>
          </td>
          <td>
            <code>{t['（必选）']}</code>
          </td>
        </tr>
        <tr>
          <td>selected</td>
          <td>{t['动作是否被选中']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>false</code>
          </td>
        </tr>
        <tr>
          <td>flexible</td>
          <td>{t['动作是否可伸缩']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>true</code>
          </td>
        </tr>
        <tr>
          <td>movable</td>
          <td>{t['动作是否可移动']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>true</code>
          </td>
        </tr>
        <tr>
          <td>disable</td>
          <td>{t['禁止动作运行']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>false</code>
          </td>
        </tr>
        <tr>
          <td>minStart</td>
          <td>{t['动作最小开始时间限制']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>0</code>
          </td>
        </tr>
        <tr>
          <td>maxEnd</td>
          <td>{t['动作最大结束时间限制']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>Number.MAX_VALUE</code>
          </td>
        </tr>
      </tbody>
    </table>
  );
};
