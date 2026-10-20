"""Implementación de referencia, independiente de la aplicación, de los parámetros
espinopélvicos y de las reglas de puntuación que usa SpineCalc.

Se escribió a partir de las definiciones publicadas, sin reutilizar el código de la
aplicación (src/geometry.js, src/scoring.js), para la fase 1 de la validación:
verificar que la aplicación devuelve lo que dicen las fuentes.

Convenciones
------------
- Coordenadas en pixeles de la imagen, con el eje Y hacia ABAJO (como la app).
- La horizontal real es el eje X de la imagen o, si se da, la recta `ref_h`.
- La dirección anterior es la del platillo de S1, de su esquina posterior a la
  anterior, proyectada sobre la horizontal.
- Cada ángulo se descompone en su componente anterior (a) y su componente hacia
  arriba (u), con theta(v) = atan2(v·a, v·u): 0° vertical, positivo hacia delante.

Definiciones
------------
- SS: ángulo agudo entre el platillo de S1 y la horizontal.
- PT: ángulo entre la vertical por el eje bicoxofemoral y la recta al punto medio
  de S1; positivo si S1 queda detrás del eje (Legaye 1998). PT = -theta(S1 - H).
- PI: ángulo entre la perpendicular al platillo de S1 en su punto medio y la recta
  al eje bicoxofemoral (Legaye 1998).
- Lordosis L1-S1 y L4-S1: ángulo agudo entre los platillos superiores (Cobb).
- GT: ángulo entre la prolongación de la recta C7 -> S1 y la recta S1 -> eje
  bicoxofemoral, con vértice en el punto medio de S1 (Obeid 2016).
- Ángulo pélvico de una vértebra (Hills 2022): theta(centroide - H) - theta(S1 - H).
  El centroide de L1 es el punto medio de su platillo superior: es la definición
  operativa declarada de la app, y aquí se verifica la implementación, no la
  definición.
- Tilt vertebral (Hills 2022): theta(centroide - H).
- SVA: distancia horizontal de C7 a la esquina posterosuperior de S1, positiva si
  C7 queda anterior; en milímetros con la calibración.
- GAP (Yilgor 2017), SRS-Schwab (Schwab 2012) y Roussouly (Roussouly 2005,
  Laouissat 2018) con sus intervalos publicados. Las puntuaciones se aplican sobre
  los ángulos redondeados a un decimal, como los muestra la app.
"""
import math

import numpy as np

CLAVES = ["femL", "femR", "s1Post", "s1Ant", "l4Post", "l4Ant", "l1Post", "l1Ant", "c7", "t4", "t1", "c2"]


def _v(p):
    return np.array([float(p["x"]), float(p["y"])]) if isinstance(p, dict) else np.asarray(p, dtype=float)


def _base(puntos, ref_h=None):
    """Vectores unitarios anterior (a) y hacia arriba (u) sobre la horizontal real."""
    if ref_h is not None:
        h = _v(ref_h[1]) - _v(ref_h[0])
    else:
        h = np.array([1.0, 0.0])
    h = h / np.linalg.norm(h)
    sentido = np.sign(np.dot(_v(puntos["s1Ant"]) - _v(puntos["s1Post"]), h)) or 1.0
    a = h * sentido
    # "Arriba" es la perpendicular a la horizontal que apunta hacia y decreciente.
    u = np.array([h[1], -h[0]])
    if u[1] > 0:
        u = -u
    return a, u


def _theta(v, a, u):
    return math.degrees(math.atan2(float(np.dot(v, a)), float(np.dot(v, u))))


def _agudo(d1, d2):
    c = abs(float(np.dot(d1, d2))) / (np.linalg.norm(d1) * np.linalg.norm(d2))
    return math.degrees(math.acos(min(1.0, c)))


