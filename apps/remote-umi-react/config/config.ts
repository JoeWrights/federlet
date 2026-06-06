import { defineConfig } from "umi";

interface WebpackChainConfig {
  output: {
    publicPath(value: string): void;
  };
  plugin(name: string): {
    use(plugin: unknown, args: unknown[]): void;
  };
}

interface ChainWebpackContext {
  webpack: {
    container: {
      ModuleFederationPlugin: unknown;
    };
  };
}

export default defineConfig({
  title: "Umi React Remote",
  webpack5: {},
  dynamicImport: {},
  outputPath: "dist",
  devServer: {
    port: 3003,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  chainWebpack(config: WebpackChainConfig, { webpack }: ChainWebpackContext) {
    config.output.publicPath("auto");
    config.plugin("module-federation").use(webpack.container.ModuleFederationPlugin, [
      {
        name: "remote_umi_react",
        filename: "remoteEntry.js",
        exposes: {
          "./mount": "./src/mount.tsx",
        },
        shared: {},
      },
    ]);
  },
});
