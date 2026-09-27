"""Make a video of any PDB entry: streamlit run example/video_app.py"""
import streamlit as st

import stspeck
from stspeck import shots

st.set_page_config(page_title="Molecule videos", layout="wide")
st.title("Make a video of a molecule")
st.write("Choose a structure and a video, watch it, then press **Save video** under the "
         "molecule. The MP4 is made in your browser and saved to your downloads.")


@st.cache_data
def pdb(pdb_id):
    return stspeck.fetch_pdb(pdb_id)


left, right = st.columns([1, 3])
with left:
    pdb_id = st.text_input("PDB ID", "4HHB").strip().upper()
    names = list(shots.RECIPES)
    name = st.selectbox("Video", names, index=names.index("tour"),
                        format_func=lambda n: "%s: %s" % (n, shots.RECIPES[n][1]))
    seconds = st.slider("Length (seconds)", 3, 30, shots.RECIPES[name][0])
    title = st.text_input("Title (optional)", "")
    size = st.selectbox("Size", ["1080p", "720p", "4k", "square", "vertical"],
                        help="square: social media posts; vertical: phones and stories")
    look = st.selectbox("Look", list(stspeck.PRESETS), index=list(stspeck.PRESETS).index("glossy"))
    dark = st.checkbox("Dark background")

try:
    structure = pdb(pdb_id)
except Exception as e:
    st.error("Could not load %s from the PDB: %s" % (pdb_id, e))
    st.stop()

video = {"size": size, "fps": 30, "filename": "%s_%s.mp4" % (pdb_id.lower(), name)}
if dark:
    video.update(background=["#1b2330", "#07090d"], vignette=0.3)

with right:
    stspeck.speck(**structure, preset=look, height=560, key="viewer",
                  film=shots.video(name, seconds=seconds, title=title or None), video=video)
    st.caption("'tour' and 'focus' visit the largest ligand; 'trajectory' needs an entry with "
               "several models (e.g. 1D3Z). The clapperboard button in the viewer offers the same videos.")