def parametros(puntos, mm_por_px=None, ref_h=None):
    """Devuelve los parámetros a partir de los puntos {clave: {x, y}}."""
    P = {k: _v(v) for k, v in puntos.items() if v is not None}
    a, u = _base(puntos, ref_h)
    H = (P["femL"] + P["femR"]) / 2
    s1 = (P["s1Post"] + P["s1Ant"]) / 2
    plat = P["s1Ant"] - P["s1Post"]
    horizontal = a  # misma recta, el sentido no importa para un ángulo agudo
    out = {}
    out["ss"] = _agudo(plat, horizontal)
    out["pt"] = -_theta(s1 - H, a, u)
    normal = np.array([-plat[1], plat[0]])
    out["pi"] = _agudo(normal, H - s1)
    out["l1s1"] = _agudo(P["l1Ant"] - P["l1Post"], plat)
    out["l4s1"] = _agudo(P["l4Ant"] - P["l4Post"], plat)
    d1, d2 = s1 - P["c7"], H - s1
    out["gt"] = math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(d1, d2)) / (np.linalg.norm(d1) * np.linalg.norm(d2))))))
    ts1 = _theta(s1 - H, a, u)
    centroides = {"l1": (P["l1Post"] + P["l1Ant"]) / 2}
    for k in ("t4", "t1", "c2"):
        if k in P:
            centroides[k] = P[k]
    for k, c in centroides.items():
        if k in ("l1", "t4"):
            out[f"{k}pa"] = _theta(c - H, a, u) - ts1
        if k in ("l1", "t1", "c2"):
            out[f"{k}tilt"] = _theta(c - H, a, u)
    if mm_por_px:
        out["sva_cm"] = float(np.dot(P["c7"] - P["s1Post"], a)) * mm_por_px / 10
    return out


def _r1(x):
    return None if x is None else round(x + 0.0, 1)


def gap(pi, ss, l1s1, l4s1, gt, edad):
    """GAP score (Yilgor 2017) sobre valores redondeados a un decimal."""
    pi, ss, l1s1, l4s1, gt = (_r1(x) for x in (pi, ss, l1s1, l4s1, gt))
    rpv = ss - (0.59 * pi + 9)
    rll = l1s1 - (0.62 * pi + 29)
    ldi = l4s1 / l1s1 * 100 if l1s1 else None
    rsa = gt - (0.48 * pi - 15)
    p_rpv = 3 if rpv < -15 else 2 if rpv < -7 else 0 if rpv <= 5 else 1
    p_rll = 3 if rll < -25 else 2 if rll < -14 else 0 if rll <= 11 else 3
    p_ldi = 0 if ldi is None else 2 if ldi < 40 else 1 if ldi < 50 else 0 if ldi <= 80 else 3
    p_rsa = 3 if rsa > 18 else 1 if rsa > 10 else 0 if rsa >= -7 else 1
    p_edad = 1 if edad >= 60 else 0
    total = p_rpv + p_rll + p_ldi + p_rsa + p_edad
    cat = "proporcionado" if total <= 2 else "moderado" if total <= 6 else "severo"
    return {"rpv": rpv, "rll": rll, "ldi": ldi, "rsa": rsa,
            "puntos": [p_rpv, p_rll, p_ldi, p_rsa, p_edad], "total": total, "categoria": cat}


def schwab(pi, l1s1, pt, sva_cm):
    def g(v, t0, t1):
        if v is None:
            return None
        return "0" if v < t0 else "+" if v <= t1 else "++"
    pill = None if pi is None or l1s1 is None else _r1(pi) - _r1(l1s1)
    return {"pi_ll": g(pill, 10, 20), "pt": g(_r1(pt), 20, 30), "sva": g(_r1(sva_cm), 4, 9.5)}


def roussouly(ss, pi, pt):
    ss, pi, pt = _r1(ss), _r1(pi), _r1(pt)
    if ss < 35:
        return "1|2"
    if ss >= 45:
        return "4"
    return "3AP" if (pi < 50 and pt < 5) else "3"
