/**
 * Islamic ornaments — barrel re-export.
 * The module grew past the 600-line file rule and was split into
 * lib/ornaments/{ornaments-types,ornaments-geometry,ornaments-painters}.ts;
 * every symbol below keeps its original import path working unchanged.
 */
export * from './ornaments/ornaments-types';
export * from './ornaments/ornaments-geometry';
export * from './ornaments/ornaments-paint-background';
export * from './ornaments/ornaments-paint-surface';
