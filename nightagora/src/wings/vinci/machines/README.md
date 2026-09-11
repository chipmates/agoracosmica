# The da Vinci machines

Each of the fourteen `<slug>.ts` modules exports the same synchronous `build(stack)` function. The hall may import one module unchanged, or call `buildMachine(slug, stack)` from `index.ts`.

```ts
const machine = build(stack)
scene.add(machine.object)
await machine.ready
machine.animate(absoluteSeconds, deltaSeconds)
const jointValues = machine.joints()
// On dismount:
machine.dispose()
```

`object` is a metres-based `Group` in the dossier's coordinate system. `bounds` is its declared conservative **swept envelope**, including the dossier's ground offset. `label` contains the exact English and German first lines extracted from the locked explanation pages. `period` is seconds or `null` for a static display. `ready` resolves after the material library and procedural assembly are ready. `animate(t, dt)` evaluates the absolute dossier schedule, so seeking a pose is deterministic and independent of frame rate. `joints()` returns every scheduled joint value in SI units, including unwrapped rotation angles. `tightBounds()` measures the current render geometry and is deliberately separate from the conservative envelope.

Await `ready` before measuring, framing or shooting. Calls to `animate` made while the materials load are retained and applied when ready. Disposal is safe before or after readiness. The caller owns the stack, scene, camera, light, modern support, folio plate and label presentation. Machine disposal does not dispose the caller's stack.

`section(true)` exposes the camera obscura's interior by hiding its roof and right wall; `section(false)` restores the complete closed chamber. The default is closed, and a request made before `ready` is retained. Other machines ignore this method. The host must explicitly label the section as an inspection view: opening the chamber admits light, so it is no longer the dark chamber required by the pinhole demonstration. No geometry, scale or motion changes in this view.

`parts.ts` constructs the numerical surfaces and keeps the joint hierarchy. `motion.ts` supplies the explicit schedules, dependent ratios and any specified changing rope or bow paths. Still geometry is batched by material and moving assembly. Repeated parts retain their numerical placement. The shared surface helpers supply real gear teeth, swept rope profiles, linen detail, and the library's oak and iron. The materials are loaded through `stack.materials.load` and carry the stack detail helper. Preserve `?noweld` for comparison with the unbatched hierarchy.

The construction documents in `data/<slug>.json` are byte-identical copies of the fourteen complete specifications in `brief/dossiers/`. They are specifications for new procedural objects, not captured historical machines. `data/records.json` carries the exact bilingual explanation text, first lines and arithmetic from all forty-two pages. Source and page SHA-256 values establish which locked files supplied each record. The `machineCatalog` exposes the fourteen complete records and their dossiers. `partialCatalog` exposes the other twenty-eight records as text, sources and named gaps only. No incomplete geometry is imported or animated.

All fourteen objects are GENERATED carriers. A verified folio does not make a generated machine green. Construction dimensions and rates are modern assumptions unless the dossier identifies their separate evidence. The bench uses amber for the reconstructed carrier and separately classifies facts and absences. `label` takes precedence over the JSON's `label_en` and `label_de` fields because the commission locks the page first lines, including their corrected spaces. Do not regenerate or normalize displayed copy.

The dossier's `scale_m` values are conservative envelopes and are not always tight bounding boxes. In particular, the compact instruments, parachute and three-bank gun contain deliberate empty clearance. Do not enlarge parts to fill that clearance. Report the declared envelope, the actual geometry bounds and swept containment separately. The gun and lock gates also have asymmetric forward envelopes, and several workshop bases have ground at `y=-0.05`.

The aerial screw remains grounded at 5 rpm. The parachute and camera obscura remain still. The anemometer and inclinometer follow their stated quasi-static demonstrations. The gun is an inert thirty-three-barrel index display, with no firing or loading geometry. The crane hoists once and holds. No non-looping movement silently resets. Reduced-motion presentation should retain a composed pose and leave the explanatory copy available.

The host must choose a folio image only through the store manifest and only when it is display-grade. A missing clearance is an absence label. Reconstruction photographs and reference plates are not textures. The procedural records belong in `assets/wing-vinci/manifest.json`, with the dossier slug and folio as the prompt, the generating seat and date, the class, licence and source hash.

The current texture policy and hall loading order are documented in [MATERIAL-POLICY.md](../../../bench/MATERIAL-POLICY.md). Complete independent dressing loads before building the machines; their per-stack requests share a serial queue. New linen/forged-iron sets keep full-tier maps; other new sets use 1024-pixel albedo plus procedural detail. Cached host sets retain their maps. Use a fresh route/stack for a tier change, and do not start unrelated direct library loads during machine decodes. The shared library has no per-request decode budget.
