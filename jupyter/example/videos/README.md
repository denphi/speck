# Video examples

Step-by-step notebooks for making videos of molecules; no programming experience needed. Open
them in Jupyter Notebook or JupyterLab with `pip install ipyspeck` and run the cells from the top.

| Notebook | You will make |
|---|---|
| [01 Your first video](01_first_video.ipynb) | a hemoglobin tour in three steps, and how to change size, length and background |
| [02 Ready-made videos](02_ready_made_videos.ipynb) | every ready-made video: spin, rock, orbit, tour, focus, cut open, showcase |
| [03 A drug in its pocket](03_drug_in_its_pocket.ipynb) | a close-up of imatinib in ABL kinase, choosing what to look at |
| [04 Moving molecules](04_moving_molecules.ipynb) | an NMR ensemble played smoothly, and your own MD trajectory |
| [05 Materials](05_materials.ipynb) | a gold nanocluster: spin and cut through its core |
| [06 Your own film](06_your_own_film.ipynb) | a storyboard of shots, and moves you pose yourself |
| [07 A guided tour](07_guided_tour.ipynb) | a one-minute tour of a drug target's landmarks, from a list of stops |

## A guided tour

<img src="../../../media/videos/kinase_tour.gif" width="480"/>

ABL kinase with imatinib: the lobes, the hinge, the gatekeeper, the DFG motif, the P-loop and the drug,
each highlighted and captioned ([notebook 07](07_guided_tour.ipynb), [full video](../../../media/videos/kinase_tour.mp4)).

## Ready-made videos

One line each, e.g. `w.save_video("movie.mp4", "tour")`, or the clapperboard button in the viewer.

<table>
<tr>
<td align="center" width="25%"><img src="../../../media/videos/spin.gif" width="100%"/><br/><code>spin</code><br/><sub>one full turn, loops</sub></td>
<td align="center" width="25%"><img src="../../../media/videos/rock.gif" width="100%"/><br/><code>rock</code><br/><sub>swing back and forth, loops</sub></td>
<td align="center" width="25%"><img src="../../../media/videos/orbit.gif" width="100%"/><br/><code>orbit</code><br/><sub>a turn around a tilted axis</sub></td>
<td align="center" width="25%"><img src="../../../media/videos/tour.gif" width="100%"/><br/><code>tour</code><br/><sub>fly to the ligand and back</sub></td>
</tr>
<tr>
<td align="center" width="25%"><img src="../../../media/videos/focus.gif" width="100%"/><br/><code>focus</code><br/><sub>close-up, focus on the ligand</sub></td>
<td align="center" width="25%"><img src="../../../media/videos/reveal.gif" width="100%"/><br/><code>reveal</code><br/><sub>cut open while turning</sub></td>
<td align="center" width="25%"><img src="../../../media/videos/trajectory.gif" width="100%"/><br/><code>trajectory</code><br/><sub>play the frames smoothly</sub></td>
<td align="center" width="25%"><img src="../../../media/videos/showcase.gif" width="100%"/><br/><code>showcase</code><br/><sub>turn, close-up, back</sub></td>
</tr>
</table>
