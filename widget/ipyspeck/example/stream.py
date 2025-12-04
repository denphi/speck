import streamlit as st
from ipyspeck import stspeck

H2O='''3
Water molecule
O          0.00000        0.00000        0.11779
H          0.00000        0.75545       -0.47116
H          0.00000       -0.75545       -0.47116'''

with st.sidebar:
    ao = st.selectbox("Select a molecule",[0, 0.1, 0.2 ,0.5, 0.8,1])
    bonds = st.selectbox("Select a molecule",[True,False])

res = stspeck.Speck(
data=H2O,
bonds=bonds,
ao=ao,
width="800px",
height="600px"
)
