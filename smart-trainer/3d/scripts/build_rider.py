"""
Genera el ciclista 3D de la app desde cero, solo con material CC0 (cuerpo base de MakeHuman vía MPFB2).

Uso (Blender 4.5 con la extensión MPFB2 instalada):
    blender -b --python smart-trainer/3d/scripts/build_rider.py -- <salida.blend> <salida.glb>

El kit (maillot, culotte, calcetines, guantes y zapatillas) se crea copiando caras del propio cuerpo y
separándolas un poco de la piel: comparten topología y pesos con el cuerpo, así que deforman igual que él
y no hay que pintar pesos a mano. La piel que queda tapada se borra para no pagar triángulos invisibles.

Contrato con src/expedition/AvatarRider.js:
- Esqueleto con nombres de Mixamo ("mixamorig:Hips", "LeftUpLeg"...), sin animaciones: la app coloca el cuerpo con IK.
- Un material por pieza; la app solo recolorea "TopMain" (color del maillot) y "TopTrim" (tono secundario).
"""

import math
import sys
from collections import Counter

import bmesh
import bpy
from mathutils import Vector

from bl_ext.user_default.mpfb.services.humanservice import HumanService

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GRIP_AXIS = argv[2] if len(argv) > 2 else "X"
BLEND_OUT = argv[0] if len(argv) > 0 else None
GLB_OUT = argv[1] if len(argv) > 1 else None

# Ciclista de carretera: delgado, piernas musculadas, proporciones atléticas.
MACRO = {
    "gender": 1.0, "age": 0.45, "muscle": 0.72, "weight": 0.3, "proportions": 0.85, "height": 0.55,
    "cupsize": 0.5, "firmness": 0.5, "race": {"asian": 0.2, "caucasian": 0.6, "african": 0.2},
}

# Separación de cada pieza respecto a la piel (m) y grosor del dobladillo hacia dentro.
OFFSETS = {"jersey": 0.0045, "bib": 0.003, "sock": 0.0015, "glove": 0.002, "shoe": 0.004, "hair": 0.002}

# Colores base (sRGB lineal aproximado); la app sustituye los del maillot.
COLORS = {
    "Skin": (0.62, 0.40, 0.29), "TopMain": (0.18, 0.75, 0.55), "TopTrim": (0.92, 0.94, 0.95),
    "Bib": (0.018, 0.02, 0.024), "BibBand": (0.12, 0.13, 0.14), "Sock": (0.9, 0.9, 0.9),
    "Glove": (0.02, 0.022, 0.025), "Shoe": (0.92, 0.92, 0.9), "ShoeSole": (0.03, 0.03, 0.03),
    "Buzz": (0.05, 0.035, 0.025), "Eye": (0.02, 0.02, 0.02),
    "HelmetShell": (0.85, 0.87, 0.88), "HelmetDark": (0.03, 0.035, 0.04), "Lens": (0.02, 0.025, 0.035),
    "GlassesFrame": (0.9, 0.9, 0.9), "Strap": (0.02, 0.022, 0.025),
}
ROUGHNESS = {"HelmetShell": 0.3, "HelmetDark": 0.6, "Lens": 0.05, "GlassesFrame": 0.35, "Skin": 0.55, "TopMain": 0.6, "TopTrim": 0.6, "Bib": 0.45, "BibBand": 0.5, "Shoe": 0.35, "ShoeSole": 0.8, "Eye": 0.1}


def clean_scene():
    for collection in (bpy.data.objects, bpy.data.meshes, bpy.data.armatures, bpy.data.materials):
        for item in list(collection):
            collection.remove(item)


def make_material(name):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*COLORS[name], 1.0)
    bsdf.inputs["Roughness"].default_value = ROUGHNESS.get(name, 0.6)
    material.diffuse_color = (*COLORS[name], 1.0)
    return material


