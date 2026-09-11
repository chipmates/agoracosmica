import type { Box3, Group, Mesh } from 'three/webgpu'

/** The dossier's SI values are kept verbatim. C means a modern assumption. */
export type Certainty = 'A' | 'B' | 'C' | 'U'
export type Coordinates = readonly (readonly number[])[]
export interface ShapeSpec {
  type: string
  vertices_m?: Coordinates
  faces?: Coordinates
  double_sided?: boolean
  centreline_m?: Coordinates
  radius_m?: number
  inner_radius_m?: number
  outer_radius_m?: number
  caps?: boolean
  open_ends?: boolean
  thickness_m?: number
  extrude_direction?: readonly number[]
  plane?: string
  extrude_axis?: string
  extrude_depth_m?: number
}
export interface Dimensions {
  x?: number; y?: number; z?: number
  radius?: number; height?: number
  radius_top?: number; radius_bottom?: number
  major_radius?: number; tube_radius?: number; plane?: string
  closed_axial_radial_profile?: Coordinates
  segments?: number; axis?: string
  centreline?: Coordinates
  inner_radius?: number; outer_radius?: number
  coordinates_xz?: Coordinates; coordinates_yz?: Coordinates
  holes_xz?: readonly Coordinates[]; holes_yz?: readonly Coordinates[]
  outer_vertices_yz?: Coordinates; hole_vertices_yz?: Coordinates
  extrusion_axis?: string | readonly number[]
  extrusion_depth?: number; centred_extrusion?: boolean
  extrusion_min?: number; extrusion_max?: number
  extrusion_length?: number; profile?: string
  vertices?: Coordinates; faces?: Coordinates
  extrude_depth?: number; nominal_thickness?: number; thickness?: number
  tooth_count?: number; module_m?: number; pitch_radius?: number
  base_radius?: number; addendum_radius?: number; root_radius?: number
  pressure_angle_rad?: number
}
export interface PartSpec {
  id: string
  parent: string
  shape: string | ShapeSpec
  dimensions_m: Dimensions
  position_m: readonly number[]
  orientation_rad: readonly number[]
  material: { class: string; basis: string; source: string }
  certainty: Certainty
  source: string
  notes?: string
}
export interface JointSpec {
  id: string
  type: string
  parent: string
  child: string
  axis: readonly number[]
  pivot_m: readonly number[]
  limits: readonly number[] | null
  ratio: number | null
  driver_joint?: string
  driven_joint?: string
  certainty: Certainty
  source: string
  notes?: string
}
export interface Dossier {
  slug: string
  name_en: string
  name_de: string
  status: string
  scope: string
  gaps: readonly string[]
  scale_m: {x: number; y: number; z: number; certainty: Certainty; source: string; note: string}
  frame: {ground_y_m?: number; origin: string}
  parts: readonly PartSpec[]
  joints: readonly JointSpec[]
  motion: {
    period_s: number | null
    loop: boolean
    phases: readonly {name: string; start_s: number; duration_s: number; joint_values: Record<string, number | string>; interpolation: string}[]
    visitor_12s: string
  }
  drive: {type: string; input_rate: {value: number; unit: string; certainty: Certainty}; justification: string}
  label_en: string
  label_de: string
  animation_notes: readonly string[]
  folio: readonly {codex: string; folio: string; holder: string; catalogue_reference: string; catalogue_url: string | null}[]
  research: {physics: {verdict_en: string; verdict_de: string; formula?: string; result?: string}}
}
export interface Assembly {
  object: Group
  parts: Map<string, Group>
  meshes: Map<string, Mesh>
  updateTube: (id: string, points: Coordinates) => void
  /** Refresh batched render geometry after updating joints. */
  sync: () => void
  dispose: () => void
}
export interface MachineBuild {
  object: Group
  animate: (t: number, dt: number) => void
  bounds: Box3
  label: {en: string; de: string}
  joints: () => Record<string, number>
  dispose: () => void
}
