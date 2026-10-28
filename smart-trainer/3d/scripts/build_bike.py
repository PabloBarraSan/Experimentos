"""
Genera la bici de carretera de la app desde cero (todo geometría propia, sin assets de terceros).

Uso (Blender 4.5):
    blender -b --python smart-trainer/3d/scripts/build_bike.py -- <salida.blend> <salida.glb>

Las medidas salen de BIKE en src/expedition/Cyclist.js (si cambian allí, hay que cambiarlas aquí): el ciclista apoya
manos, sillín y pedales en los mismos puntos que la bici procedural.

Contrato con src/expedition/BikeModel.js:
- Nodos "BikeFrame" (origen de la bici), "WheelFront" y "WheelRear" (origen en el buje, giran sobre X),
  "Crankset" (origen en el pedalier, biela izquierda hacia delante con ángulo 0) y "Pedal" (centrado en su eje).
- Los materiales se llaman como los huecos de material de la app (paint, accent, rubber, tape, tire, rim, metal,
  bottle): la app los sustituye por los suyos, así que aquí solo sirven para previsualizar.
"""

import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
BLEND_OUT = argv[0] if len(argv) > 0 else None
GLB_OUT = argv[1] if len(argv) > 1 else None


def T(x, y, z):
    """Punto de la app (x lateral, y arriba, z adelante) en coordenadas de Blender (z arriba, -y adelante)."""
    return Vector((x, -z, y))


# Geometría de la bici (copia de BIKE y del manillar de Cyclist.js).
BB = T(0, 0.27, 0)
REAR_HUB = T(0, 0.335, -0.41)
FRONT_HUB = T(0, 0.335, 0.6)
SEAT_CLUSTER = T(0, 0.88, -0.17)
# Unión del tubo horizontal más baja que en la bici procedural (geometría compacta, tubo horizontal inclinado):
# el sillín no se mueve, solo asoma más tija.
TOP_TUBE_JOIN = BB.lerp(SEAT_CLUSTER, 0.88)
HEAD_TOP = T(0, 0.93, 0.4)
HEAD_BOTTOM = T(0, 0.75, 0.435)
WHEEL_RADIUS = 0.335
CRANK_LENGTH = 0.172
PEDAL_X = 0.1
BAR_CURVE_POINTS = [
    (0.2, 0.97, 0.5), (0.203, 0.972, 0.55), (0.207, 0.969, 0.6), (0.21, 0.952, 0.642), (0.21, 0.918, 0.668),
    (0.21, 0.878, 0.668), (0.208, 0.846, 0.645), (0.205, 0.828, 0.605), (0.203, 0.826, 0.565),
]
HOOD_CENTER = (0.207, 0.978, 0.62)

COLORS = {
    "paint": (0.05, 0.2, 0.75), "accent": (0.18, 0.75, 0.55), "rubber": (0.02, 0.022, 0.025),
    "tape": (0.03, 0.033, 0.036), "tire": (0.015, 0.015, 0.017), "rim": (0.03, 0.035, 0.04),
    "metal": (0.55, 0.58, 0.6), "bottle": (0.9, 0.88, 0.82),
}

# Tramo del tubo diagonal (0 = pedalier, 1 = dirección) pintado con el color de acento.
STRIPE = (0.3, 0.68)

X = Vector((1, 0, 0))
Z = Vector((0, 0, 1))


# ---------------------------------------------------------------- utilidades de malla