def create_body():
    body = HumanService.create_human(macro_detail_dict=MACRO)
    # Los morphs se hornean en la malla antes de crear el esqueleto, que se ajusta a la forma final.
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    eye_centers = helper_spheres(body)
    # El esqueleto se ajusta con los cubos de articulación, así que va antes de borrar los auxiliares.
    rig = HumanService.add_builtin_rig(body, "mixamo")
    rig.name = rig.data.name = "Rider"
    body.name = "Body"
    # Fuera la geometría auxiliar de MakeHuman (dientes, lengua, cubos de articulación...).
    for modifier in list(body.modifiers):
        if modifier.type == "MASK":
            body.modifiers.remove(modifier)
    body_group = body.vertex_groups["body"].index
    bm = bmesh.new()
    bm.from_mesh(body.data)
    deform = bm.verts.layers.deform.active
    bm.verts.ensure_lookup_table()
    helpers = [v for v in bm.verts if deform is None or v[deform].get(body_group, 0.0) < 0.5]
    bmesh.ops.delete(bm, geom=helpers, context="VERTS")
    bm.to_mesh(body.data)
    bm.free()
    return body, rig, eye_centers


def helper_spheres(body):
    """Centro y radio de los globos oculares a partir de los helpers de MakeHuman."""
    spheres = []
    for name in ("helper-l-eye", "helper-r-eye"):
        index = body.vertex_groups[name].index
        points = [body.matrix_world @ v.co for v in body.data.vertices if any(g.group == index and g.weight > 0.5 for g in v.groups)]
        lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
        hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
        spheres.append(((lo + hi) / 2, max(hi - lo) / 2))
    return spheres


def bone_names(rig):
    return {bone.name.split(":")[-1]: bone for bone in rig.data.bones}


def along(bone, point):
    """Posición relativa del punto a lo largo del hueso (0 = cabeza, 1 = cola)."""
    axis = bone.tail_local - bone.head_local
    return (point - bone.head_local).dot(axis) / axis.length_squared


# Cortes de las prendas: (nombre, huesos cuyas caras se cortan, hueso de referencia o None, parámetro).
# Con hueso de referencia, el plano es perpendicular al hueso en ese punto (0 = cabeza, 1 = cola).
LIMB_CUTS = [
    ("cuff", ("Shoulder", "Arm", "ForeArm"), "Arm", 0.36),
    ("sleeve", ("Shoulder", "Arm", "ForeArm"), "Arm", 0.47),
    ("wrist", ("ForeArm", "Hand"), "ForeArm", 0.93),
    ("thigh", ("Hips", "UpLeg", "Leg"), "UpLeg", 0.74),
    ("bibband", ("Hips", "UpLeg", "Leg"), "UpLeg", 0.68),
    ("sock", ("UpLeg", "Leg", "Foot"), "Leg", 0.8),
]


def dominant_bone(face, deform, groups):
    totals = Counter()
    for vertex in face.verts:
        for index, weight in vertex[deform].items():
            if index in groups:
                totals[groups[index]] += weight
    return totals.most_common(1)[0][0] if totals else None


def split_bone(bone):
    side = "Left" if bone.startswith("Left") else "Right" if bone.startswith("Right") else ""
    return side, bone[len(side):]


def kit_planes(rig):
    """Planos fijos del kit (punto, normal): bajo del maillot, cuello y caña de la zapatilla."""
    bones = bone_names(rig)
    hips = bones["Hips"].head_local
    neck = bones["Neck"].head_local
    ankle = bones["LeftFoot"].head_local
    return {
        # Bajo del maillot a la altura de la cadera, más largo por detrás (eje +Y = espalda).
        "hem": (Vector((0, hips.y, hips.z - 0.03)), Vector((0, 0.18, 1)).normalized()),
        # Cuello redondo, más bajo por delante.
        "collar": (Vector((0, neck.y, neck.z + 0.005)), Vector((0, -0.7, 1)).normalized()),
        "collarband": (Vector((0, neck.y, neck.z - 0.018)), Vector((0, -0.7, 1)).normalized()),
        # Caña de la zapatilla: algo más alta en el talón.
        "shoe": (Vector((0, ankle.y, 0.082)), Vector((0, -0.25, 1)).normalized()),
    }


def above(plane, point):
    origin, normal = plane
    return (point - origin).dot(normal) > 0


