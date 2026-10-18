"""Body-plan archetypes and the deposits (localities) that bias which ones you find.

Each archetype is a box of parameter ranges loosely based on a real trilobite group.
A specimen draws from a primary archetype and is blended with a secondary one, so most
seeds look like a recognisable group and some land between groups - plausible animals
that nobody has found.
"""

# Ranges are (lo, hi). Lengths are fractions of the body length (spines excluded).
ARCHETYPES = {
    # Elrathia-like: small, smooth, short genal spines, tiny tail.
    "ptychopariid": dict(
        n_thorax=(11, 14), ceph_len=(.32, .38), pyg_len=(.07, .11), ceph_halfwidth=(.42, .5),
        ceph_shape=(1.8, 2.3), thorax_front=(.92, 1.0), thorax_taper=(.5, .65), pyg_shape=(1.6, 2.4),
        n_pyg=(2, 3), axial_ratio=(.22, .28), height=(.06, .085), glabella_len=(.6, .75),
        glabella_front=(.7, .9), glabella_height=(.12, .25), eye_x=(.5, .6), eye_y=(.4, .55),
        eye_size=(.03, .05), genal_spine=(.02, .12), genal_angle=(.05, .2), pleural_spine=(0, .02),
        occipital_spine=(0, 0), tail_spine=(0, 0), pyg_spines=(0, 0), tubercles=(0, .1), border=(.5, .8),
    ),
    # Olenellus/Redlichia-like: many segments, long genal spines, crescent eyes, tiny tail.
    "redlichiid": dict(
        n_thorax=(14, 18), ceph_len=(.27, .34), pyg_len=(.03, .05), ceph_halfwidth=(.48, .6),
        ceph_shape=(1.9, 2.4), thorax_front=(.88, .98), thorax_taper=(.3, .5), pyg_shape=(1.5, 2.5),
        n_pyg=(1, 1), axial_ratio=(.24, .3), height=(.065, .09), glabella_len=(.82, .95),
        glabella_front=(1.0, 1.3), glabella_height=(.2, .35), eye_x=(.42, .55), eye_y=(.35, .6),
        eye_size=(.08, .12), genal_spine=(.35, .75), genal_angle=(.05, .25), pleural_spine=(.08, .18),
        occipital_spine=(0, .08), tail_spine=(0, .05), pyg_spines=(0, 0), tubercles=(0, .15), border=(.3, .6),
    ),
    # Isotelus/Asaphus-like: smooth, wide, big tail shield, effaced segmentation.
    "asaphid": dict(
        n_thorax=(8, 8), ceph_len=(.33, .39), pyg_len=(.28, .36), ceph_halfwidth=(.46, .55),
        ceph_shape=(2.0, 2.8), thorax_front=(.95, 1.0), thorax_taper=(.8, .95), pyg_shape=(1.8, 2.6),
        n_pyg=(4, 7), axial_ratio=(.26, .32), height=(.1, .14), glabella_len=(.55, .75),
        glabella_front=(.9, 1.15), glabella_height=(.08, .2), eye_x=(.45, .55), eye_y=(.35, .5),
        eye_size=(.045, .07), genal_spine=(0, .25), genal_angle=(.05, .2), pleural_spine=(0, 0),
        occipital_spine=(0, 0), tail_spine=(0, 0), pyg_spines=(0, 0), tubercles=(0, .05), border=(.3, .6),
    ),
    # Phacops-like: bulbous expanding glabella, big compound eyes, tuberculate, often rolled.
    "phacopid": dict(
        n_thorax=(11, 11), ceph_len=(.3, .36), pyg_len=(.16, .23), ceph_halfwidth=(.4, .48),
        ceph_shape=(1.6, 2.1), thorax_front=(.95, 1.02), thorax_taper=(.5, .68), pyg_shape=(1.7, 2.4),
        n_pyg=(5, 8), axial_ratio=(.3, .36), height=(.12, .17), glabella_len=(.88, .98),
        glabella_front=(1.5, 1.9), glabella_height=(.45, .7), eye_x=(.55, .64), eye_y=(.3, .45),
        eye_size=(.07, .1), genal_spine=(0, .04), genal_angle=(.05, .15), pleural_spine=(0, 0),
        occipital_spine=(0, 0), tail_spine=(0, 0), pyg_spines=(0, 0), tubercles=(.5, 1.0), border=(.2, .4),
    ),
    # Dalmanites-like: tall eyes, swept genal spines, a long tail spine.
    "dalmanitid": dict(
        n_thorax=(11, 11), ceph_len=(.27, .33), pyg_len=(.22, .3), ceph_halfwidth=(.45, .52),
        ceph_shape=(1.4, 1.9), thorax_front=(.93, 1.0), thorax_taper=(.55, .7), pyg_shape=(1.3, 1.8),
        n_pyg=(8, 11), axial_ratio=(.27, .33), height=(.09, .13), glabella_len=(.85, .95),
        glabella_front=(1.2, 1.55), glabella_height=(.3, .5), eye_x=(.5, .6), eye_y=(.35, .5),
        eye_size=(.07, .1), genal_spine=(.2, .45), genal_angle=(.05, .2), pleural_spine=(0, .04),
        occipital_spine=(0, 0), tail_spine=(.2, .45), pyg_spines=(0, 0), tubercles=(.2, .5), border=(.2, .5),
    ),
    # Odontopleurid-like (Walliserops, Kettneraspis): spines everywhere.
    "odontopleurid": dict(
        n_thorax=(9, 10), ceph_len=(.3, .36), pyg_len=(.1, .15), ceph_halfwidth=(.45, .55),
        ceph_shape=(1.8, 2.4), thorax_front=(.92, 1.0), thorax_taper=(.6, .8), pyg_shape=(1.6, 2.4),
        n_pyg=(2, 3), axial_ratio=(.3, .38), height=(.1, .14), glabella_len=(.8, .92),
        glabella_front=(.85, 1.05), glabella_height=(.3, .5), eye_x=(.45, .55), eye_y=(.3, .45),
        eye_size=(.04, .06), genal_spine=(.4, .85), genal_angle=(.15, .4), pleural_spine=(.25, .5),
        occipital_spine=(.1, .3), tail_spine=(0, 0), pyg_spines=(2, 4), tubercles=(.6, 1.0), border=(.1, .3),
    ),
}

