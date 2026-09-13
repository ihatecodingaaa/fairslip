/**
 * Let `node --test` resolve the extensionless imports this codebase is written
 * with. Test-time only; nothing in the app loads this.
 *
 * WHY IT EXISTS. Node runs TypeScript directly now, which is what lets the
 * concept have a real test suite and no test dependency. What it does not do is
 * bundler-style resolution: under ES modules `import "./decimal"` has to name
 * the file, while TypeScript's `moduleResolution: "bundler"` - what this package
 * is configured with, and what Next actually uses - says it need not.
 *
 * THE ALTERNATIVES WERE BOTH WORSE. Writing `./decimal.ts` at every call site
 * needs `allowImportingTsExtensions` in the shared tsconfig, and "type":
 * "module" in the shared package.json changes how every config file in this
 * package is loaded. Both are edits to production configuration in service of a
 * concept branch's tests. This is twenty lines that only ever run under
 * `npm run test:concept`.
 */

import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Relative, and with no extension of its own: the shape a bundler would
    // have resolved. Everything else - node: builtins, packages, anything
    // already carrying an extension - is left exactly as written.
    if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