def cut_body(body, rig):
    """Corta la malla por los bordes de las prendas para que los dobladillos salgan rectos."""
    bones = bone_names(rig)
    groups = {group.index: group.name.split(":")[-1] for group in body.vertex_groups if group.name.startswith("mixamorig")}
    planes = kit_planes(rig)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    deform = bm.verts.layers.deform.active

    def bisect(faces, origin, normal):
        if not faces:
            return
        edges = {e for f in faces for e in f.edges}
        verts = {v for f in faces for v in f.verts}
        bmesh.ops.bisect_plane(bm, geom=list(faces) + list(edges) + list(verts), plane_co=origin, plane_no=normal, dist=0.0005)

    for _, parts, ref, t in LIMB_CUTS:
        for side in ("Left", "Right"):
            bone = bones[side + ref]
            axis = (bone.tail_local - bone.head_local)
            origin = bone.head_local + axis * t
            faces = [f for f in bm.faces if (b := dominant_bone(f, deform, groups)) and split_bone(b) in {(side, p) for p in parts}]
            bisect(faces, origin, axis.normalized())
    torso = {"Hips", "Spine", "Spine1", "Spine2", "UpLeg"}
    bisect([f for f in bm.faces if (b := dominant_bone(f, deform, groups)) and split_bone(b)[1] in torso], *planes["hem"])
    for name in ("collar", "collarband"):
        bisect([f for f in bm.faces if (b := dominant_bone(f, deform, groups)) and split_bone(b)[1] in {"Neck", "Spine2", "Shoulder", "Head"}], *planes[name])
    bisect([f for f in bm.faces if (b := dominant_bone(f, deform, groups)) and split_bone(b)[1] in {"Leg", "Foot", "ToeBase"}], *planes["shoe"])
    bm.to_mesh(body.data)
    bm.free()


def classify_faces(body, rig):
    """Asigna cada cara a una pieza del kit (o a la piel) según su hueso dominante y los planos de corte."""
    bones = bone_names(rig)
    groups = {group.index: group.name.split(":")[-1] for group in body.vertex_groups if group.name.startswith("mixamorig")}
    scalp = body.vertex_groups["scalp"].index if "scalp" in body.vertex_groups else -1
    planes = kit_planes(rig)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    deform = bm.verts.layers.deform.active
    regions, trims = [], []
    for face in bm.faces:
        center = face.calc_center_median()
        bone = dominant_bone(face, deform, groups)
        side, part = split_bone(bone) if bone else ("", "")
        t = lambda name: along(bones[side + name], center)
        region, trim = "skin", False
        if part in ("Spine", "Spine1", "Spine2", "Hips", "Neck", "Shoulder", "Head"):
            if part == "Head":
                on_scalp = sum(v[deform].get(scalp, 0.0) for v in face.verts) > 0.5 * len(face.verts)
                region = "hair" if on_scalp else "skin"
            elif above(planes["collar"], center):
                region = "skin"
            elif above(planes["hem"], center):
                region, trim = "jersey", above(planes["collarband"], center)
            else:
                region = "bib"
        elif part == "Arm":
            region, trim = ("jersey", t("Arm") > 0.36) if t("Arm") < 0.47 else ("skin", False)
        elif part == "ForeArm":
            region = "glove" if t("ForeArm") > 0.93 else "skin"
        elif part == "Hand" or (part.startswith("Hand") and part[-1] == "1") or part == "HandThumb2":
            region = "glove"
        elif part == "UpLeg":
            if t("UpLeg") >= 0.74:
                region = "skin"
            elif above(planes["hem"], center):
                region = "jersey"
            else:
                region, trim = "bib", t("UpLeg") > 0.68
        elif part == "Leg":
            region = "skin" if t("Leg") < 0.8 else ("sock" if above(planes["shoe"], center) else "shoe")
        elif part in ("Foot", "ToeBase"):
            region = "sock" if above(planes["shoe"], center) else "shoe"
        regions.append(region)
        trims.append(trim)
    bm.free()
    return regions, trims


def extract_piece(body, faces, name, offset, normals):
    """Copia las caras indicadas del cuerpo en un objeto nuevo, separado `offset` metros de la piel."""
    piece = body.copy()
    piece.data = body.data.copy()
    piece.name = piece.data.name = name
    bpy.context.collection.objects.link(piece)
    bm = bmesh.new()
    bm.from_mesh(piece.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in faces], context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    index_layer = bm.verts.layers.int.get("orig_index")
    for vertex in bm.verts:
        vertex.co += normals[vertex[index_layer]] * offset
    bm.to_mesh(piece.data)
    bm.free()
    piece.data.materials.clear()
    return piece


def add_hem(piece, thickness):
    """Dobladillo: solo el borde, hacia la piel, para que la prenda no parezca una lámina."""
    modifier = piece.modifiers.new("Hem", "SOLIDIFY")
    modifier.thickness = thickness
    modifier.offset = -1.0
    modifier.use_rim = True
    modifier.use_rim_only = True
    modifier.use_even_offset = True


