"""Where a build script reads and writes.

Three roots, found by walking up from the app rather than counted in folders,
so a script runs the same from the sealed app and from a round's clone: the
asset STORE (the museum's bytes, outside the public repository), the LIBRARY
inside it (the CC0 sets a surface is dressed from), and the WORK folder beside
the store, which holds the authoring blend, the atlases and the raw export.
Only the packed glb crosses into the store, and nothing at all crosses into
the repository: an atlas or a blend committed there would be the store moving
into public git, which the Manifest Law forbids.
"""

from pathlib import Path
import os


def app_root() -> Path:
    """the app the script was run from (the shell sets cwd, never the script)"""
    return Path(os.getcwd()).resolve()


def store() -> Path:
    """the asset store: internal/night-agora/assets, wherever the app stands"""
    named = os.getenv('NA_ASSET_STORE')
    if named:
        return Path(named).resolve()
    here = app_root()
    for _ in range(12):
        inside = here / 'internal' / 'night-agora' / 'assets'
        if inside.exists():
            return inside
        if here.name == 'night-agora' and (here / 'assets').exists():
            return here / 'assets'
        if here.parent == here:
            break
        here = here.parent
    raise SystemExit('no asset store found above ' + str(app_root()))


def library() -> Path:
    return store() / 'library'


def work(object_id: str) -> Path:
    """the authoring folder: the blend, the atlases, the raw glb, the receipt"""
    out = store().parent / 'blender' / object_id
    out.mkdir(parents=True, exist_ok=True)
    return out


def models(scope: str, object_id: str) -> Path:
    """where the packed tiers stand in the store, one folder per object"""
    out = store() / scope / 'models' / object_id
    out.mkdir(parents=True, exist_ok=True)
    return out
