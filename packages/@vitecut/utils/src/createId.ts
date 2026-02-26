import { snowflake } from "./snowflake";

/**
 * 生成带前缀的唯一 id（底层为 snowflake）。
 * 各包统一使用此方法生成 asset / track / clip / project 等 id。
 */
export function createId(prefix: string): string {
  return `${prefix}-${snowflake()}`;
}