def assign_by(piece, materials, pick):
    """Asigna materiales a las caras de la pieza: pick(cara, bmesh) devuelve el índice del material."""
    for material in materials:
        piece.data.materials.append(material)
    bm = bmesh.new()
    bm.from_mesh(piece.data)
    for face in bm.faces:
        face.material_index = pick(face)
    bm.to_mesh(piece.data)
    bm.free()


def smooth_piece(piece, iterations, factor=0.5):
    bm = bmesh.new()
    bm.from_mesh(piece.data)
    inner = [v for v in bm.verts if not v.is_boundary]
    for _ in range(iterations):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=factor, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(piece.data)
    bm.free()


def apply_modifier(obj, kind, **settings):
    modifier = obj.modifiers.new(kind.title(), kind)
    for key, value in settings.items():
        setattr(modifier, key, value)
    with bpy.context.temp_override(object=obj, active_object=obj):
        bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def shape_shoe(piece, body, target_tris=1600):
    """Zapatilla de carretera: envolvente lisa de cada pie (sin dedos), suela plana y pesos copiados del pie."""
    armature = next(m for m in piece.modifiers if m.type == "ARMATURE")
    rig = armature.object
    piece.modifiers.remove(armature)
    points = [v.co.copy() for v in piece.data.vertices]
    bm = bmesh.new()
    for side in (-1, 1):
        verts = [bm.verts.new(p) for p in points if p.x * side > 0]
        hull = bmesh.ops.convex_hull(bm, input=verts)
        leftovers = {g for g in hull["geom_interior"] + hull["geom_unused"] if isinstance(g, bmesh.types.BMVert)}
        bmesh.ops.delete(bm, geom=list(leftovers), context="VERTS")
    bm.to_mesh(piece.data)
    bm.free()
    piece.data.materials.clear()
    # Remallado para redondear las aristas del casco convexo y repartir bien los polígonos.
    apply_modifier(piece, "REMESH", mode="VOXEL", voxel_size=0.005)
    smooth_piece(piece, 6, 0.5)
    bm = bmesh.new()
    bm.from_mesh(piece.data)
    bm.normal_update()
    lowest = min(v.co.z for v in bm.verts)
    for vertex in bm.verts:
        vertex.co += vertex.normal * 0.002
        if vertex.co.z < lowest + 0.01:
            vertex.co.z = lowest - 0.003
    bm.to_mesh(piece.data)
    bm.free()
    apply_modifier(piece, "DECIMATE", ratio=min(1.0, target_tris / max(len(piece.data.polygons) * 2, 1)))
    # El remallado pierde los pesos: se copian del pie (sigue intacto en el cuerpo).
    apply_modifier(piece, "DATA_TRANSFER", object=body, use_vert_data=True, data_types_verts={"VGROUP_WEIGHTS"},
                   vert_mapping="POLYINTERP_NEAREST")
    piece.modifiers.new("Armature", "ARMATURE").object = rig


# Banda diagonal del maillot: altura del centro sobre la cadera, pendiente (m de altura por m lateral) y semiancho.
SASH = {"center": 0.25, "slope": 0.85, "half_width": 0.04}


def cut_sash(jersey, bones):
    """Corta el tronco del maillot por los dos bordes de la banda (bordes rectos) y devuelve el selector de sus caras."""
    hips = bones["Hips"].head_local
    shoulder_x = abs(bones["LeftArm"].head_local.x) - 0.015
    origin = Vector((0, 0, hips.z + SASH["center"]))
    normal = Vector((-SASH["slope"], 0, 1)).normalized()
    offset = SASH["half_width"] * normal.z  # semiancho medido en vertical
    torso = lambda point: abs(point.x) < shoulder_x
    bm = bmesh.new()
    bm.from_mesh(jersey.data)
    for sign in (-1, 1):
        faces = [f for f in bm.faces if torso(f.calc_center_median())]
        geom = faces + list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=origin + normal * offset * sign, plane_no=normal, dist=0.0002)
        # Corte vertical donde termina la banda, en el arranque de la manga (si no, acaba en escalera).
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector((sign * shoulder_x, 0, 0)), plane_no=Vector((1, 0, 0)), dist=0.0002)
    bm.to_mesh(jersey.data)
    bm.free()
    return lambda face: (torso(face.calc_center_median()) and abs((face.calc_center_median() - origin).dot(normal)) < offset)


