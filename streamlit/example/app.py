"""stspeck demo: streamlit run example/app.py"""
import streamlit as st

import stspeck

st.set_page_config(page_title="stspeck", layout="wide")
st.title("stspeck")


@st.cache_data
def alphafold(uniprot):
    return stspeck.fetch_alphafold(uniprot)


@st.cache_data
def pdb(pdb_id):
    return stspeck.fetch_pdb(pdb_id)


left, right = st.columns([1, 3])
with left:
    source = st.radio("Structure", ["AlphaFold Q8W3K0 (RPP7)", "PDB 4HHB (hemoglobin)", "PDB 1D3Z (NMR ensemble)"])
    preset = st.selectbox("Preset", list(stspeck.PRESETS), index=list(stspeck.PRESETS).index("cover"))
    surface = st.checkbox("Surface")
    opacity = st.slider("Surface opacity", 0.0, 1.0, 0.35)
    highlight_hem = st.checkbox("Highlight hemes (4HHB)")

if source.startswith("AlphaFold"):
    structure = alphafold("Q8W3K0")
elif "4HHB" in source:
    structure = pdb("4HHB")
else:
    structure = pdb("1D3Z")

extra = {}
if "1D3Z" in source:
    with left:
        extra["frame"] = st.slider("Model", 0, stspeck.count_frames(structure["data"]) - 1, 0)
if highlight_hem and "4HHB" in source:
    extra.update(highlight={"resName": "HEM"}, highlightScale=1.3, ghost=0.6, cartoonColor="chain")

with right:
    state = stspeck.speck(**structure, preset=preset, surface=surface, surfaceOpacity=opacity,
                          height=600, return_state=True, export_width=3000, key="viewer", **extra)
with left:
    if state:
        st.caption("Toolbar state: cartoon=%s, surface=%s, ligands=%s" %
                   (state["cartoon"], state["surface"], state["ligands"]))