class Builder:
    """Acumula geometría en un bmesh, con un índice de material por cara."""

    def __init__(self, slots):
        self.bm = bmesh.new()
        self.slots = list(slots)

    def slot(self, name):
        return self.slots.index(name)

    def ring(self, center, axis, hint, half_a, half_b, segments):
        """Anillo elíptico perpendicular a `axis`; `half_a` va en la dirección de `hint`."""
        axis = axis.normalized()
        a = (hint - axis * hint.dot(axis))
        if a.length < 1e-6:
            a = axis.orthogonal()
        a.normalize()
        b = axis.cross(a)
        return [self.bm.verts.new(center + a * (half_a * math.cos(t)) + b * (half_b * math.sin(t)))
                for t in (2 * math.pi * i / segments for i in range(segments))]

    def bridge(self, ring_a, ring_b, slot):
        count = len(ring_a)
        for i in range(count):
            face = self.bm.faces.new((ring_a[i], ring_a[(i + 1) % count], ring_b[(i + 1) % count], ring_b[i]))
            face.material_index = self.slot(slot)

    def cap(self, ring, slot, flip=False):
        face = self.bm.faces.new(list(reversed(ring)) if flip else ring)
        face.material_index = self.slot(slot)

    def sweep(self, points, sizes, slot, hint=X, segments=16, caps=True):
        """Tubo elíptico a lo largo de una polilínea; sizes[i] = (semieje en `hint`, semieje perpendicular)."""
        rings = []
        for i, point in enumerate(points):
            ahead = points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]
            rings.append(self.ring(point, ahead, hint, sizes[i][0], sizes[i][1], segments))
        for ring_a, ring_b in zip(rings, rings[1:]):
            self.bridge(ring_a, ring_b, slot)
        if caps:
            self.cap(rings[0], slot, flip=True)
            self.cap(rings[-1], slot)

    def tube(self, start, end, start_size, end_size, slot, hint=X, segments=16, steps=4):
        points = [start.lerp(end, i / steps) for i in range(steps + 1)]
        sizes = [tuple(s0 + (s1 - s0) * i / steps for s0, s1 in zip(start_size, end_size)) for i in range(steps + 1)]
        self.sweep(points, sizes, slot, hint, segments)

    def lathe(self, profile, slot, segments=64, center=Vector(), axis=X):
        """Superficie de revolución alrededor de `axis`; profile = [(radio, desplazamiento axial)] cerrado."""
        axis = axis.normalized()
        base_a = axis.orthogonal().normalized()
        base_b = axis.cross(base_a)
        rings = []
        for i in range(segments):
            angle = 2 * math.pi * i / segments
            radial = base_a * math.cos(angle) + base_b * math.sin(angle)
            rings.append([self.bm.verts.new(center + radial * r + axis * d) for r, d in profile])
        for i in range(segments):
            ring_a, ring_b = rings[i], rings[(i + 1) % segments]
            for j in range(len(profile) - 1):
                face = self.bm.faces.new((ring_a[j], ring_a[j + 1], ring_b[j + 1], ring_b[j]))
                face.material_index = self.slot(slot)

    def box(self, center, size, slot, rotation=None):
        matrix = Matrix.Translation(center) @ (rotation.to_4x4() if rotation else Matrix()) @ Matrix.Diagonal((*size, 1))
        result = bmesh.ops.create_cube(self.bm, size=1.0, matrix=matrix)
        for face in {f for v in result["verts"] for f in v.link_faces}:
            face.material_index = self.slot(slot)

    def ellipsoid(self, center, radii, slot, rotation=None, segments=16, rings=10):
        matrix = Matrix.Translation(center) @ (rotation.to_4x4() if rotation else Matrix()) @ Matrix.Diagonal((*radii, 1))
        result = bmesh.ops.create_uvsphere(self.bm, u_segments=segments, v_segments=rings, radius=1.0, matrix=matrix)
        for face in {f for v in result["verts"] for f in v.link_faces}:
            face.material_index = self.slot(slot)

    def to_object(self, name, materials, location=Vector()):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        for slot in self.slots:
            mesh.materials.append(materials[slot])
        obj.location = location
        return obj


def apply_modifier(obj, kind, **settings):
    modifier = obj.modifiers.new(kind.title(), kind)
    for key, value in settings.items():
        setattr(modifier, key, value)
    with bpy.context.temp_override(object=obj, active_object=obj):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def smooth(obj, iterations, factor=0.5):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for _ in range(iterations):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=factor, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(obj.data)
    bm.free()


