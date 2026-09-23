"""THE ENGINE'S PRINT on a linear frame: stack/post.ts steps 5 to 7, then sRGB.
Shared by cycles_room.py (the render's own print) and expose.py (a print at a
photographer's exposure), so both lay the same curve."""
import numpy as np


def engine_print(rgb, dials, stop, frame=None):
    """stack/post.ts step 5 to 7, on the linear frame, then sRGB; `frame` =
    (width, height, left, top) places a crop in its whole frame, so the
    vignette falls where the whole frame has it"""
    c = rgb * dials["exposure"][stop]
    lum = lambda x: x[..., 0] * 0.2126 + x[..., 1] * 0.7152 + x[..., 2] * 0.0722
    c = c + np.asarray(dials["lift"]) * np.clip(1 - lum(c), 0, 1)[..., None]
    c = np.power(np.clip(c, 0, 8), 1 / np.asarray(dials["gamma"])) * np.asarray(dials["gain"])
    l = lum(c)[..., None]
    tint = np.asarray(dials["cool"]) + (np.asarray(dials["warm"]) - np.asarray(dials["cool"])) * np.clip(l * 1.6, 0, 1)
    c = c + (c * tint - c) * dials["split"]
    c = l + (c - l) * dials["saturation"]
    if dials["shoulder"][stop] > 0:
        start, desat = 0.8 - 0.04, 0.15
        x = c.min(axis=-1, keepdims=True)
        c = c - np.where(x < 0.08, x - 6.25 * x * x, 0.04)
        peak = c.max(axis=-1, keepdims=True)
        d = 1 - start
        new_peak = 1 - d * d / (peak + d - start)
        g = 1 - 1 / (desat * (peak - new_peak) + 1)
        comp = c * (new_peak / np.maximum(peak, 1e-9))
        comp = comp + (new_peak - comp) * g
        n = np.where(peak < start, c, comp)
        c = c + (n - c) * dials["shoulder"][stop]
    h, w = c.shape[:2]
    fw, fh, left, top = frame if frame else (w, h, 0, 0)
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = (xx + left + 0.5) / fw - 0.5, (yy + top + 0.5) / fh - 0.5
    r = np.sqrt(u * u + v * v)
    t = np.clip((r - 0.34) / (0.86 - 0.34), 0, 1)
    c = c * (1 - t * t * (3 - 2 * t) * dials["vignette"])[..., None]
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
