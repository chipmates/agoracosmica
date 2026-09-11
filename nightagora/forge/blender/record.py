"""The manifest record and the size table, written after the pack.

The Blender side of a build ends with a receipt (`build.json` in the object's
work folder): what was built, from which script at which hash, out of which
library sets, and one raw glb per tier. This is the other side: it takes that
receipt and the packed files, writes one record per tier into the STORE's own
manifest for the wing, and prints what each tier costs.

Two rules the record keeps, and the museum checks. The bytes live in the
store and the record lives beside them, because a record written into the
repository cannot be pushed to the media origin and a byte written into the
repository breaks the Manifest Law. And a GENERATED asset names its basis:
the script's path and hash, the authoring blend, the model that ran it and
the date, so anybody can rebuild the file and get the same bytes.

    python3 record.py <build.json> <tier>=<packed.glb> ...
"""

import hashlib
import json
import sys
from pathlib import Path


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def store_root(app):
    here = Path(app).resolve()
    for _ in range(12):
        inside = here / 'internal' / 'night-agora' / 'assets'
        if inside.exists():
            return inside
        if here.name == 'night-agora' and (here / 'assets').exists():
            return here / 'assets'
        if here.parent == here:
            break
        here = here.parent
    raise SystemExit('no asset store found above ' + str(app))


def records(receipt, packed):
    """one manifest entry per tier, plus the shared record of the recipe"""
    scope = receipt['scope']
    short = scope.replace('wing-', '')
    folder = f"models/{receipt['id']}/"
    common = {
        'wing': scope,
        'class': 'GENERATED',
        'licence': ('Generated for this work, regenerable from its script. '
                    'Library source photographs CC0 1.0, Poly Haven and ambientCG.'),
        'display': True,
        'model': 'blender 5.2 + gltfpack',
        'date': receipt['date'],
        'prompt': receipt['note'],
        'category': receipt.get('category', 'model'),
        'period_fit': receipt.get('period_fit', 'generic'),
        'certainty': receipt.get('certainty', 'inferred'),
    }
    out = []
    for tier, file in packed.items():
        tier_receipt = receipt['tiers'][tier]
        path = Path(file)
        out.append({
            **common,
            'id': f'{short}/{receipt["id"]}-{tier}',
            # the loader opens `<scope>/<path><gltf.file>`, so the path of a
            # model record is the FOLDER its tiers stand in and the file is
            # named in the glTF block
            'path': folder,
            'sha256': sha256(path),
            'bytes': path.stat().st_size,
            'tris': tier_receipt['tris'],
            'bounds_m': tier_receipt['bounds_m'],
            'floor_m': tier_receipt['floor_m'],
            'role': receipt.get('name', receipt['id']),
            'tier': tier,
            'gltf': {
                'file': path.name,
                'resolution': f"{tier_receipt['atlas'] // 1024}k",
                'maps': receipt['maps'],
                'texels_per_m': receipt.get('texels_per_m', 0),
                **({'detail_set': receipt['detail_set']} if receipt.get('detail_set') else {}),
            },
            'note': (f"{receipt['note']} Built by {receipt['script']} "
                     f"(sha256 {receipt['script_sha256']}), authored in {Path(receipt['blend']).name}, "
                     f"baked to {tier_receipt['atlas']} square atlases and packed with "
                     f"gltfpack -cc -tc -tq 8 -tl {tier_receipt['texture_limit']}. "
                     'No light is baked: the export names no emissive channel and carries no '
                     'light atlas, and the occlusion travels in the ORM texture.'),
            'library': [entry['id'] for entry in receipt.get('library', [])],
        })
    return out


def write(store, receipt, entries):
    """merge the entries into the scope's manifest, replacing our own ids"""
    manifest = store / receipt['scope'] / 'manifest.json'
    doc = json.loads(manifest.read_text()) if manifest.exists() else []
    assets = doc if isinstance(doc, list) else doc['assets']
    ours = {entry['id'] for entry in entries}
    assets[:] = [entry for entry in assets if entry.get('id') not in ours]
    assets.extend(entries)
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(doc, indent=2) + '\n')
    return manifest


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--work-root':
        # the shell asks where the work folder is, so a build log never lands
        # in the repository
        print(store_root(sys.argv[2]).parent / 'blender')
        return
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    receipt_path = Path(sys.argv[1])
    receipt = json.loads(receipt_path.read_text())
    packed = {}
    for pair in sys.argv[2:]:
        tier, _, file = pair.partition('=')
        packed[tier] = file
    store = store_root(receipt.get('app', Path.cwd()))
    entries = records(receipt, packed)
    manifest = write(store, receipt, entries)
    print(f'{manifest}: {len(entries)} record(s)')
    width = max(len(t) for t in packed)
    print(f'{"tier".ljust(width)}  {"atlas":>6}  {"triangles":>10}  {"packed":>10}  id')
    for entry in entries:
        tier = entry['tier']
        print(f'{tier.ljust(width)}  {entry["gltf"]["resolution"]:>6}  {entry["tris"]:>10,}  '
              f'{entry["bytes"] / 1024 / 1024:>9.2f}M  {entry["id"]}')


if __name__ == '__main__':
    main()