def shade_smooth(obj, angle=None):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if angle is not None:
        obj.data.set_sharp_from_angle(angle=angle)


def offset_along(start, end, t):
    return start.lerp(end, t)


# ---------------------------------------------------------------- cuadro

def build_frame(materials):
    """Cuadro aero de carbono: tubos elípticos unidos por remallado (uniones suaves, como un cuadro moldeado)."""
    b = Builder(["paint"])
    head_axis = (HEAD_TOP - HEAD_BOTTOM).normalized()
    # Dirección y medidas en el plano de la bici: "hint" lateral (X) para el ancho, el otro semieje es el perfil.
    b.tube(HEAD_BOTTOM - head_axis * 0.015, HEAD_TOP + head_axis * 0.02, (0.02, 0.042), (0.019, 0.036), "paint", segments=24)
    top_end = HEAD_TOP - head_axis * 0.025
    b.tube(TOP_TUBE_JOIN, top_end, (0.016, 0.026), (0.018, 0.03), "paint", segments=20)
    down_end = HEAD_BOTTOM + head_axis * 0.03
    b.tube(BB, down_end, (0.025, 0.036), (0.022, 0.046), "paint", segments=24, steps=6)
    b.tube(BB, TOP_TUBE_JOIN + (SEAT_CLUSTER - BB).normalized() * 0.025, (0.018, 0.036), (0.016, 0.03), "paint", segments=20, steps=6)
    # Caja del pedalier.
    b.tube(BB - X * 0.043, BB + X * 0.043, (0.025, 0.025), (0.025, 0.025), "paint", hint=Z, segments=20, steps=1)
    rear = REAR_HUB
    stay_top = BB.lerp(SEAT_CLUSTER, 0.72)
    for side in (-1, 1):
        dropout = rear + X * side * 0.064
        # Vainas superiores bajas (dropped seatstays) y vainas inferiores.
        b.sweep([stay_top + X * side * 0.012, stay_top.lerp(dropout, 0.5) + X * side * 0.012 + Vector((0, 0, 0.01)), dropout + Vector((0, 0.004, 0.012))],
                [(0.008, 0.012), (0.007, 0.01), (0.006, 0.008)], "paint", segments=12)
        b.sweep([BB + X * side * 0.03 + Vector((0, 0.02, 0.0)), BB.lerp(dropout, 0.45) + X * side * 0.045, dropout + Vector((0, -0.006, -0.004))],
                [(0.011, 0.016), (0.009, 0.013), (0.007, 0.009)], "paint", segments=12)
        b.tube(dropout - X * side * 0.004, dropout + X * side * 0.006, (0.016, 0.016), (0.016, 0.016), "paint", hint=Z, segments=14, steps=1)
    # Horquilla: corona y botellas aerodinámicas hasta las punteras.
    crown = HEAD_BOTTOM - head_axis * 0.02
    b.tube(crown - X * 0.045, crown + X * 0.045, (0.02, 0.03), (0.02, 0.03), "paint", hint=Z, segments=16, steps=2)
    for side in (-1, 1):
        tip = FRONT_HUB + X * side * 0.052
        b.sweep([crown + X * side * 0.036, crown.lerp(tip, 0.5) + X * side * 0.012, tip + Vector((0, -0.004, 0.006))],
                [(0.011, 0.026), (0.009, 0.022), (0.007, 0.013)], "paint", segments=16)
        b.tube(tip - X * side * 0.004, tip + X * side * 0.006, (0.012, 0.012), (0.012, 0.012), "paint", hint=Z, segments=12, steps=1)
    frame = b.to_object("FrameShell", materials)
    apply_modifier(frame, "REMESH", mode="VOXEL", voxel_size=0.0025)
    smooth(frame, 4, 0.5)
    apply_modifier(frame, "DECIMATE", ratio=min(1.0, 9000 / max(len(frame.data.polygons) * 2, 1)))
    # Franja de color en el tubo diagonal, con bordes rectos: se corta la malla por los dos extremos.
    axis = down_end - BB
    near_down = lambda point: (point - BB.lerp(down_end, (point - BB).dot(axis) / axis.length_squared)).length < 0.06
    bm = bmesh.new()
    bm.from_mesh(frame.data)
    for t in STRIPE:
        faces = [f for f in bm.faces if near_down(f.calc_center_median())]
        geom = faces + list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=BB.lerp(down_end, t), plane_no=axis.normalized(), dist=0.0002)
    bm.to_mesh(frame.data)
    bm.free()
    frame.data.materials.append(materials["accent"])
    for polygon in frame.data.polygons:
        t = (polygon.center - BB).dot(axis) / axis.length_squared
        if STRIPE[0] < t < STRIPE[1] and near_down(polygon.center):
            polygon.material_index = 1
    shade_smooth(frame)
    return frame


