/// <reference path="./snowflake-id.d.ts" />
import Snowflake from "snowflake-id";

const generator = new Snowflake({
  mid: Math.floor(Math.random() * 1024),
  offset: 0,
});

/**
 * 生成 snowflake 格式的唯一 id 字符串（基于 snowflake-id 包）
 */
export function snowflake(): string {
  return generator.generate();
}
