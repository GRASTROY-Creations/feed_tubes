// web-ext only loads JavaScript config files, so this one stays .mjs.
// It points at build/, the compiled output of `bun run build:ext`.
export default {
  sourceDir: "build",
  artifactsDir: "dist",
  build: {
    overwriteDest: true,
  },
  lint: {
    warningsAsErrors: false,
  },
};
