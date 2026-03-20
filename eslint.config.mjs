import nextConfig from "eslint-config-next";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import tseslint from "typescript-eslint";

const eslintConfig = [
  ...nextConfig,
  ...tseslint.configs.strict,
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

export default eslintConfig;
