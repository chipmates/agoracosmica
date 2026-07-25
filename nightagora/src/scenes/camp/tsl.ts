/* TSL, uncast.

   Every camp surface is a hand-composed node graph, and TSL's own overload
   types cannot follow a graph that is built out of helpers (the same
   reason agora.ts types its fbm parameter as `any`). One cast here, at the
   boundary, keeps the shaders themselves readable — and the shaders are
   the part a human has to be able to read. */

import * as TSL from 'three/tsl'

/** a TSL node */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type N = any

export const {
  abs,
  atan,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  cross,
  dot,
  exp,
  float,
  floor,
  fract,
  instanceIndex,
  inverseSqrt,
  length,
  max,
  min,
  mix,
  mod,
  modelViewMatrix,
  modelWorldMatrix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalize,
  normalLocal,
  normalWorld,
  oneMinus,
  positionLocal,
  positionView,
  positionWorld,
  pow,
  screenCoordinate,
  screenSize,
  select,
  sign,
  sin,
  smoothstep,
  sqrt,
  step,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} = TSL as unknown as Record<string, N>
