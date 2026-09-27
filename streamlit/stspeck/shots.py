"""Videos: ready-made ones by name, or your own films built from shots.

The quickest way is a ready-made video (see RECIPES)::

    w = Speck.from_pdb_id("4HHB", cartoon=True)
    w.preview("tour")                          # watch it in the widget
    w.save_video("hemoglobin.mp4", "tour", title="Hemoglobin")

Your own film is a list of shots, played one after another::

    from ipyspeck import Speck, shots      # or: import stspeck; from stspeck import shots

    w = Speck.from_pdb_id("4HHB")
    film = [
        shots.title("Hemoglobin", subtitle="PDB 4HHB"),
        shots.orbit(6, degrees=180),
        shots.fly_to({"resName": "HEM", "chain": "A"}, 3),
        shots.rack_focus({"resName": "HEM", "chain": "A"}),
        shots.home(2),
    ]
    w.preview(film)                      # plays in the widget
    w.save_video("hemoglobin.mp4", film)  # renders the video in the browser
    # stspeck: stspeck.speck(**stspeck.fetch_pdb("4HHB"), film=film)

Each shot starts where the previous one ended. shots.together() runs shots
at the same time, e.g. a title over a turn. Every shot takes `ease`:
'linear', 'smooth' (slow in and out), 'in', 'out' or 'sine'. Selections
are dicts like highlight's ({"chain": "A"}, {"resName": "HEM"}, ...).
"""

# This file is identical in ipyspeck and stspeck.

__all__ = ['RECIPES', 'video', 'hold', 'turntable', 'rock', 'orbit', 'zoom', 'fly_to', 'home', 'rack_focus', 'cut_open',
           'fade', 'crossfade', 'trajectory', 'keyframes', 'title', 'together', 'loop', 'duration']

EASES = ('linear', 'smooth', 'in', 'out', 'sine')

# Ready-made videos: name -> (default seconds, what it shows). The ligand is
# the structure's largest one unless you give a target.
RECIPES = {
    'spin': (8, 'One full turn; loops seamlessly'),
    'rock': (6, 'A gentle swing back and forth; loops seamlessly'),
    'orbit': (10, 'A full turn around a tilted axis, showing top and bottom'),
    'tour': (12, 'Turns, flies in to the ligand (or target), looks around it and returns'),
    'focus': (8, 'Moves close to the ligand (or target) and pulls the focus onto it'),
    'reveal': (8, 'Slices the structure open while it turns, to show the inside'),
    'trajectory': (8, 'Plays the trajectory frames smoothly while swinging gently'),
    'showcase': (16, 'Half a turn, then the ligand up close (or the inside), and back'),
}


def video(name, seconds=None, target=None, title=None, subtitle=None):
    """A ready-made video by name (see RECIPES), e.g. video('tour', seconds=10,
    title='Hemoglobin'). target: a selection to visit instead of the largest
    ligand, e.g. {'chain': 'B'} or {'resName': 'HEM', 'chain': 'A'}."""
    if name not in RECIPES:
        raise ValueError('unknown video %r; choose one of: %s' % (name, ', '.join(RECIPES)))
    if seconds is not None and not seconds > 0:
        raise ValueError('seconds must be a positive number')
    spec = {'recipe': name}
    for key, value in (('seconds', seconds), ('target', target), ('title', title), ('subtitle', subtitle)):
        if value is not None:
            spec[key] = value
    return spec


def _shot(type, **values):
    ease = values.get('ease')
    if ease is not None and ease not in EASES:
        raise ValueError('ease must be one of %s' % ', '.join(EASES))
    seconds = values.get('seconds')
    if seconds is not None and not seconds >= 0:
        raise ValueError('seconds must be >= 0')
    shot = {'type': type}
    shot.update({k: v for k, v in values.items() if v is not None})
    return shot


def hold(seconds=1):
    """Nothing moves for `seconds`."""
    return _shot('hold', seconds=seconds)


def turntable(seconds=6, degrees=360, axis='y', ease=None):
    """Turn about the screen's vertical axis ('y'), or 'x' (tumble forward).
    Steady speed by default, so a full turn loops seamlessly."""
    return _shot('turntable', seconds=seconds, degrees=degrees, axis=axis, ease=ease)


def rock(seconds=4, degrees=30, cycles=1, axis='y', ease=None):
    """Swing `degrees` to each side and back, `cycles` times; loops seamlessly."""
    return _shot('rock', seconds=seconds, degrees=degrees, cycles=cycles, axis=axis, ease=ease)


def orbit(seconds=8, degrees=360, tilt=20, ease=None):
    """Turn about an axis tilted `tilt` degrees toward the viewer, so the top
    and bottom come into view too."""
    return _shot('orbit', seconds=seconds, degrees=degrees, tilt=tilt, ease=ease)


def zoom(seconds=2, factor=2, ease=None):
    """Move closer: `factor` times larger (below 1 moves away)."""
    return _shot('zoom', seconds=seconds, factor=factor, ease=ease)


def fly_to(selection, seconds=3, zoom=None, face=False, ease=None):
    """Center a selection and fit it in the picture, or magnify `zoom` times
    instead of fitting. face=True also turns the structure so the selection
    faces you (a ligand in a pocket is seen from outside, not through the
    protein)."""
    return _shot('fly_to', selection=selection, seconds=seconds, zoom=zoom, face=face or None, ease=ease)


def home(seconds=2, ease=None):
    """Back to the camera the film started with."""
    return _shot('home', seconds=seconds, ease=ease)