def bar_curve(side, samples=40):
    points = [T(side * x, y, z) for x, y, z in BAR_CURVE_POINTS]
    result = []
    for i in range(samples + 1):
        t = i / samples * (len(points) - 1)
        k = min(int(t), len(points) - 2)
        u = t - k
        p0, p1, p2, p3 = points[max(k - 1, 0)], points[k], points[k + 1], points[min(k + 2, len(points) - 1)]
        result.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    return result


def build_parts(materials):
    """Cockpit integrado, sillín, tija, transmisión fija, frenos y bidón."""
    b = Builder(["rubber", "tape", "metal", "bottle", "paint"])
    head_axis = (HEAD_TOP - HEAD_BOTTOM).normalized()
    # Tapa de dirección y potencia integrada (de carbono, negra).
    cap = HEAD_TOP + head_axis * 0.02
    b.tube(cap - head_axis * 0.005, cap + head_axis * 0.012, (0.018, 0.02), (0.017, 0.019), "rubber", segments=18, steps=1)
    bar_center = T(0, 0.97, 0.5)
    b.sweep([cap + head_axis * 0.006, cap.lerp(bar_center, 0.5) + Vector((0, 0, 0.004)), bar_center],
            [(0.017, 0.016), (0.016, 0.014), (0.02, 0.012)], "rubber", segments=16)
    # Barra superior plana (perfil de ala) hasta el inicio de las curvas.
    b.tube(T(-0.2, 0.97, 0.5), T(0.2, 0.97, 0.5), (0.009, 0.019), (0.009, 0.019), "rubber", hint=Z, segments=16, steps=8)
    for side in (-1, 1):
        curve = bar_curve(side)
        b.sweep(curve, [(0.0125, 0.0125)] * len(curve), "tape", segments=12)
        # Maneta: cuerpo con cuerno delantero y palanca de freno.
        hx, hy, hz = HOOD_CENTER
        hood = T(side * hx, hy, hz)
        tilt = Matrix.Rotation(math.radians(-14), 3, "X")
        b.ellipsoid(hood, (0.022, 0.05, 0.026), "rubber", rotation=tilt)
        b.ellipsoid(T(side * hx, hy + 0.02, hz + 0.038), (0.014, 0.016, 0.016), "rubber")
        b.sweep([T(side * hx, hy - 0.012, hz + 0.05), T(side * hx, 0.93, 0.695), T(side * hx, 0.885, 0.7)],
                [(0.004, 0.009), (0.004, 0.008), (0.004, 0.007)], "rubber", segments=10)
    # Tija aero, abrazadera y sillín de nariz corta con raíles.
    saddle_clamp = T(0, 0.935, -0.198)
    b.tube(TOP_TUBE_JOIN, saddle_clamp, (0.014, 0.022), (0.013, 0.02), "rubber", segments=16)
    b.box(saddle_clamp + Vector((0, 0, 0.008)), (0.03, 0.04, 0.016), "metal")
    for side in (-1, 1):
        b.sweep([T(side * 0.03, 0.958, -0.29), T(side * 0.022, 0.945, -0.24), T(side * 0.022, 0.945, -0.15), T(side * 0.012, 0.955, -0.1)],
                [(0.0035, 0.0035)] * 4, "metal", segments=8)
    sections = [(-0.305, 0.058, 0.014, 0.962), (-0.29, 0.072, 0.018, 0.963), (-0.25, 0.071, 0.02, 0.963),
                (-0.205, 0.06, 0.019, 0.962), (-0.165, 0.037, 0.017, 0.959), (-0.125, 0.024, 0.015, 0.956),
                (-0.09, 0.02, 0.013, 0.953), (-0.065, 0.016, 0.009, 0.952)]
    b.sweep([T(0, y, z) for z, _, _, y in sections], [(w, h) for _, w, h, _ in sections], "rubber", segments=24)
    # Bidón y portabidón sobre el tubo diagonal.
    down_dir = (HEAD_BOTTOM - BB).normalized()
    up_back = down_dir.cross(X).normalized()
    if up_back.z < 0:
        up_back = -up_back
    length = (HEAD_BOTTOM - BB).length
    start = BB + down_dir * (length * 0.3) + up_back * 0.058
    end = BB + down_dir * (length * 0.62) + up_back * 0.058
    b.tube(start, end, (0.031, 0.031), (0.029, 0.029), "bottle", segments=20, steps=3)
    b.tube(end, end + down_dir * 0.028, (0.017, 0.017), (0.012, 0.012), "rubber", segments=14, steps=1)
    for side in (-1, 1):
        b.sweep([BB + down_dir * (length * 0.3) + up_back * 0.026 + X * side * 0.018, start + up_back * -0.004 + X * side * 0.03 + down_dir * 0.03,
                 end + up_back * -0.004 + X * side * 0.03 - down_dir * 0.03, BB + down_dir * (length * 0.62) + up_back * 0.026 + X * side * 0.018],
                [(0.003, 0.003)] * 4, "rubber", segments=8)
    # Transmisión fija: cadena, desviador delantero y cambio trasero (lado derecho, x > 0).
    chain_x = 0.045
    ring = 0.1035
    cog = 0.036
    pulley_low = REAR_HUB + Vector((chain_x, 0.012, -0.085))
    top_run = [BB + Vector((chain_x, 0, ring)), REAR_HUB + Vector((chain_x, 0, cog))]
    loop = [BB + Vector((chain_x, ring * math.sin(a), ring * math.cos(a))) for a in [math.radians(d) for d in range(0, 185, 15)]]
    chain = [top_run[1]] + [top_run[0]] + loop[1:] + [pulley_low, REAR_HUB + Vector((chain_x, 0.0, -0.05)), REAR_HUB + Vector((chain_x, -0.03, -0.02)), REAR_HUB + Vector((chain_x, -cog * 0.7, cog * 0.7)), top_run[1]]
    b.sweep(chain, [(0.0035, 0.0045)] * len(chain), "metal", hint=X, segments=8, caps=False)
    b.box(BB.lerp(SEAT_CLUSTER, 0.21) + Vector((0.03, 0.022, 0)), (0.018, 0.05, 0.03), "rubber",
          rotation=Matrix.Rotation(math.atan2((SEAT_CLUSTER - BB).y, (SEAT_CLUSTER - BB).z), 3, "X"))
    mech = REAR_HUB + Vector((0.068, 0.0, -0.04))
    b.ellipsoid(mech, (0.012, 0.03, 0.02), "rubber")
    for pulley in (REAR_HUB + Vector((chain_x + 0.004, 0.006, -0.055)), pulley_low + Vector((0.004, 0, 0))):
        b.tube(pulley - X * 0.004, pulley + X * 0.004, (0.012, 0.012), (0.012, 0.012), "metal", hint=Z, segments=14, steps=1)
    b.box(REAR_HUB + Vector((chain_x + 0.012, 0.004, -0.07)), (0.004, 0.02, 0.045), "rubber")
    # Pinzas de freno de disco (lado izquierdo).
    b.box(REAR_HUB + Vector((-0.062, 0.05, 0.035)), (0.018, 0.045, 0.025), "rubber")
    b.box(FRONT_HUB + Vector((-0.058, 0.035, 0.045)), (0.018, 0.04, 0.025), "rubber")
    parts = b.to_object("FrameParts", materials)
    shade_smooth(parts, math.radians(40))
    return parts


