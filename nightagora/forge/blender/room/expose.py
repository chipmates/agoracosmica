"""A PHOTOGRAPHER'S EXPOSURE for a Cycles frame: the linear EXR printed by the
engine's own curve at the exposure that puts the print's median where a
reference print has it, so two renderers are compared by light and surface
and not by level. Writes each print and the exposure it took.

python3 expose.py --render <cycles out dir> --print <export>/print.json \
    --reference <stills dir of the reference> --out <stills dir> [--frames wide/flight,...]

The EXR is read with OpenImageIO where the interpreter has it, else OpenCV.
The median is of the print's luma, 0.2126 R' + 0.7152 G' + 0.0722 B' on the
8-bit values, the measure the pilot's frames are compared by.
"""
import argparse
import copy
import json
import math
import os
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from print_engine import engine_print  # noqa: E402

LUMA = np.array([0.2126, 0.7152, 0.0722])
# the whole stage of each framing a crop's box is measured in
FULL_STAGES = {"wide": (2400, 1350), "upright": (1170, 2532)}


def read_exr(path):
    try:
        import OpenImageIO as oiio
        return oiio.ImageBuf(str(path)).get_pixels(oiio.FLOAT)[..., :3].astype(np.float64)
    except ImportError:
        os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
        import cv2
        a = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if a is None:
            raise FileNotFoundError(path)
        return a[..., :3][..., ::-1].astype(np.float64)


def read_png(path):
    from PIL import Image
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)


def write_png(path, rgb8):
    from PIL import Image
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb8).save(path)


def printed(linear, dials, stop, gain, frame=None):
    d = copy.deepcopy(dials)
    d["exposure"][stop] = dials["exposure"][stop] * gain
    return (engine_print(linear, d, stop, frame) * 255 + 0.5).clip(0, 255).astype(np.uint8)


def median_luma(rgb8):
    return float(np.median(rgb8.astype(np.float64) @ LUMA))


def solve(linear, dials, stop, target, tolerance=0.002):
    """the gain, in stops, whose print meets the target median; the median of
    the print rises with the gain, so halving the bracket finds it"""
    step = max(1, int(math.sqrt(linear.shape[0] * linear.shape[1] / 400_000)))
    sample = linear[::step, ::step]
    lo, hi = -5.0, 5.0
    while hi - lo > tolerance:
        mid = (lo + hi) / 2
        if median_luma(printed(sample, dials, stop, 2 ** mid)) < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--render", type=Path, required=True, help="a cycles_room.py output (its linear/ folder)")
    p.add_argument("--print", dest="print_json", type=Path, required=True)
    p.add_argument("--reference", type=Path, required=True, help="the reference's stills/rooms folder")
    p.add_argument("--out", type=Path, required=True, help="the stills/rooms folder to write")
    p.add_argument("--frames", default="wide/flight,wide/works,upright/flight,upright/works")
    p.add_argument("--print-stop", help="the stop whose dials a frame takes, when its name is not a stop")
    p.add_argument("--crop-names", default="joint,floor,wall", help="what each crop of a frame shows, in order")
    p.add_argument("--gains", type=Path, help="an exposure.json whose gains are taken as they stand (no solve)")
    args = p.parse_args(argv)
    dials = json.loads(args.print_json.read_text())
    record = {"law": "gain in stops over the stop's own exposure, so the print's median luma meets the reference's (bisection to 0.002 stop on a subsample, then the full print)",
              "frames": {}}
    for frame in args.frames.split(","):
        framing, name = frame.split("/")
        stop = args.print_stop or name
        linear = read_exr(args.render / "linear" / framing / f"{name}.exr")
        ref = read_png(args.reference / framing / f"{name}.png")
        target = float(np.median(ref @ LUMA))
        given = json.loads(args.gains.read_text())["frames"].get(frame) if args.gains else None
        stops = given["stops_over_dial"] if given else solve(linear, dials, stop, target)
        out = printed(linear, dials, stop, 2 ** stops)
        write_png(args.out / framing / f"{name}.png", out)
        at_dial = printed(linear, dials, stop, 1.0)
        record["frames"][frame] = {
            "stops_over_dial": round(stops, 3), "exposure": round(dials["exposure"][stop] * 2 ** stops, 4), "dial_exposure": dials["exposure"][stop],
            "reference_median": round(target, 2), "median": round(median_luma(out), 2), "median_at_dial": round(median_luma(at_dial), 2),
            "mean": round(float((out.astype(np.float64) @ LUMA).mean()), 2), "reference_mean": round(float((ref @ LUMA).mean()), 2),
        }
        # THE CROPS of this frame, at the frame's own exposure, the vignette
        # where the whole frame has it
        log = json.loads((args.render / "render-log.json").read_text())
        names = args.crop_names.split(",")
        k = 0
        for c in log.get("crops", []):
            if c["camera"] != frame:
                continue
            k += 1
            left, top, cw, ch = c["box"]
            fw, fh = [int(v) for v in c.get("stage", [0, 0])] or [0, 0]
            if not fw:
                fw, fh = FULL_STAGES[framing]
            lin = read_exr(args.render / "linear" / framing / f"{name}-crop{k}.exr")
            out_c = printed(lin, dials, stop, 2 ** stops, (fw, fh, left, top))
            label = names[k - 1] if k - 1 < len(names) else f"crop{k}"
            write_png(args.out.parent.parent / "crops" / framing / f"{name}-{k}-{label}.png", out_c)
            record["frames"][frame].setdefault("crops", []).append({"box": c["box"], "file": f"crops/{framing}/{name}-{k}-{label}.png"})
        print(frame, record["frames"][frame])
    args.out.mkdir(parents=True, exist_ok=True)
    # frames printed by an earlier call into the same folder are kept
    target = args.out.parent.parent / "exposure.json"
    if target.exists():
        earlier = json.loads(target.read_text())
        record["frames"] = {**earlier.get("frames", {}), **record["frames"]}
    target.write_text(json.dumps(record, indent=1) + "\n")


if __name__ == "__main__":
    main()
