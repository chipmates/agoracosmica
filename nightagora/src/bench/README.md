# The bench

One phase, one address, one kind at a time.

A bench is not a station of the museum. It stands **one built thing** under
the stack's own light, alone, so a frame of it can be judged without the
wing's weather, its rail or its nineteen doors in the way. Nothing here is
reachable from the wheel, and the museum's own walk never enters the phase.

## Address

```
/bench/vinci/<kind>/<id>
```

## The rig

```js
window.__forge.jump('bench', { kind, ... })
window.__forge.bench()          // what the standing bench measures of itself
window.__forge.station(id)      // stand at one of this kind's own ids
window.__forge.rail(t)          // 0..1 across them
window.__forge.state()          // stationId / stationIds / texturesPending
```

| kind | names its state by | ids |
|---|---|---|
| `machines` | `slug` | the fourteen machine slugs |
| `table` | `state` | `closed` `open-83v` `turning` `mirror` `shelf` `open-33r` `phone-open` |
| `line` | `state` | `line-early` `line-late` `stud-1503` `inscription` `myth-deathbed` `myth-quotes` `grave` `phone-line` |
| `object` | `slug` | one built body out of the store (`dovecote`), with `state` naming its station |
| `pictures` | `segment` | reserved; the picture bench has not landed |

The object kind is the odd one and the reason is worth a line: its address
names the BODY, because a body is what the bench stands, and its four
stations (`approach` `near` `detail` `phone`) are where the eye goes while it
stands there. So `/bench/vinci/object/dovecote` opens the dovecote at its
approach, and `window.__forge.jump('bench', { kind: 'object', slug:
'dovecote', state: 'detail' })` walks to the joint.

`kind` may be left out when a `slug` is given: a slug names a machine and
nothing else. `state` is ambiguous between two kinds, so those two say which
they mean.

## What lives where

This folder is the **host**: the phase, the address, and the one shape the
rig addresses every kind through. It holds no geometry, no copy and no
light.

Each kind's own recipes live inside its wing module:

```
src/wings/vinci/machines/bench/    the machine bench
src/wings/vinci/table/bench/       the reading table's bench
src/wings/vinci/line/bench/        the line, words, myths and grave bench
src/wings/vinci/objects/bench/     the object bench and its catalogue
```

They are there and not here for a reason the layout cannot show: the wing's
provenance checker hashes each manifest record's recipe file and refuses one
that sits outside `src/wings/vinci`. A bench whose sources lived in this
folder could not be recorded.

## What a kind owes the host

`BenchModule` in `index.ts`. The one clause worth saying twice: `frame(dt)`
includes the kind's own call to `stack.render(dt)`, because a kind may have a
clock of its own to advance first. While a bench stands, the night's frame
loop does nothing else.

`reloadOnTier` says the kind's geometry and maps are allocated for one tier,
so a live switch would leave half of it dressed for the tier before. The rig
is sent round the address again with `?tier=` instead.

## Standing and stamping

`jump` sets `data-forge="pending"`, and the kind sets `data-forge="bench"`
itself, when the thing it stands is actually standing. A kind whose plate is
still in flight also reports it through `state().texturesPending`, which is
what the eye waits on before it shoots.

Kinds are imported on demand. A night that never opens a bench never pays
for one, and the three benches are three separate chunks in the build.
