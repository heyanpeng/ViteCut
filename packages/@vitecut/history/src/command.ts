/**
 * 可撤销/重做的单步操作（命令模式）。
 *
 * - execute：执行或重做该操作（将状态从 A 变为 B）。
 * - undo：撤销该操作（将状态从 B 变回 A）。
 *
 * 与「增量补丁」结合时，命令内部只保存还原所需的最小数据，不保存整份状态快照。
 */
export type Command = {
  execute(): void;
  undo(): void;
};