def build_kit(body, rig):
    materials = {name: make_material(name) for name in COLORS}
    cut_body(body, rig)
    regions, trims = classify_faces(body, rig)

    # Índice original de cada vértice, normales de la piel (para separar las prendas) y caras de ribete.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    layer = bm.verts.layers.int.new("orig_index")
    for vertex in bm.verts:
        vertex[layer] = vertex.index
    trim_layer = bm.faces.layers.int.new("trim")
    for face in bm.faces:
        face[trim_layer] = int(trims[face.index])
    bm.to_mesh(body.data)
    bm.free()
    normals = [v.normal.copy() for v in body.data.vertices]

    pieces = {}
    for region in ("jersey", "bib", "sock", "glove", "shoe", "hair"):
        faces = {i for i, r in enumerate(regions) if r == region}
        pieces[region] = extract_piece(body, faces, region, OFFSETS[region], normals)

    def by_trim(piece):
        layer = piece.data.attributes["trim"].data
        return lambda face: layer[face.index].value

    # Maillot: tono secundario en el cuello, los puños y una banda diagonal (de hombro a cadera, por delante y por detrás).
    jersey = pieces["jersey"]
    jersey.name = jersey.data.name = "Jersey"
    sash = cut_sash(jersey, bone_names(rig))
    trim = by_trim(jersey)
    assign_by(jersey, [materials["TopMain"], materials["TopTrim"]], lambda f: 1 if trim(f) or sash(f) else 0)
    add_hem(jersey, 0.005)

    # Culotte con banda elástica en la pernera.
    bib = pieces["bib"]
    bib.name = bib.data.name = "BibShorts"
    assign_by(bib, [materials["Bib"], materials["BibBand"]], by_trim(bib))
    add_hem(bib, 0.004)

    socks = pieces["sock"]
    socks.name = socks.data.name = "Socks"
    assign_by(socks, [materials["Sock"]], lambda f: 0)
    add_hem(socks, 0.002)

    gloves = pieces["glove"]
    gloves.name = gloves.data.name = "Gloves"
    assign_by(gloves, [materials["Glove"]], lambda f: 0)
    add_hem(gloves, 0.003)

    shoes = pieces["shoe"]
    shoes.name = shoes.data.name = "Shoes"
    shape_shoe(shoes, body)
    sole_z = min(v.co.z for v in shoes.data.vertices) + 0.014
    assign_by(shoes, [materials["Shoe"], materials["ShoeSole"]], lambda f: 1 if f.calc_center_median().z < sole_z else 0)

    hair = pieces["hair"]
    hair.name = hair.data.name = "Buzz"
    assign_by(hair, [materials["Buzz"]], lambda f: 0)

    # Piel: solo lo que se ve (cabeza, brazos, rodillas y espinillas, dedos).
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.faces.ensure_lookup_table()
    covered = [f for f in bm.faces if regions[f.index] not in ("skin", "hair")]
    bmesh.ops.delete(bm, geom=covered, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(body.data)
    bm.free()
    body.data.materials.clear()
    body.data.materials.append(materials["Skin"])
    return materials


def add_eyes(rig, centers, material):
    eyes = []
    for center, radius in centers:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=radius * 0.95, location=center)
        eye = bpy.context.active_object
        eye.data.materials.append(material)
        group = eye.vertex_groups.new(name="mixamorig:Head")
        group.add(list(range(len(eye.data.vertices))), 1.0, "REPLACE")
        eye.parent = rig
        eye.modifiers.new("Armature", "ARMATURE").object = rig
        eyes.append(eye)
    bpy.ops.object.select_all(action="DESELECT")
    for eye in eyes:
        eye.select_set(True)
    bpy.context.view_layer.objects.active = eyes[0]
    bpy.ops.object.join()
    eyes[0].name = eyes[0].data.name = "Eyes"
    # Con la posición en el objeto, el exportador no las trata como malla con esqueleto y se quedan flotando.
    eyes[0].parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    eyes[0].parent = rig
    bpy.ops.object.shade_smooth()
    return eyes[0]


