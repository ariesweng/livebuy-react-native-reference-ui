// Ambient module declaration for local PNG asset `require()` calls.
//
// `LoadingMarkAnimation.tsx` (rb-rn-loading-mark-png-sequence) is the FIRST source
// file in this package to `require()` a local bundled image (`frame_00.png` ~
// `frame_16.png`) rather than reference a remote `uri` string — no prior `*.png`
// ambient module declaration existed anywhere in this package (verified: neither
// the real `react-native` 0.85.3 package nor the now-stub `@types/react-native`
// ships one). Metro (RN's bundler) resolves a `require('./x.png')` call to a
// numeric asset id at runtime; this ambient declaration only teaches `tsc` that
// shape so `import frame00 from './frame_00.png'` type-checks. Scoped as a global
// ambient module (no top-level import/export in this file), consistent with the
// standard RN community convention (e.g. `@types/react-native-svg`-adjacent
// asset declarations, RN's own template `declarations.d.ts`).
declare module '*.png' {
  const value: number;
  export default value;
}
