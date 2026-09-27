"""Speck molecule viewer for Streamlit.

The same renderer and settings as the ipyspeck Jupyter widget: ambient
occlusion, cartoons, molecular surfaces, materials, shadows, highlighting,
trajectories and unit cells.

    import streamlit as st
    import stspeck

    stspeck.speck(**stspeck.fetch_alphafold("Q8W3K0"), preset="cover", height=500)
"""

import os

import streamlit.components.v1 as components

from ._io import (count_frames, fetch_alphafold, fetch_pdb, from_ase, from_mdanalysis, from_mdtraj,
                  from_pymatgen, from_rdkit, read_file)
from . import shots

__version__ = "0.8.3"

__all__ = ["speck", "shots", "SETTINGS", "PRESETS", "count_frames", "fetch_alphafold", "fetch_pdb",
           "from_ase", "from_mdanalysis", "from_mdtraj", "from_pymatgen", "from_rdkit", "read_file"]

# Settings with their defaults; identical to the ipyspeck traits.
SETTINGS = {
    # atoms and bonds
    "bonds": True, "atomScale": 0.24, "relativeAtomScale": 0.64, "bondScale": 0.5,
    "bondThreshold": 1.2, "bondShade": 0.5, "atomShade": 0.5, "ligands": True, "water": True,
    # colors
    "colorScheme": "speck", "atomColors": {}, "atomColor": "element", "palette": "default",
    # highlighting
    "highlight": {}, "highlightColor": "", "highlightScale": 1.0, "ghost": 0.0,
    # lighting and effects
    "ao": 0.75, "aoRes": 256, "aoSamples": 1024, "spf": 32, "brightness": 0.5,
    "outline": 0.0, "outlineWidth": 1.0, "outlineColor": "#000000", "outlineMode": "depth",
    "floor": 0.0, "floorReflection": 0.3,
    "shadows": 0.0, "shadowSoftness": 1.5, "rim": 0.0, "fog": 0.0, "fogColor": "#ffffff",
    "saturation": 1.0, "tonemap": False, "fxaa": 1, "dofStrength": 0.0, "dofPosition": 0.5, "dofFocus": {},
    # materials
    "specular": 0.0, "gloss": 0.5, "metallic": 0.0, "metallicAtoms": "all",
    # cartoon
    "cartoon": False, "cartoonColor": "ss", "cartoonAtoms": "ligands", "cartoonHelixWidth": 2.6,
    "cartoonSheetWidth": 2.4, "cartoonThickness": 0.6, "cartoonTubeRadius": 0.3,
    "cartoonQuality": 8, "cartoonShade": 0.2,
    # surface
    "surface": False, "surfaceColor": "element", "surfaceAtoms": "polymer", "surfaceProbe": 1.4,
    "surfaceResolution": 0.5, "surfaceShade": 0.1, "surfaceOpacity": 1.0,
    # unit cell and trajectory
    "unitCell": False, "cellColor": "#666666", "cellRadius": 0.12, "frame": 0, "cutaway": 0.0, "cutawayAxis": "view",
    "cutawayLight": 0.5,
    # interface
    "autoRotate": False, "toolbar": True,
}

# Named looks, as in ipyspeck.Speck.apply_preset. Each starts from 'default'.
PRESETS = {
    "default": dict(ao=0.75, brightness=0.5, atomShade=0.5, bondShade=0.5, cartoonShade=0.2,
                    surfaceShade=0.1, outline=0.0, outlineWidth=1.0, outlineColor="#000000",
                    specular=0.0, gloss=0.5, metallic=0.0, metallicAtoms="all", shadows=0.0,
                    rim=0.0, fog=0.0, fogColor="#ffffff", saturation=1.0, tonemap=False, dofStrength=0.0,
                    surfaceOpacity=1.0, surfaceColor="element", atomColor="element", palette="default",
                    water=True,
                    outlineMode="depth"),
    "matte": dict(ao=0.9, brightness=0.55),
    "glossy": dict(specular=0.6, gloss=0.65, rim=0.2, tonemap=True),
    "toon": dict(ao=0.3, outline=1.0, outlineWidth=1.5, atomShade=0.3, cartoonShade=0.1),
    "cover": dict(ao=1.0, brightness=0.55, specular=0.5, gloss=0.6, shadows=0.6, rim=0.35,
                  fog=0.35, saturation=1.15, tonemap=True, outline=0.2, atomShade=0.25,
                  cartoonShade=0.05),
    "metal": dict(metallic=1.0, metallicAtoms="metals", gloss=0.75, specular=0.6, atomShade=0.1,
                  tonemap=True),
    "glass": dict(surface=True, surfaceOpacity=0.35, surfaceColor="#e8e4dc", specular=0.4,
                  gloss=0.7, cartoon=True),
    "goodsell": dict(ao=0.3, brightness=0.82, atomShade=0.0, outline=1.0, outlineWidth=0.9, fog=0.4,
                     fogColor="#000000",
                     outlineColor="#141414", outlineMode="molecules", atomColor="chain",
                     palette="goodsell", cartoon=False, surface=False, bonds=False, water=False,
                     atomScale=0.7, relativeAtomScale=1.0),
}

