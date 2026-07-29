import pluginReact from "eslint-plugin-react";
import globals from "globals";
import { base } from "./base.mjs";

const reactFiles = ["**/*.{ts,tsx}"];

const toConfigArray = (config) => (Array.isArray(config) ? config : [config]);

const withReactFiles = (config) => ({
    ...config,
    files: reactFiles,
    settings: {
        ...config.settings,
        react: {
            ...config.settings?.react,
            version: "19",
        },
    },
});

export const react = [
    ...base,
    ...toConfigArray(pluginReact.configs.flat.recommended).map(withReactFiles),
    ...toConfigArray(pluginReact.configs.flat["jsx-runtime"]).map(withReactFiles),
    {
        files: reactFiles,
        languageOptions: {
            globals: globals.browser,
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        settings: {
            react: {
                version: "19",
            },
        },
        rules: {
            "react/react-in-jsx-scope": "off",
            "react/no-unknown-property": ["error", { ignore: ["css"] }],
            "react/display-name": "off",
        },
    },
];
