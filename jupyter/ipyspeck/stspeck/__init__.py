"""Deprecated: the Streamlit component is now the separate `stspeck` package.

    pip install stspeck

This module forwards the old ``ipyspeck.stspeck.Speck(data, ...)`` call to
``stspeck.speck``, which accepts every ipyspeck setting.
"""

import warnings


def Speck(data, **kwargs):
    """Old entry point; use ``stspeck.speck`` instead."""
    warnings.warn("ipyspeck.stspeck is deprecated; install stspeck and use stspeck.speck()",
                  DeprecationWarning, stacklevel=2)
    try:
        import stspeck
    except ImportError as e:
        raise ImportError("The Streamlit component moved to the stspeck package: "
                          "pip install stspeck") from e
    kwargs.pop("width", None)  # the viewer now fills the column width
    height = kwargs.pop("height", 400)
    if isinstance(height, str):
        height = int(float(height.replace("px", "")))
    return stspeck.speck(data=data, height=height, **kwargs)