def export(rig, path):
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for child in rig.children:
        child.select_set(True)
        if child.type == "MESH":
            for name in ("orig_index", "trim"):
                if name in child.data.attributes:
                    child.data.attributes.remove(child.data.attributes[name])
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True,
        export_skins=True, export_animations=False, export_morph=False, export_yup=True,
        export_extras=False, export_cameras=False, export_lights=False,
    )


# Parte del peso de los muslos que conserva el maillot: con todo se estira al pedalear, sin nada hace vuelo sobre el culotte.
JERSEY_THIGH_WEIGHT = 0.5


def torso_only(piece):
    """El maillot sigue sobre todo al tronco, para que el bajo no se estire con cada pedalada."""
    groups = {g.index: g.name for g in piece.vertex_groups}
    hips = piece.vertex_groups["mixamorig:Hips"]
    for vertex in piece.data.vertices:
        moved = 0.0
        for element in vertex.groups:
            if groups[element.group].endswith("UpLeg"):
                moved += element.weight * (1 - JERSEY_THIGH_WEIGHT)
                element.weight *= JERSEY_THIGH_WEIGHT
        if moved:
            hips.add([vertex.index], moved, "ADD")


def add_head_top(rig):
    """Hueso HeadTop_End (estándar de Mixamo): la app mide con él la cabeza para colocar casco y gafas."""
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    head = rig.data.edit_bones["mixamorig:Head"]
    top = rig.data.edit_bones.new("mixamorig:HeadTop_End")
    top.head = head.tail
    top.tail = head.tail + (head.tail - head.head) * 0.3
    top.parent = head
    top.use_deform = False
    bpy.ops.object.mode_set(mode="OBJECT")


# Flexión de los dedos en reposo (rad por falange): mano en posición de agarre sobre las manetas.
GRIP_CURL = {"1": 0.8, "2": 1.0, "3": 0.6}
THUMB_CURL = {"1": 0.15, "2": 0.35, "3": 0.35}


def apply_grip_rest_pose(rig, axis):
    """Dobla los dedos y fija esa postura como reposo (malla incluida), así la app no tiene que animarlos."""
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    for bone in rig.pose.bones:
        name = bone.name.split(":")[-1]
        if "Hand" not in name or name.endswith("Hand"):
            continue
        curl = THUMB_CURL if "Thumb" in name else GRIP_CURL
        angle = curl.get(name[-1], 0.0)
        bone.rotation_mode = "XYZ"
        setattr_axis = {"X": 0, "Y": 1, "Z": 2}[axis[-1]]
        rotation = [0.0, 0.0, 0.0]
        rotation[setattr_axis] = angle * (-1 if axis.startswith("-") else 1)
        bone.rotation_euler = rotation
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj in rig.children:
        if obj.type != "MESH":
            continue
        modifier = next(m for m in obj.modifiers if m.type == "ARMATURE")
        with bpy.context.temp_override(object=obj, active_object=obj):
            bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        new = obj.modifiers.new("Armature", "ARMATURE")
        new.object = rig
        with bpy.context.temp_override(object=obj, active_object=obj):
            bpy.ops.object.modifier_move_to_index(modifier=new.name, index=0)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")


# Casco de carretera: margen sobre la cabeza (escala por eje: lateral, delante-detrás, vertical), grosor y respiraderos.
HELMET_SCALE = (1.17, 1.13, 1.07)
HELMET_THICKNESS = 0.017
# Respiraderos: bandas longitudinales (|x| desde el centro, en m) que atraviesan la carcasa.
HELMET_VENTS = ((0.011, 0.024), (0.036, 0.05), (0.06, 0.07))


def head_points(body):
    head = body.vertex_groups["mixamorig:Head"].index
    return [v.co.copy() for v in body.data.vertices if any(g.group == head and g.weight > 0.6 for g in v.groups)]


def bind_to_head(obj, rig):
    group = obj.vertex_groups.new(name="mixamorig:Head")
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    obj.parent = rig
    obj.modifiers.new("Armature", "ARMATURE").object = rig


