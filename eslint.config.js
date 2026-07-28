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
  // vitest's --coverage HTML/JSON report and `astro sync`'s generated content
  // types are generated output, not source.
  { ignores: ["coverage/", ".astro/"] },
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
        { type: "publishing", pattern: "src/publishing/**" },
        { type: "admin", pattern: "src/pages/admin/**" },
        // No `middleware` element for `src/middleware.ts`: eslint-plugin-boundaries
        // element patterns match folders, not individual files (its own runtime
        // warning confirms this) — a bare-file pattern never actually classifies
        // the file, so `create()` (see node_modules/eslint-plugin-boundaries/
        // dist/Rules/Support/DependencyRule.js) skips it as unmatched and no
        // restriction is ever applied. Verified empirically during apply: setting
        // `{ from: "middleware", allow: [] }` (deny everything) still produced
        // zero lint errors for its `./config/*` imports. Declaring the element
        // would imply a protection that doesn't exist — see design.md's Open
        // Question.
      ],
    },
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"] },
        { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["UPPER_CASE"] },
        // Astro component default imports are PascalCase by convention
        // (e.g. `import CollectionSection from "./collection-section.astro"`)
        // — added for the admin UI's first `.astro` component import.
        { selector: "import", format: ["camelCase", "PascalCase"] },
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
            { from: "config", allow: ["lib", "publishing"] },
            { from: "publishing", allow: ["lib", "content", "config"] },
            { from: "admin", allow: ["content", "publishing", "config", "lib"] },
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
  // `scripts/**` are standalone Node tooling (e.g. the build-time content-
  // collection proof), intentionally outside tsconfig.json's `include` since
  // they aren't application source — same rationale as the root `*.config.*`
  // override above. They also run directly under Node (not bundled), so the
  // Node/Web globals they use are declared explicitly here rather than
  // pulling in a new `globals` dependency for two identifiers. Return-type
  // annotations are plain-JS-illegal (these files execute via `node`, not
  // `tsc`/a bundler), so `explicit-function-return-type` is off here only —
  // the rest of the mechanical rule set (naming, complexity, no-explicit-any,
  // boundaries) still applies.
  {
    files: ["scripts/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: {
        console: "readonly",
        URL: "readonly",
        Buffer: "readonly",
        process: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
  // `astro-eslint-parser`'s typed checking cannot resolve the return type of
  // an array `.map()` callback whose body is an Astro template node (it
  // reports it as literal type `error`), even though `astro check`/the real
  // Astro compiler type-checks these templates correctly — found empirically
  // in the admin UI's first `.astro` files that render lists (`index.astro`,
  // `_lib/collection-section.astro`). Scoped to `.astro` only; `.ts`/`.tsx`
  // files still get the full unsafe-return check.
  {
    files: ["**/*.astro"],
    rules: { "@typescript-eslint/no-unsafe-return": "off" },
  },
  // `src/env.d.ts` uses Astro's standard triple-slash reference to pull in
  // `.astro/types.d.ts` (ambient `astro:content` module + generated
  // collection types). There is no `import`-style equivalent for ambient
  // `.d.ts` declaration merging, so this is the one file where the rule
  // must be off rather than a project-wide exception.
  {
    files: ["src/env.d.ts"],
    rules: { "@typescript-eslint/triple-slash-reference": "off" },
  },
  eslintConfigPrettier,
);