# ---------------------------------------------------------------- ruedas, bielas y pedales

def build_wheel(name, materials, location, rear):
    """Rueda de carbono de perfil alto: cubierta, llanta de 50 mm, radios planos, buje, disco y cassette."""
    b = Builder(["tire", "rim", "rubber", "metal"])
    tire_r = 0.0135
    b.lathe([(WHEEL_RADIUS - tire_r + tire_r * math.cos(a), tire_r * 0.95 * math.sin(a)) for a in
             [math.radians(d) for d in range(-90, 271, 30)]], "tire", segments=64)
    profile = [(0.3075, -0.0105), (0.298, -0.0135), (0.284, -0.0138), (0.27, -0.0118), (0.26, -0.007), (0.256, 0.0),
               (0.26, 0.007), (0.27, 0.0118), (0.284, 0.0138), (0.298, 0.0135), (0.3075, 0.0105), (0.3075, -0.0105)]
    b.lathe(profile, "rim", segments=64)
    # Buje con bridas y radios planos (24) cruzando de las bridas a la llanta.
    b.tube(-X * 0.05, X * 0.05, (0.016, 0.016), (0.016, 0.016), "metal", hint=Z, segments=16, steps=1)
    for flange in (-0.026, 0.026):
        b.tube(X * (flange - 0.002), X * (flange + 0.002), (0.028, 0.028), (0.028, 0.028), "metal", hint=Z, segments=20, steps=1)
    spokes = 24
    for i in range(spokes):
        rim_angle = 2 * math.pi * i / spokes
        hub_angle = rim_angle + (0.35 if i % 2 else -0.35)
        flange = 0.026 if i % 2 else -0.026
        hub_point = Vector((flange, 0.026 * math.cos(hub_angle), 0.026 * math.sin(hub_angle)))
        rim_point = Vector((0.0, 0.257 * math.cos(rim_angle), 0.257 * math.sin(rim_angle)))
        b.tube(hub_point, rim_point, (0.0007, 0.0021), (0.0007, 0.0021), "rubber", hint=X, segments=4, steps=1)
    # Disco de freno a la izquierda.
    b.lathe([(0.08, -0.0458), (0.08, -0.0442), (0.058, -0.0442), (0.058, -0.0458), (0.08, -0.0458)], "metal", segments=40)
    for i in range(6):
        angle = 2 * math.pi * i / 6
        b.tube(Vector((-0.045, 0.02 * math.cos(angle), 0.02 * math.sin(angle))),
               Vector((-0.045, 0.06 * math.cos(angle + 0.25), 0.06 * math.sin(angle + 0.25))),
               (0.001, 0.005), (0.001, 0.005), "metal", hint=X, segments=4, steps=1)
    if rear:
        for i in range(11):
            radius = 0.046 - i * 0.0022
            x = 0.024 + i * 0.0036
            b.lathe([(radius, x - 0.0009), (radius, x + 0.0009), (0.018, x + 0.0009), (0.018, x - 0.0009), (radius, x - 0.0009)],
                    "metal", segments=24)
    wheel = b.to_object(name, materials, location)
    shade_smooth(wheel, math.radians(35))
    return wheel


