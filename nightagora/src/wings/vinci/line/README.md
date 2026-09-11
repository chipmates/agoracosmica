# Walkable line

`STUDS` imports all 56 locked collection records and sorts by station then `display_order`. `createLine(materials, selectedIndex, language, phone)` returns a self-contained Group in metres: X right, Y up, negative Z onward, selected stud at the origin. Stud centres are separated by 1.65 m; spacing is deliberately not chronological. `CERTAINTY` maps the literal data certainty to green, amber, coral and visible EN/DE words. Date precision remains in `date_label_en/de`, not inferred from the year cut into the floor.

The caller owns camera, inputs, selection, accessible text and materials. Render selected `date_label`, `line`, `document`, qualifications and gaps from the same `STUDS` entry. Previous/next can reach every entry including reception through 2020. Stud bodies occupy cut circular sockets in extruded stone. Glyphs are geometry. Library stone detail is supplied by the host, and the bronze has a sky probe.

`weld(group)` merges static geometry by material and retains `?noweld`. It does not mutate the source data. The caller disposes returned geometry and any materials marked `userData.owned`; caller-owned materials survive teardown. No listeners or renderer are allocated here.
