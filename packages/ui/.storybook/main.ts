import type { StorybookConfig } from "storybook-react-rsbuild";
import { pluginReact } from "@rsbuild/plugin-react";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "storybook-react-rsbuild",
    options: {},
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  rsbuildFinal: (rsbuildConfig) => {
    // 必须手动添加 React plugin
    rsbuildConfig.plugins = [...(rsbuildConfig.plugins ?? []), pluginReact()];
    return rsbuildConfig;
  },
};

export default config;