def build_crankset(materials):
    """Bielas aero, platos de 52/36 dientes con araña y eje; biela izquierda hacia delante (ángulo 0 de la app)."""
    b = Builder(["rubber", "metal"])
    b.tube(-X * 0.075, X * 0.075, (0.011, 0.011), (0.011, 0.011), "metal", hint=Z, segments=16, steps=1)
    forward = T(0, 0, 1)  # dirección "adelante" de la app en Blender
    up = Z
    for teeth, outer, inner, x in ((52, 0.1035, 0.09, 0.047), (36, 0.072, 0.061, 0.039)):
        b.lathe([(outer - 0.004, x - 0.002), (outer - 0.004, x + 0.002), (inner, x + 0.002), (inner, x - 0.002), (outer - 0.004, x - 0.002)],
                "metal", segments=teeth * 2)
        for i in range(teeth):
            angle = 2 * math.pi * i / teeth
            direction = Vector((0, math.cos(angle), math.sin(angle)))
            b.box(Vector((x, 0, 0)) + direction * (outer - 0.0035), (0.003, 0.0045, 0.004), "metal",
                  rotation=Matrix.Rotation(angle, 3, "X"))
    for i in range(4):
        angle = 2 * math.pi * i / 4 + math.pi / 4
        direction = Vector((0, math.cos(angle), math.sin(angle)))
        b.tube(Vector((0.05, 0, 0)) + direction * 0.012, Vector((0.05, 0, 0)) + direction * 0.092, (0.004, 0.011), (0.003, 0.007),
               "rubber", hint=X, segments=8, steps=2)
    for side in (-1, 1):
        # Izquierda (x < 0) hacia delante, derecha hacia atrás.
        direction = forward if side < 0 else -forward
        start = X * side * 0.072
        end = X * side * 0.082 + direction * CRANK_LENGTH
        b.sweep([start, start.lerp(end, 0.5) + X * side * 0.004, end], [(0.009, 0.019), (0.008, 0.015), (0.008, 0.012)],
                "rubber", hint=X, segments=14)
    crankset = b.to_object("Crankset", materials, BB)
    shade_smooth(crankset, math.radians(35))
    return crankset


