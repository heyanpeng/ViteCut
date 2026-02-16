declare module "snowflake-id" {
  interface SnowflakeOptions {
    mid?: number;
    offset?: number;
  }

  export default class Snowflake {
    constructor(options?: SnowflakeOptions);
    generate(): string;
  }
}
