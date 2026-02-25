import { useLang } from 'rspress/runtime';
import { Badge } from 'rspress/theme';

export const Props = () => {
  const lang = useLang();
  
  // 创建中英文字典
  const t = {
    '属性名': lang === 'zh' ? '属性名' : 'Property',
    '描述': lang === 'zh' ? '描述' : 'Description',
    '类型': lang === 'zh' ? '类型' : 'Type',
    '默认值': lang === 'zh' ? '默认值' : 'Default',
    '编辑区域距离顶部滚动距离': lang === 'zh' ? '编辑区域距离顶部滚动距离' : 'Scroll distance from the top of the editing area',
    '请使用ref.setScrollTop代替': lang === 'zh' ? '请使用ref.setScrollTop代替' : 'Please use ref.setScrollTop instead',
    '编辑区域滚动回调 (用于控制与编辑行滚动同步)': lang === 'zh' ? '编辑区域滚动回调 (用于控制与编辑行滚动同步)' : 'Editing area scroll callback (used to control synchronization with editing line scrolling)',
    '拖拽时是否启动自动滚动': lang === 'zh' ? '拖拽时是否启动自动滚动' : 'Whether to enable auto-scroll during dragging',
    '自定义timeline样式': lang === 'zh' ? '自定义timeline样式' : 'Custom timeline style',
    '是否自动重新渲染（当数据改变或光标时间改变时update tick）': lang === 'zh' ? '是否自动重新渲染（当数据改变或光标时间改变时update tick）' : 'Whether to automatically re-render (update tick when data changes or cursor time changes)',
    '数据改变回调，会在操作动作end改变数据后触发(返回false会阻止自动engine同步，用于减少性能开销)': lang === 'zh' ? '数据改变回调，会在操作动作end改变数据后触发(返回false会阻止自动engine同步，用于减少性能开销)' : 'Data change callback, triggered after data is changed at the end of operation (returning false prevents automatic engine synchronization, used to reduce performance overhead)',
    '时间轴编辑数据': lang === 'zh' ? '时间轴编辑数据' : 'Timeline editing data',
    '时间轴动作效果map': lang === 'zh' ? '时间轴动作效果map' : 'Timeline action effect map',
    '单个刻度标记范畴（>0）': lang === 'zh' ? '单个刻度标记范畴（>0）' : 'Single scale mark category (>0)',
    '最少刻度个数（>=1）': lang === 'zh' ? '最少刻度个数（>=1）' : 'Minimum number of scales (>=1)',
    '最大刻度个数（>=minScaleCount）': lang === 'zh' ? '最大刻度个数（>=minScaleCount）' : 'Maximum number of scales (>=minScaleCount)',
    '单个刻度细分单元数（>0整数）': lang === 'zh' ? '单个刻度细分单元数（>0整数）' : 'Number of subdivisions per scale (>0 integer)',
    '单个刻度的显示宽度（>0, 单位：px）': lang === 'zh' ? '单个刻度的显示宽度（>0, 单位：px）' : 'Display width of a single scale (>0, unit: px)',
    '刻度开始距离左侧的距离（>=0, 单位：px）': lang === 'zh' ? '刻度开始距离左侧的距离（>=0, 单位：px）' : 'Distance from the left side of the scale start (>=0, unit: px)',
    '每个编辑行默认高度（>0, 单位：px）': lang === 'zh' ? '每个编辑行默认高度（>0, 单位：px）' : 'Default height of each editing line (>0, unit: px)',
    '是否启动网格移动吸附': lang === 'zh' ? '是否启动网格移动吸附' : 'Whether to enable grid movement snap',
    '启动拖拽辅助线吸附': lang === 'zh' ? '启动拖拽辅助线吸附' : 'Enable drag auxiliary line snap',
    '是否隐藏光标': lang === 'zh' ? '是否隐藏光标' : 'Whether to hide the cursor',
    '禁止全部动作区域拖动': lang === 'zh' ? '禁止全部动作区域拖动' : 'Disable all action area dragging',
    'timeline运行器，不传则使用内置运行器': lang === 'zh' ? 'timeline运行器，不传则使用内置运行器' : 'Timeline runner, uses built-in runner if not passed',
    '自定义action区域渲染': lang === 'zh' ? '自定义action区域渲染' : 'Custom action area rendering',
    '自定义scale渲染': lang === 'zh' ? '自定义scale渲染' : 'Custom scale rendering',
    '开始移动回调': lang === 'zh' ? '开始移动回调' : 'Start moving callback',
    '移动回调（return false可阻止移动）': lang === 'zh' ? '移动回调（return false可阻止移动）' : 'Moving callback (return false to prevent movement)',
    '移动结束回调（return false可阻止onChange触发）': lang === 'zh' ? '移动结束回调（return false可阻止onChange触发）' : 'Move end callback (return false to prevent onChange from triggering)',
    '开始改变大小回调': lang === 'zh' ? '开始改变大小回调' : 'Start resizing callback',
    '开始大小回调（return false可阻止改变）': lang === 'zh' ? '开始大小回调（return false可阻止改变）' : 'Start resizing callback (return false to prevent change)',
    '改变大小结束回调（return false可阻止onChange触发）': lang === 'zh' ? '改变大小结束回调（return false可阻止onChange触发）' : 'Resize end callback (return false to prevent onChange from triggering)',
    '点击行回调': lang === 'zh' ? '点击行回调' : 'Click row callback',
    '点击动作回调': lang === 'zh' ? '点击动作回调' : 'Click action callback',
    '点击动作回调（触发drag时不执行）': lang === 'zh' ? '点击动作回调（触发drag时不执行）' : 'Click action callback (not executed when drag is triggered)',
    '双击行回调': lang === 'zh' ? '双击行回调' : 'Double click row callback',
    '双击动作回调': lang === 'zh' ? '双击动作回调' : 'Double click action callback',
    '右键行回调': lang === 'zh' ? '右键行回调' : 'Right click row callback',
    '右键动作回调': lang === 'zh' ? '右键动作回调' : 'Right click action callback',
    '获取要提示辅助线的action id列表，在move/resize start 时进行计算，默认获取除当前移动action的全部': lang === 'zh' ? '获取要提示辅助线的action id列表，在move/resize start 时进行计算，默认获取除当前移动action的全部' : 'Get the list of action IDs for auxiliary lines, calculated at move/resize start, defaults to getting all except the current moving action',
    'cursor开始拖拽事件': lang === 'zh' ? 'cursor开始拖拽事件' : 'Cursor start drag event',
    'cursor结束拖拽事件': lang === 'zh' ? 'cursor结束拖拽事件' : 'Cursor end drag event',
    'cursor拖拽事件': lang === 'zh' ? 'cursor拖拽事件' : 'Cursor drag event',
    '点击时间区域事件, 返回false时阻止设置时间': lang === 'zh' ? '点击时间区域事件, 返回false时阻止设置时间' : 'Click time area event, return false to prevent setting time',
    '--': lang === 'zh' ? '--' : '--',
    'false': lang === 'zh' ? 'false' : 'false',
    'true': lang === 'zh' ? 'true' : 'true',
    '1': lang === 'zh' ? '1' : '1',
    '20': lang === 'zh' ? '20' : '20',
    'Infinity': lang === 'zh' ? 'Infinity' : 'Infinity',
    '10': lang === 'zh' ? '10' : '10',
    '160': lang === 'zh' ? '160' : '160',
    '32': lang === 'zh' ? '32' : '32',
    '（必选）': lang === 'zh' ? '（必选）' : '(Required)',
    '@deprecated': lang === 'zh' ? '@deprecated' : '@deprecated',
    '改变大小回调（return false可阻止改变）': lang === 'zh' ? '改变大小回调（return false可阻止改变）' : 'Resize callback (return false to prevent change)',
  };
  
  return (
    <table>
      <thead>
        <tr>
          <th>{t['属性名']}</th>
          <th>{t['描述']}</th>
          <th>{t['类型']}</th>
          <th style={{ minWidth: 100 }}>{t['默认值']}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>scrollTop</td>
          <td>
            {t['编辑区域距离顶部滚动距离']} (
            <Badge text="info" type="danger">
              {t['@deprecated']}
            </Badge>
            {t['请使用ref.setScrollTop代替']})
          </td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onScroll</td>
          <td>{t['编辑区域滚动回调 (用于控制与编辑行滚动同步)']}</td>
          <td>
            <code>(params: OnScrollParams) =&gt; void</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>autoScroll</td>
          <td>{t['拖拽时是否启动自动滚动']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>{t['false']}</code>
          </td>
        </tr>
        <tr>
          <td>style</td>
          <td>{t['自定义timeline样式']}</td>
          <td>
            <code>CSSProperties</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>autoReRender</td>
          <td>{t['是否自动重新渲染（当数据改变或光标时间改变时update tick）']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>{t['true']}</code>
          </td>
        </tr>
        <tr>
          <td>onChange</td>
          <td>{t['数据改变回调，会在操作动作end改变数据后触发(返回false会阻止自动engine同步，用于减少性能开销)']}</td>
          <td>
            <code>
              (editorData: <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>[]) =&gt; boolean | void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>editorData</td>
          <td>{t['时间轴编辑数据']}</td>
          <td>
            <code>
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>[]
            </code>
          </td>
          <td>
            <code>{t['（必选）']}</code>
          </td>
        </tr>
        <tr>
          <td>effects</td>
          <td>{t['时间轴动作效果map']}</td>
          <td>
            <code>
              Record&lt;string, <a href={`/${lang}/guide/intro/3-data-interface.html#timelineeffect`}>TimelineEffect</a>&gt;
            </code>
          </td>
          <td>
            <code>{t['（必选）']}</code>
          </td>
        </tr>
        <tr>
          <td>scale</td>
          <td>{t['单个刻度标记范畴（>0）']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['1']}</code>
          </td>
        </tr>
        <tr>
          <td>minScaleCount</td>
          <td>{t['最少刻度个数（>=1）']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['20']}</code>
          </td>
        </tr>
        <tr>
          <td>maxScaleCount</td>
          <td>{t['最大刻度个数（>=minScaleCount）']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['Infinity']}</code>
          </td>
        </tr>
        <tr>
          <td>scaleSplitCount</td>
          <td>{t['单个刻度细分单元数（>0整数）']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['10']}</code>
          </td>
        </tr>
        <tr>
          <td>scaleWidth</td>
          <td>{t['单个刻度的显示宽度（>0, 单位：px）']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['160']}</code>
          </td>
        </tr>
        <tr>
          <td>startLeft</td>
          <td>{t['刻度开始距离左侧的距离（>=0, 单位：px）']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['20']}</code>
          </td>
        </tr>
        <tr>
          <td>rowHeight</td>
          <td>{t['每个编辑行默认高度（>0, 单位：px）']}</td>
          <td>
            <code>number</code>
          </td>
          <td>
            <code>{t['32']}</code>
          </td>
        </tr>
        <tr>
          <td>gridSnap</td>
          <td>{t['是否启动网格移动吸附']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>{t['false']}</code>
          </td>
        </tr>
        <tr>
          <td>dragLine</td>
          <td>{t['启动拖拽辅助线吸附']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>{t['false']}</code>
          </td>
        </tr>
        <tr>
          <td>hideCursor</td>
          <td>{t['是否隐藏光标']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>{t['false']}</code>
          </td>
        </tr>
        <tr>
          <td>disableDrag</td>
          <td>{t['禁止全部动作区域拖动']}</td>
          <td>
            <code>boolean</code>
          </td>
          <td>
            <code>{t['false']}</code>
          </td>
        </tr>
        <tr>
          <td>engine</td>
          <td>{t['timeline运行器，不传则使用内置运行器']}</td>
          <td>
            <code>
              <a href={`/${lang}/guide/engine/2-api`}>TimelineEngine</a>
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>getActionRender</td>
          <td>{t['自定义action区域渲染']}</td>
          <td>
            <code>
              (action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>, row: <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>
              ) =&gt; ReactNode
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>getScaleRender</td>
          <td>{t['自定义scale渲染']}</td>
          <td>
            <code>(scale: number) =&gt; ReactNode</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onActionMoveStart</td>
          <td>{t['开始移动回调']}</td>
          <td>
            <code>
              (params: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; row:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onActionMoving</td>
          <td>{t['移动回调（return false可阻止移动）']}</td>
          <td>
            <code>
              (params: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; row:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; start: number; end: number; {'}'}) =&gt; boolean | void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onActionMoveEnd</td>
          <td>{t['移动结束回调（return false可阻止onChange触发）']}</td>
          <td>
            <code>
              (params: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; row:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; start: number; end: number; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onActionResizeStart</td>
          <td>{t['开始改变大小回调']}</td>
          <td>
            <code>
              (params: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; row:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; dir: "right" | "left"; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>--</code>
          </td>
        </tr>
        <tr>
          <td>onActionResizing</td>
          <td>{t['改变大小回调（return false可阻止改变）']}</td>
          <td>
            <code>
              (params: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; row:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; start: number; end: number; dir: "right" | "left"; {'}'}) =&gt; boolean | void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onActionResizeEnd</td>
          <td>{t['改变大小结束回调（return false可阻止onChange触发）']}</td>
          <td>
            <code>
              (params: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; row:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; start: number; end: number; dir: "right" | "left"; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onClickRow</td>
          <td>{t['点击行回调']}</td>
          <td>
            <code>
              (e: MouseEvent&lt;HTMLElement, MouseEvent&gt;, param: {'{'} row: <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; time: number; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onClickAction</td>
          <td>{t['点击动作回调']}</td>
          <td>
            <code>
              (e: MouseEvent&lt;HTMLElement, MouseEvent&gt;, param: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; row:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; time: number; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onClickActionOnly</td>
          <td>{t['点击动作回调（触发drag时不执行）']}</td>
          <td>
            <code>
              (e: MouseEvent&lt;HTMLElement, MouseEvent&gt;, param: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; row:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; time: number; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onDoubleClickRow</td>
          <td>{t['双击行回调']}</td>
          <td>
            <code>
              (e: MouseEvent&lt;HTMLElement, MouseEvent&gt;, param: {'{'} row: <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; time: number; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onDoubleClickAction</td>
          <td>{t['双击动作回调']}</td>
          <td>
            <code>
              (e: MouseEvent&lt;HTMLElement, MouseEvent&gt;, param: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; row:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; time: number; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onContextMenuRow</td>
          <td>{t['右键行回调']}</td>
          <td>
            <code>
              (e: MouseEvent&lt;HTMLElement, MouseEvent&gt;, param: {'{'} row: <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; time: number; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onContextMenuAction</td>
          <td>{t['右键动作回调']}</td>
          <td>
            <code>
              (e: MouseEvent&lt;HTMLElement, MouseEvent&gt;, param: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; row:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; time: number; {'}'}) =&gt; void
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>getAssistDragLineActionIds</td>
          <td>{t['获取要提示辅助线的action id列表，在move/resize start 时进行计算，默认获取除当前移动action的全部']}</td>
          <td>
            <code>
              (params: {'{'} action: <a href={`/${lang}/guide/intro/3-data-interface.html#timelineaction`}>TimelineAction</a>; editorData:{' '}
              <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>[]; row: <a href={`/${lang}/guide/intro/3-data-interface.html#timelinerow`}>TimelineRow</a>; {'}'})
              =&gt; string[]
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onCursorDragStart</td>
          <td>{t['cursor开始拖拽事件']}</td>
          <td>
            <code>(time: number) =&gt; void</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onCursorDragEnd</td>
          <td>{t['cursor结束拖拽事件']}</td>
          <td>
            <code>(time: number) =&gt; void</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onCursorDrag</td>
          <td>{t['cursor拖拽事件']}</td>
          <td>
            <code>(time: number) =&gt; void</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>onClickTimeArea</td>
          <td>{t['点击时间区域事件, 返回false时阻止设置时间']}</td>
          <td>
            <code>(time: number, e: MouseEvent&lt;HTMLDivElement, MouseEvent&gt;) =&gt; boolean</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>ref</td>
          <td>{t['--']}</td>
          <td>
            <code>
              Ref&lt;<a href={`/${lang}/guide/intro/3-data-interface.html#timelinestate`}>TimelineState</a>&gt;
            </code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
        <tr>
          <td>key</td>
          <td>{t['--']}</td>
          <td>
            <code>Key</code>
          </td>
          <td>
            <code>{t['--']}</code>
          </td>
        </tr>
      </tbody>
    </table>
  );
};