def build_pedal(materials):
    """Pedal automático de carretera, simétrico (sirve para los dos lados); centrado en su eje."""
    b = Builder(["rubber", "metal"])
    b.tube(-X * 0.03, X * 0.03, (0.006, 0.006), (0.006, 0.006), "metal", hint=Z, segments=12, steps=1)
    b.ellipsoid(Vector((0, -0.006, -0.002)), (0.032, 0.05, 0.009), "rubber")
    b.box(Vector((0, -0.04, 0.002)), (0.05, 0.016, 0.012), "rubber")
    b.box(Vector((0, 0.03, -0.004)), (0.04, 0.012, 0.01), "metal")
    pedal = b.to_object("Pedal", materials, T(-PEDAL_X, BB.z, CRANK_LENGTH))
    shade_smooth(pedal, math.radians(40))
    return pedal


# ---------------------------------------------------------------- montaje y exportación

def clean_scene():
    for collection in (bpy.data.objects, bpy.data.meshes, bpy.data.materials):
        for item in list(collection):
            collection.remove(item)


def make_materials():
    materials = {}
    for name, color in COLORS.items():
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        bsdf = material.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.35 if name in ("paint", "metal") else 0.6
        material.diffuse_color = (*color, 1.0)
        materials[name] = material
    return materials


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.view_layer.objects.active
    result.name = result.data.name = name
    return result


def main():
    clean_scene()
    materials = make_materials()
    frame = join([build_frame(materials), build_parts(materials)], "BikeFrame")
    parts = [
        frame,
        build_wheel("WheelFront", materials, FRONT_HUB, rear=False),
        build_wheel("WheelRear", materials, REAR_HUB, rear=True),
        build_crankset(materials),
        build_pedal(materials),
    ]
    total = 0
    for obj in parts:
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        total += tris
        print(f"PART {obj.name}: ~{tris} tris")
    print(f"TOTAL ~{total} tris")
    if BLEND_OUT:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT, compress=True)
    if GLB_OUT:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in parts:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=GLB_OUT, export_format="GLB", use_selection=True, export_apply=True,
                                  export_animations=False, export_yup=True, export_extras=False)


main()
