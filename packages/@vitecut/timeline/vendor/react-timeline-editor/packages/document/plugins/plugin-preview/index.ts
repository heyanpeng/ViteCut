import { type RsbuildConfig, type RsbuildPluginAPI, createRsbuild, mergeRsbuildConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { type RouteMeta, type RspressPlugin, removeTrailingSlash } from '@rspress/shared';
import { cloneDeep, isEqual } from 'lodash';
import * as net from 'node:net';
import { join } from 'node:path';
import { staticPath } from './constant';
import { generateEntry } from './generate-entry';
import { demos, remarkCodeToDemo } from './remark-plugin';
import type { Options, StartServerResult } from './types';

// global variables which need to be initialized in plugin
let routeMeta: RouteMeta[];

const DEFAULT_PREVIEW_LANGUAGES = ['jsx', 'tsx'];

/**
 * The plugin is used to preview component.
 */
export function pluginPreview(options?: Options): RspressPlugin {
  const { iframeOptions = {}, previewLanguages = DEFAULT_PREVIEW_LANGUAGES } = options ?? {};
  const { devPort = 7890, builderConfig = {} } = iframeOptions;
  const getRouteMeta = () => routeMeta;
  let lastDemos: typeof demos;
  let devServer: StartServerResult | undefined;
  let clientConfig: RsbuildConfig;
  const port = devPort;
  return {
    name: '@rspress/plugin-preview',
    config(config) {
      config.markdown = config.markdown || {};
      config.markdown.mdxRs = false;
      return config;
    },
    routeGenerated(routes: RouteMeta[]) {
      // init routeMeta
      routeMeta = routes;
    },
    async beforeBuild(_, isProd) {
      if (!isProd) {
        try {
          await new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on('error', reject);
            server.listen({ port, host: '0.0.0.0' }, () => {
              server.close(resolve);
            });
          });
        } catch (e) {
          if (!!e && typeof e === 'object' && 'code' in e && e.code !== 'EADDRINUSE') {
            throw e;
          }

          throw new Error(`Port "${port}" is occupied, please choose another one.`);
        }
      }
    },
    async afterBuild(config, isProd) {
      if (isEqual(demos, lastDemos)) {
        return;
      }
      lastDemos = cloneDeep(demos);
      await devServer?.server?.close();
      devServer = undefined;
      const sourceEntry = generateEntry(demos);
      const outDir = join(config.outDir ?? 'doc_build', '~demo');
      if (Object.keys(sourceEntry).length === 0) {
        return;
      }
      const { html, source, output, performance } = clientConfig ?? {};
      const rsbuildConfig = mergeRsbuildConfig(
        {
          dev: {
            progressBar: false,
          },
          server: {
            port: devPort,
            printUrls: () => undefined,
            strictPort: true,
          },
          performance: {
            ...performance,
            printFileSize: false,
          },
          html,
          source: {
            ...source,
            entry: sourceEntry,
          },
          output: {
            ...output,
            assetPrefix: output?.assetPrefix ? `${removeTrailingSlash(output.assetPrefix)}/~demo` : '/~demo',
            distPath: {
              root: outDir,
            },
            // not copy files again
            copy: undefined,
          },
          plugins: config?.builderPlugins,
        },
        builderConfig,
      );
      const rsbuildInstance = await createRsbuild({
        callerName: 'rspress',
        rsbuildConfig,
      });

      const { pluginSass } = await import('@rsbuild/plugin-sass');
      const { pluginLess } = await import('@rsbuild/plugin-less');

      rsbuildInstance.addPlugins([pluginSass(), pluginLess()]);
      rsbuildInstance.addPlugins([pluginReact()]);

      if (isProd) {
        rsbuildInstance.build();
      } else {
        devServer = await rsbuildInstance.startDevServer();
      }
    },
    builderConfig: {
      source: {
        include: [join(__dirname, '..')],
      },
      tools: {
        bundlerChain(chain) {
          chain.module.rule('Raw').resourceQuery(/raw/).type('asset/source').end();

          chain.resolve.extensions.prepend('.md').prepend('.mdx');
        },
        rspack: {
          watchOptions: {
            ignored: /\.git/,
          },
        },
      },
      plugins: [
        {
          name: 'close-demo-server',
          setup: (api: RsbuildPluginAPI) => {
            api.modifyRsbuildConfig((config) => {
              if (config.output?.target === 'web') {
                // client build config
                clientConfig = config;
              }
            });
            api.onCloseDevServer(async () => {
              await devServer?.server?.close();
              devServer = undefined;
            });
          },
        },
      ],
    },
    extendPageData(pageData, isProd) {
      if (!isProd) {
        // @ts-ignore
        pageData.devPort = port;
      }
      // highlightLanguages analysis is built-in in mdx-rs, we need to add extraHighlightLanguages in preview plugin which using mdx-js to perform code block
      // @ts-ignore
      pageData.extraHighlightLanguages = previewLanguages;
    },
    markdown: {
      remarkPlugins: [
        [
          remarkCodeToDemo,
          {
            getRouteMeta,
            builderConfig,
          },
        ],
      ],
      globalComponents: [join(staticPath, 'global-components', 'Container.tsx')],
    },
  };
}

export type { Options };