_DEV_URL = os.environ.get("STSPECK_DEV_URL")
if _DEV_URL:
    _component = components.declare_component("stspeck", url=_DEV_URL)
else:
    _component = components.declare_component(
        "stspeck", path=os.path.join(os.path.dirname(os.path.abspath(__file__)), "static"))


def speck(data="", *, trajectory=None, height=400, preset=None, camera=None, return_state=False,
          export_width=None, export_height=None, export_scale=2, export_supersample=2,
          export_transparent=True, export_background="#ffffff", export_filename="speck.png",
          film=None, film_loop=True, video=None, key=None, **settings):
    """Show a molecule with the Speck renderer.

    Parameters
    ----------
    data : str
        Structure text: PDB, mmCIF, SDF / MOL or XYZ / extended XYZ. The
        loaders (fetch_pdb, fetch_alphafold, from_ase, from_mdtraj, ...)
        return keyword dicts to splat into this call.
    trajectory : bytes, optional
        Frames for `data` as little-endian float32 x, y, z of every atom,
        frame after frame (from_mdtraj and from_mdanalysis fill it in).
        Drive `frame=` with a slider; count_frames(data, trajectory) gives
        the number of frames.
    height : int
        Height of the viewer in pixels (it fills the column width).
    preset : str, optional
        Named look applied under the explicit settings: default, matte,
        glossy, toon, cover, metal or glass.
    camera : dict, optional
        Camera to restore, as returned in the state (see return_state).
    return_state : bool
        When True the component returns a dict with the camera, the current
        settings (including toolbar changes) and nframes, and the app reruns
        when they change. When False (default) it returns None and never
        triggers reruns.
    export_width, export_height, export_scale, export_supersample,
    export_transparent, export_background, export_filename
        High-resolution PNG downloaded by the toolbar's camera button: give
        width and/or height in pixels (the other side keeps the on-screen
        aspect) or a scale of the on-screen size. The largest side is
        limited to 4096 px.
    film : str, dict or list, optional
        A video played in the viewer with a player bar: play / pause, a
        time slider, and "Save video", which renders it as an MP4 in the
        browser and downloads it (Chrome, Edge, Safari 16.4+, Firefox 130+).
        A ready-made video by name: "spin", "rock", "orbit", "tour",
        "focus", "reveal", "trajectory" or "showcase" (stspeck.shots.RECIPES),
        or shots.video("tour", seconds=10, title="Hemoglobin"), or your own
        list of shots. film_loop repeats it. The viewer's video button
        (clapperboard) offers the ready-made videos without code.
    video : dict, optional
        Options for that MP4: size ('720p', '1080p', '4k', 'square',
        'vertical', ... or [width, height]), fps, samples, background (a
        color or a list for a gradient), vignette, credit, motionBlur,
        filename. See ipyspeck's Speck.save_video.
    key : str, optional
        Streamlit widget key.
    **settings
        Any ipyspeck setting (see SETTINGS for names and defaults), e.g.
        cartoon=True, surface=True, surfaceOpacity=0.35, shadows=0.6,
        highlight={"resName": "HEM"}, frame=3.

    Toolbar changes (styles, cartoon / surface / ligand toggles) are kept
    across reruns; a setting passed from Python applies again whenever its
    value changes.
    """
    unknown = sorted(set(settings) - set(SETTINGS))
    if unknown:
        raise TypeError("unknown stspeck settings %s; see stspeck.SETTINGS" % unknown)
    # Always send every setting, so a removed argument returns to its default.
    values = dict(SETTINGS)
    if preset is not None:
        if preset not in PRESETS:
            raise ValueError("unknown preset %r; choose from %s" % (preset, ", ".join(PRESETS)))
        values.update(PRESETS["default"])
        values.update(PRESETS[preset])
    values.update(settings)
    export = {"width": export_width, "height": export_height, "scale": export_scale,
              "supersample": export_supersample, "transparent": export_transparent,
              "background": export_background, "filename": export_filename}
    film_args = None
    if film is not None:
        film_args = {"film": shots.spec(film), "loop": bool(film_loop), "video": dict(video or {})}
    return _component(
        film=film_args, data=data, trajectory=bytes(trajectory) if trajectory else None,
        height=int(height), camera=camera or {}, return_state=bool(return_state),
        export={k: v for k, v in export.items() if v is not None}, key=key, default=None,
        **values)
