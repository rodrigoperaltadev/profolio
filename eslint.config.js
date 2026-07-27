import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import sonarjs from "eslint-plugin-sonarjs";
import boundaries from "eslint-plugin-boundaries";
import eslintConfigPrettier from "eslint-config-prettier";

// Mechanical clean-code subset (naming, complexity, layer boundaries, DI-adjacent
// process.env restriction). See openspec/changes/repo-scaffold-ci-foundation/design.md
// and AGENTS.md (added in Phase 5) for the full mechanical-vs-guidance split.
export default tseslint.config(
  // vitest's --coverage HTML/JSON report is generated output, not source.
  { ignores: ["coverage/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...astro.configs["flat/recommended"],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: { sonarjs, boundaries },
    settings: {
      "boundaries/elements": [
        { type: "content", pattern: "src/content/**" },
        { type: "view", pattern: "src/presentation/**" },
        { type: "config", pattern: "src/config/**" },
        { type: "lib", pattern: "src/lib/**" },
      ],
    },
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"] },
        { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["UPPER_CASE"] },
      ],
      complexity: ["error", 10],
      "sonarjs/cognitive-complexity": ["error", 15],
      "max-lines-per-function": [
        "error",
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "sonarjs/no-duplicate-string": "error",
      "sonarjs/no-identical-functions": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            "process.env access only allowed in src/config/**. Inject config instead.",
        },
      ],
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "content", allow: ["lib"] },
            { from: "view", allow: ["lib", "content"] },
            { from: "lib", allow: ["lib"] },
            { from: "config", allow: ["lib"] },
          ],
        },
      ],
    },
  },
  { files: ["src/config/**"], rules: { "no-restricted-syntax": "off" } },
  // typescript-eslint's typed rules require a tsconfig-backed project; this repo's
  // own root-level JS config files (this file included) are not part of tsconfig.json's
  // `include`, so disable type-checked linting for them specifically. Scoped to
  // `*.config.*` filenames only, not every .js/.mjs/.cjs in the repo.
  {
    files: ["*.config.js", "*.config.mjs", "*.config.cjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  eslintConfigPrettier,
);