INT_PARAMS = {"n_thorax", "n_pyg", "pyg_spines"}

# Colours are linear RGB. "layers" are the matrix bed colours, picked per stratum.
LOCALITIES = {
    "cambrian_shale": dict(
        period="Middle Cambrian", rock="grey calcareous shale",
        archetypes={"ptychopariid": .65, "redlichiid": .35},
        fossil=[(.05, .045, .04), (.08, .07, .055)],
        layers=[(.42, .41, .38), (.36, .36, .34), (.48, .46, .42), (.30, .30, .29)],
    ),
    "ordovician_limestone": dict(
        period="Late Ordovician", rock="buff argillaceous limestone",
        archetypes={"asaphid": .7, "odontopleurid": .15, "dalmanitid": .15},
        fossil=[(.22, .14, .08), (.3, .2, .11)],
        layers=[(.55, .48, .36), (.62, .55, .42), (.48, .42, .32), (.58, .5, .38)],
    ),
    "devonian_limestone": dict(
        period="Middle Devonian", rock="tan-grey limestone",
        archetypes={"phacopid": .45, "dalmanitid": .3, "odontopleurid": .25},
        fossil=[(.035, .03, .028), (.06, .05, .04)],
        layers=[(.58, .52, .42), (.66, .6, .5), (.5, .46, .4), (.62, .54, .42)],
    ),
    "pyritised_shale": dict(
        period="Late Ordovician", rock="black pyritic shale",
        archetypes={"ptychopariid": .5, "redlichiid": .3, "asaphid": .2},
        fossil=[(.48, .3, .06), (.55, .36, .08)],
        layers=[(.1, .1, .1), (.13, .12, .11), (.08, .08, .085), (.16, .15, .13)],
    ),
}
