import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import importPlugin from "eslint-plugin-import";
import eslintPluginPrettier from "eslint-plugin-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tsEslint from "typescript-eslint";

export const globalIgnores = [
    "**/dist/**",
    "**/node_modules/**",
    "**/.turbo/**",
    "**/out/**",
    "**/*.mjs",
    "**/*.cjs",
    "**/*.d.ts",
    "eslint.config.*",
    "**/routeTree.gen.ts",
];

export const base = tsEslint.config(
    {
        ignores: globalIgnores,
    },
    eslint.configs.recommended,
    ...tsEslint.configs.recommended,
    ...tsEslint.configs.stylistic,
    eslintConfigPrettier,
    {
        plugins: {
            import: importPlugin,
            turbo: turboPlugin,
            prettier: eslintPluginPrettier,
        },
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            "no-console": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    args: "all",
                    vars: "all",
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    prefer: "type-imports",
                    fixStyle: "inline-type-imports",
                },
            ],
            "@typescript-eslint/no-unnecessary-type-assertion": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unnecessary-qualifier": "off",
            "@typescript-eslint/no-unnecessary-type-arguments": "off",
            "@typescript-eslint/no-unnecessary-type-constraint": "off",
            "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
            "@typescript-eslint/no-misused-promises": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/prefer-for-of": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "import/no-cycle": "error",
        },
    },
);