def rack_focus(to, seconds=2, start=None, strength=None, ease=None):
    """Depth of field moves its focus to `to` (a selection, or a depth from 0,
    front, to 1, back) from `start` (default: the current focus). Turns depth
    of field on (to `strength`, default 1) if it was off; the focus then
    stays on the selection as the camera moves."""
    shot = _shot('rack_focus', to=to, seconds=seconds, strength=strength, ease=ease)
    if start is not None:
        shot['from'] = start
    return shot


def cut_open(seconds=2, to=0.5, axis=None, ease=None):
    """The cutaway plane moves in to depth `to` (0.5: through the middle; 0
    closes it). axis: 'view', 'x', 'y' or 'z' (see cutawayAxis)."""
    return _shot('cut_open', seconds=seconds, to=to, axis=axis, ease=ease)


def fade(seconds=1.5, ease=None, **settings):
    """Change settings smoothly: numbers and colors blend (e.g.
    fade(2, surfaceOpacity=0.3, fog=0.5)); a switch turned on changes at the
    start, turned off at the end."""
    if not settings:
        raise ValueError('fade needs settings, e.g. fade(2, surfaceOpacity=0.3)')
    return _shot('fade', seconds=seconds, settings=settings, ease=ease)


def crossfade(seconds=1.5, ease=None, **settings):
    """Dissolve into the picture with new settings, for changes that cannot
    blend (e.g. crossfade(cartoon=False, surface=True))."""
    if not settings:
        raise ValueError('crossfade needs settings, e.g. crossfade(surface=True)')
    return _shot('crossfade', seconds=seconds, settings=settings, ease=ease)


def trajectory(seconds=5, start=0, end=None, interpolate=True, ease=None):
    """Play trajectory frames `start` to `end` (default: the last) in
    `seconds`, blending between frames for smooth motion (interpolate=False
    shows each frame as it is)."""
    return _shot('trajectory', seconds=seconds, start=start, end=end, interpolate=interpolate, ease=ease)


def keyframes(keys, seconds=None, ease=None):
    """Pass through keys from Speck.keyframe(): the camera follows a smooth
    path and settings blend from key to key. Keys without a 'time' (seconds)
    are spread evenly over `seconds` (default 2 s apart)."""
    keys = list(keys)
    if not keys:
        raise ValueError('keyframes needs at least one key')
    return _shot('keyframes', keys=keys, seconds=seconds, ease=ease)


def title(text, seconds=3, subtitle=None, position='bottom-left', size=1, color=None, fade=None):
    """Text over the picture, fading in and out. position: 'top-left', 'top',
    'top-right', 'center', 'bottom-left', 'bottom' or 'bottom-right'. Use
    together() to show it during a camera move."""
    return _shot('title', text=text, seconds=seconds, subtitle=subtitle, position=position, size=size,
                 color=color, fade=fade)


def together(*shots, seconds=None):
    """Run shots at the same time (as long as the longest one)."""
    return _shot('together', shots=list(_flatten(shots)), seconds=seconds)


def loop(film, times=2):
    """The film repeated `times` times."""
    return list(_flatten(film)) * times


def duration(film):
    """Seconds a film lasts (keyframe paths without times count 2 s per key)."""
    total = 0.0
    for shot in _flatten(film):
        total += _seconds(shot)
    return total


_DEFAULT_SECONDS = {'hold': 1, 'turntable': 6, 'rock': 4, 'orbit': 8, 'zoom': 2, 'fly_to': 3, 'home': 2,
                    'rack_focus': 2, 'cut_open': 2, 'fade': 1.5, 'crossfade': 1.5, 'trajectory': 5, 'title': 3}


def _seconds(shot):
    if shot['type'] == 'together':
        return shot.get('seconds') if shot.get('seconds') is not None else max(
            [_seconds(s) for s in shot['shots']] or [0])
    if shot['type'] == 'keyframes':
        keys = shot['keys']
        times = [k.get('time') for k in keys if k.get('time') is not None]
        if times:
            return max(times)
        n = len(keys) - (1 if keys[0].get('time') == 0 else 0)
        return shot['seconds'] if shot.get('seconds') is not None else 2.0 * n
    return shot.get('seconds', _DEFAULT_SECONDS[shot['type']])


def _flatten(shots):
    """Shots, lists of shots (films) and single shots, as one list."""
    if isinstance(shots, dict):
        yield shots
        return
    for s in shots:
        if isinstance(s, dict):
            if 'type' not in s:
                raise ValueError('not a shot: %r' % (s,))
            yield s
        else:
            for t in _flatten(s):
                yield t


def film(shots):
    """A film (list of shot dicts) from shots or lists of shots."""
    return list(_flatten(shots))


def spec(film, seconds=None, target=None, title=None, subtitle=None):
    """What the viewer plays: a ready-made video's name, video(...), or a list
    of shots, with an optional title over the first seconds."""
    if isinstance(film, str):
        return video(film, seconds=seconds, target=target, title=title, subtitle=subtitle)
    if isinstance(film, dict) and 'recipe' in film:
        out = video(film['recipe'], film.get('seconds', seconds), film.get('target', target),
                    film.get('title', title), film.get('subtitle', subtitle))
        return out
    if seconds is not None or target is not None:
        raise ValueError('seconds and target apply to ready-made videos (a name such as "tour")')
    out = {'shots': list(_flatten(film))}
    if not out['shots']:
        raise ValueError('the film has no shots')
    if title is not None:
        out['title'] = title
    if subtitle is not None:
        out['subtitle'] = subtitle
    return out


def spec_seconds(s):
    """Seconds of a spec() (ready-made videos: their default or `seconds`)."""
    if 'recipe' in s:
        return s.get('seconds') or RECIPES[s['recipe']][0]
    return duration(s['shots'])
