import pluginQuery from "@tanstack/eslint-plugin-query";
import pluginRouter from "@tanstack/eslint-plugin-router";
import { react } from "./react.mjs";

const tanstackFiles = ["**/*.{ts,tsx}"];

const toConfigArray = (config) => (Array.isArray(config) ? config : [config]);

const withTanstackFiles = (config) => ({
    ...config,
    files: tanstackFiles,
});

export const tanstack = [
    ...react,
    ...toConfigArray(pluginRouter.configs["flat/recommended"]).map(withTanstackFiles),
    ...toConfigArray(pluginQuery.configs["flat/recommended"]).map(withTanstackFiles),
];