def build_helmet(body, rig, eye_centers, materials):
    """Casco aero: envolvente de la cabeza agrandada, cortada por el borde (más bajo detrás) y con respiraderos reales."""
    points = head_points(body)
    eye_z = sum(c.z for c, _ in eye_centers) / 2
    eye_y = sum(c.y for c, _ in eye_centers) / 2
    edge = (Vector((0, eye_y, eye_z + 0.03)), Vector((0, 0.45, 1)).normalized())  # +Y = nuca
    above = [p for p in points if (p - edge[0]).dot(edge[1]) > -0.03]
    center = sum(above, Vector()) / len(above)
    bm = bmesh.new()
    verts = [bm.verts.new(center + Vector((d.x * HELMET_SCALE[0], d.y * HELMET_SCALE[1], d.z * HELMET_SCALE[2])))
             for d in (p - center for p in above)]
    hull = bmesh.ops.convex_hull(bm, input=verts)
    bmesh.ops.delete(bm, geom=list({g for g in hull["geom_interior"] + hull["geom_unused"] if isinstance(g, bmesh.types.BMVert)}), context="VERTS")
    # Cola aerodinámica: la parte de atrás se alarga y baja un poco.
    for vertex in bm.verts:
        back = vertex.co.y - center.y
        if back > 0:
            vertex.co.y += back * 0.25
            vertex.co.z -= back * 0.12
        vertex.co.z += 0.002
    mesh = bpy.data.meshes.new("Helmet")
    bm.to_mesh(mesh)
    bm.free()
    helmet = bpy.data.objects.new("Helmet", mesh)
    bpy.context.collection.objects.link(helmet)
    apply_modifier(helmet, "REMESH", mode="VOXEL", voxel_size=0.005)
    smooth_piece(helmet, 6, 0.5)
    bm = bmesh.new()
    bm.from_mesh(helmet.data)
    origin, normal = edge
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=origin + Vector((0, 0, 0.004)),
                           plane_no=normal, clear_inner=True)
    # Respiraderos: se cortan con planos (bordes rectos) y se quitan las caras de las bandas en la parte alta.
    top = max(v.co.z for v in bm.verts)
    vent_low = top - 0.07
    front_stop = eye_y + 0.04
    cuts = [(Vector((center.x + s * x, 0, 0)), Vector((1, 0, 0))) for lo, hi in HELMET_VENTS for x in (lo, hi) for s in (-1, 1)]
    cuts += [(Vector((0, 0, vent_low)), Vector((0, 0, 1))), (Vector((0, front_stop, 0)), Vector((0, 1, 0)))]
    for co, no in cuts:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no, dist=0.0002)
    vents = []
    for face in bm.faces:
        c = face.calc_center_median()
        if c.z < vent_low or c.y < front_stop or (c - origin).dot(normal) < 0.03:
            continue
        if any(lo < abs(c.x - center.x) < hi for lo, hi in HELMET_VENTS):
            vents.append(face)
    bmesh.ops.delete(bm, geom=vents, context="FACES")
    bm.to_mesh(helmet.data)
    bm.free()
    apply_modifier(helmet, "DECIMATE", ratio=min(1.0, 2400 / max(len(helmet.data.polygons) * 2, 1)))
    helmet.data.materials.append(materials["HelmetShell"])
    helmet.data.materials.append(materials["HelmetDark"])
    # Carcasa con grosor: el interior y las paredes de los respiraderos van en oscuro.
    apply_modifier(helmet, "SOLIDIFY", thickness=HELMET_THICKNESS, offset=-1.0, use_even_offset=True,
                   material_offset=1, material_offset_rim=1)
    for polygon in helmet.data.polygons:
        polygon.use_smooth = True
    bind_to_head(helmet, rig)

    # Gafas envolventes: lente curva delante de los ojos, montura superior y patillas hasta las orejas.
    # Anchura de la cara a la altura de los ojos, solo por delante de las orejas.
    width = max(abs(p.x - center.x) for p in points if abs(p.z - eye_z) < 0.02 and p.y < eye_y + 0.02) + 0.01
    # Profundidad: por delante de cejas y pómulos (no de los ojos, que están hundidos); el puente pasa sobre la nariz.
    face_front = min(p.y for p in points if 0.015 < abs(p.x - center.x) < 0.045 and abs(p.z - eye_z) < 0.025)
    depth = center.y - face_front + 0.012
    b = bmesh.new()
    rows = []
    for h in (-0.019, 0.0, 0.016):
        row = []
        for i in range(17):
            a = math.radians(-72 + 144 * i / 16)
            bulge = 1.0 - 0.06 * (h / 0.019) ** 2
            row.append(b.verts.new(Vector((center.x + width * math.sin(a) * bulge, center.y - depth * math.cos(a) * bulge, eye_z + h - 0.004))))
        rows.append(row)
    for r0, r1 in zip(rows, rows[1:]):
        for i in range(16):
            b.faces.new((r0[i], r0[i + 1], r1[i + 1], r1[i]))
    lens_mesh = bpy.data.meshes.new("Glasses")
    b.to_mesh(lens_mesh)
    b.free()
    glasses = bpy.data.objects.new("Glasses", lens_mesh)
    bpy.context.collection.objects.link(glasses)
    glasses.data.materials.append(materials["Lens"])
    glasses.data.materials.append(materials["GlassesFrame"])
    apply_modifier(glasses, "SOLIDIFY", thickness=0.003, offset=0.0, material_offset_rim=1)
    for polygon in glasses.data.polygons:
        polygon.use_smooth = True
    bind_to_head(glasses, rig)

    # Patillas y correas del casco (tubos finos).
    parts = []
    ear_y = center.y + 0.005
    for side in (-1, 1):
        # La patilla sale del extremo de la lente y va por encima de la oreja.
        a = math.radians(72)
        lens_end = Vector((center.x + side * width * math.sin(a) * 0.98, center.y - depth * math.cos(a), eye_z + 0.008))
        ear = max((p for p in points if p.x * side > center.x * side + width * 0.8), key=lambda p: p.z, default=lens_end)
        parts.append(([lens_end, Vector((lens_end.x + side * 0.004, ear_y - 0.01, eye_z + 0.006)),
                       Vector((ear.x + side * 0.004, ear_y + 0.03, eye_z - 0.012))], 0.002, "GlassesFrame"))
        junction = Vector((center.x + side * (width - 0.012), ear_y - 0.002, eye_z - 0.065))
        rim_z = lambda y: origin.z - normal.y / normal.z * (y - origin.y) + 0.002
        parts.append(([Vector((center.x + side * (width + 0.006), ear_y - 0.03, rim_z(ear_y - 0.03))), junction], 0.0025, "Strap"))
        parts.append(([Vector((center.x + side * (width + 0.002), ear_y + 0.035, rim_z(ear_y + 0.035))), junction], 0.0025, "Strap"))
        parts.append(([junction, Vector((center.x + side * 0.03, eye_y + 0.035, eye_z - 0.12)), Vector((center.x, eye_y + 0.045, eye_z - 0.128))], 0.0025, "Strap"))
    for index, (path, radius, material) in enumerate(parts):
        curve = bpy.data.curves.new(f"Gear{index}", "CURVE")
        curve.dimensions = "3D"
        curve.bevel_depth = radius
        curve.bevel_resolution = 1
        spline = curve.splines.new("POLY")
        spline.points.add(len(path) - 1)
        for point, co in zip(spline.points, path):
            point.co = (*co, 1.0)
        obj = bpy.data.objects.new(f"Gear{index}", curve)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(materials[material])
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        obj.select_set(False)
        bind_to_head(obj, rig)
    gear = [o for o in bpy.data.objects if o.name.startswith("Gear")]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in gear:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = gear[0]
    bpy.ops.object.join()
    gear[0].name = gear[0].data.name = "HelmetStraps"


def main():
    clean_scene()
    body, rig, eye_centers = create_body()
    materials = build_kit(body, rig)
    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and obj.parent == rig:
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.shade_smooth()
            obj.select_set(False)
    add_eyes(rig, eye_centers, materials["Eye"])
    torso_only(bpy.data.objects["Jersey"])
    apply_grip_rest_pose(rig, GRIP_AXIS)
    add_head_top(rig)
    build_helmet(bpy.data.objects["Body"], rig, eye_centers, materials)
    # Toda malla del ciclista debe ir con esqueleto: sin modificador Armature se exporta suelta y no sigue a la cabeza.
    for obj in rig.children:
        if obj.type == "MESH" and not any(m.type == "ARMATURE" for m in obj.modifiers):
            obj.modifiers.new("Armature", "ARMATURE").object = rig
    total = 0
    for obj in rig.children:
        if obj.type == "MESH":
            tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
            total += tris
            print(f"PIECE {obj.name}: {len(obj.data.vertices)} verts, ~{tris} tris")
    print(f"TOTAL ~{total} tris (sin dobladillos)")
    if BLEND_OUT:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT, compress=True)
    if GLB_OUT:
        export(rig, GLB_OUT)


main()
