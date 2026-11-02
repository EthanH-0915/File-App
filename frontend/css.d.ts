// Next's bundled types only declare CSS modules (*.module.css). TypeScript 6
// enables noUncheckedSideEffectImports by default, which makes a plain global
// stylesheet import like `import "./globals.css"` fail without this.
declare module "*.css";
