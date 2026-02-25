import semver from 'semver';

const { BEFORE_VERSION, AFTER_VERSION } = process.env;

async function main() {
  const beforeSemver = semver.coerce(BEFORE_VERSION);
  const afterSemver = semver.coerce(AFTER_VERSION);
  const result = afterSemver.compare(beforeSemver);
  if (result === -1) {
    console.error(`💢 请检查下 stableVersion 和 yarn version strategy, 版本发生降级 BEFORE_VERSION=${BEFORE_VERSION}, AFTER_VERSION=${AFTER_VERSION}`);
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();