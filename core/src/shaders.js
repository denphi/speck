"use strict";
var shaders = {}; 
shaders ["accumulator"] = `#version 100
precision highp float;

attribute vec3 aPosition;

void main() {
    gl_Position = vec4(aPosition, 1);
}


// __split__


#version 100
precision highp float;

uniform sampler2D uSceneDepth;
uniform sampler2D uSceneNormal;
uniform sampler2D uRandRotDepth;
uniform sampler2D uAccumulator;
uniform mat4 uRot;
uniform mat4 uInvRot;
uniform vec2 uSceneBottomLeft;
uniform vec2 uSceneTopRight;
uniform vec2 uRotBottomLeft;
uniform vec2 uRotTopRight;
uniform float uDepth;
uniform float uRes;
uniform float uAORes;
uniform int uSampleCount;

void main() {

    float dScene = texture2D(uSceneDepth, gl_FragCoord.xy/uRes).r;

    vec3 r = vec3(uSceneBottomLeft + (gl_FragCoord.xy/uRes) * (uSceneTopRight - uSceneBottomLeft), 0.0);

    r.z = -(dScene - 0.5) * uDepth;
    r = vec3(uRot * vec4(r, 1));
    float depth = -r.z/uDepth + 0.5;

    vec2 p = (r.xy - uRotBottomLeft)/(uRotTopRight - uRotBottomLeft);

    float dRandRot = texture2D(uRandRotDepth, p).r;

    vec3 normal = texture2D(uSceneNormal, gl_FragCoord.xy/uRes).rgb * 2.0 - 1.0;
    vec3 dir = vec3(uInvRot * vec4(0, 0, 1, 0));
    float mag = dot(dir, normal);
    float sampled = step(0.0, mag);

    // Depth bias of about two shadow-map texels, growing on surfaces seen at a
    // grazing angle. Depth is normalized by the scene size, and so is a texel,
    // so the bias is the same in Angstrom for small and large molecules.
    float slope = sqrt(max(0.0, 1.0 - mag * mag)) / max(mag, 0.2);
    float bias = (2.0 + 2.0 * slope) / uAORes;
    float ao = step(dRandRot, depth - bias);

    ao *= sampled;

    vec4 acc = texture2D(uAccumulator, gl_FragCoord.xy/uRes);

    if (uSampleCount < 256) {
        acc.r += ao/255.0;
    } else if (uSampleCount < 512) {
        acc.g += ao/255.0;
    } else if (uSampleCount < 768) {
        acc.b += ao/255.0;
    } else {
        acc.a += ao/255.0;
    }
        
    gl_FragColor = acc;

}
`; 
shaders ["shadow"] = `#version 100
precision highp float;

attribute vec3 aPosition;

void main() {
    gl_Position = vec4(aPosition, 1);
}


// __split__


#version 100
precision highp float;

// Visibility of each scene pixel from the key light, from a depth map rendered
// along the light direction. 5x5 percentage-closer filtering softens the edge.
uniform sampler2D uSceneDepth;
uniform sampler2D uSceneNormal;
uniform sampler2D uShadowMap;
uniform mat4 uRot;
uniform mat4 uInvRot;
uniform vec2 uSceneBottomLeft;
uniform vec2 uSceneTopRight;
uniform vec2 uRotBottomLeft;
uniform vec2 uRotTopRight;
uniform float uDepth;
uniform float uRes;
uniform float uShadowRes;
uniform float uSoftness;

void main() {
    vec2 uv = gl_FragCoord.xy/uRes;
    float dScene = texture2D(uSceneDepth, uv).r;
    if (dScene >= 1.0) {
        gl_FragColor = vec4(1.0);
        return;
    }
    vec3 r = vec3(uSceneBottomLeft + uv * (uSceneTopRight - uSceneBottomLeft), 0.0);
    r.z = -(dScene - 0.5) * uDepth;
    r = vec3(uRot * vec4(r, 1));
    float depth = -r.z/uDepth + 0.5;
    vec2 p = (r.xy - uRotBottomLeft)/(uRotTopRight - uRotBottomLeft);

    vec3 normal = texture2D(uSceneNormal, uv).rgb * 2.0 - 1.0;
    vec3 dir = vec3(uInvRot * vec4(0, 0, 1, 0));
    float mag = dot(dir, normal);
    float slope = sqrt(max(0.0, 1.0 - mag * mag)) / max(mag, 0.2);
    float bias = (1.5 + 2.0 * slope) / uShadowRes;

    float lit = 0.0;
    for (int i = -2; i <= 2; i++) {
        for (int j = -2; j <= 2; j++) {
            vec2 o = vec2(float(i), float(j)) * (uSoftness / uShadowRes);
            lit += step(depth - bias, texture2D(uShadowMap, p + o).r);
        }
    }
    lit = lit / 25.0 * step(0.0, mag);
    gl_FragColor = vec4(lit, lit, lit, 1.0);
}
`; 
shaders ["ao"] = `#version 100
precision highp float;

attribute vec3 aPosition;

void main() {
    gl_Position = vec4(aPosition, 1);
}


// __split__


#version 100
precision highp float;

uniform sampler2D uSceneColor;
uniform sampler2D uSceneDepth;
uniform sampler2D uSceneNormal;
uniform sampler2D uAccumulatorOut;
uniform sampler2D uShadow;
// Translucent surface layer, drawn over the opaque scene when uSurfaceOpacity < 1.
uniform sampler2D uSurfaceColor;
uniform sampler2D uSurfaceDepth;
uniform sampler2D uSurfaceNormal;
uniform sampler2D uSurfaceAccumulator;
uniform float uSurfaceOpacity;
uniform float uRes;
uniform float uDepth;
uniform float uAO;
uniform float uBrightness;
uniform float uOutlineStrength;
uniform float uOutlineWidth;
uniform vec3 uOutlineColor;
uniform float uSpecular;
uniform float uGloss;
uniform float uMetallic;
uniform float uMetalAll;
uniform vec3 uLightDir;
uniform float uShadows;
uniform float uRim;
uniform float uFog;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uSaturation;
uniform float uTonemap;

// Simple studio environment seen by reflections (view space, y up):
// bright overhead, dark floor, plus a soft box at the key light.
vec3 environment(vec3 r, float blur) {
    float sky = smoothstep(-blur, blur, r.y + 0.1);
    float e = mix(0.25, 1.1, sky) * (0.8 + 0.2 * r.y);
    float box = pow(max(dot(r, uLightDir), 0.0), mix(6.0, 96.0, uGloss)) * 1.2;
    return vec3(e + box);
}

// Highlights above 0.8 roll off smoothly toward 1 instead of clipping.
vec3 softClip(vec3 c) {
    vec3 over = max(c - 0.8, 0.0);
    return min(c, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));
}

// Shade one layer: outline, ambient occlusion, key light and materials, depth
// fog and grading. Returns premultiplied color; alpha is coverage.
vec4 shadeLayer(sampler2D colorTex, sampler2D depthTex, sampler2D normalTex, sampler2D accTex,
                float receivesShadow, vec2 p) {
    vec4 sceneColor = texture2D(colorTex, p);
    float covered = sceneColor.a;
    float depth = texture2D(depthTex, p).r;
    if (uOutlineStrength > 0.0) {
        // Eight taps (axes and diagonals) keep wide outlines continuous.
        float r = uOutlineWidth/511.0;
        float q = 0.7071 * r;
        float d = 0.0;
        d = max(d, abs(texture2D(depthTex, p + vec2(-r,  0)).r - depth));
        d = max(d, abs(texture2D(depthTex, p + vec2( r,  0)).r - depth));
        d = max(d, abs(texture2D(depthTex, p + vec2( 0, -r)).r - depth));
        d = max(d, abs(texture2D(depthTex, p + vec2( 0,  r)).r - depth));
        d = max(d, abs(texture2D(depthTex, p + vec2(-q, -q)).r - depth));
        d = max(d, abs(texture2D(depthTex, p + vec2( q, -q)).r - depth));
        d = max(d, abs(texture2D(depthTex, p + vec2(-q,  q)).r - depth));
        d = max(d, abs(texture2D(depthTex, p + vec2( q,  q)).r - depth));
        // Depth step in units of 20 Angstrom, so the same setting gives the same
        // outline for small molecules and large proteins.
        d = min(1.0, d * uDepth / 20.0);
        float line = 1.0 - pow(1.0 - d, uOutlineStrength * 32.0);
        line = max(line, step(0.003, d) * (1.0 - covered));
        sceneColor.rgb = mix(sceneColor.rgb, uOutlineColor, line);
        sceneColor.a = max(line, sceneColor.a);
    }
    vec4 dAccum = texture2D(accTex, p);
    float shade = max(0.0, 1.0 - (dAccum.r + dAccum.g + dAccum.b + dAccum.a) * 0.25 * uAO);
    shade = pow(shade, 2.0);
    vec3 color = sceneColor.rgb * shade;
    if (covered > 0.0 && (uSpecular > 0.0 || uMetallic > 0.0 || uShadows > 0.0 || uRim > 0.0)) {
        vec4 n = texture2D(normalTex, p);
        vec3 N = normalize(n.rgb * 2.0 - 1.0);
        float visibility = mix(1.0, texture2D(uShadow, p).r, uShadows * receivesShadow);
        // Key light: soft (half-Lambert) diffuse falloff plus cast shadows.
        float wrap = dot(N, uLightDir) * 0.5 + 0.5;
        float key = mix(1.0, 0.35 + 0.65 * wrap * visibility, uShadows);
        color *= key;

        float metal = uMetallic * max(uMetalAll, step(0.75, n.a));
        vec3 V = vec3(0.0, 0.0, 1.0);
        vec3 H = normalize(uLightDir + V);
        vec3 R = reflect(-V, N);
        float shininess = mix(8.0, 300.0, uGloss * uGloss);
        float highlight = pow(max(dot(N, H), 0.0), shininess) * uSpecular * (1.0 + uGloss) * visibility;
        // Metals reflect in their own color, turning whiter at grazing angles.
        float fresnel = pow(1.0 - max(N.z, 0.0), 5.0);
        vec3 tint = mix(sceneColor.rgb, vec3(1.0), fresnel);
        vec3 reflection = environment(R, mix(0.8, 0.12, uGloss)) * tint;
        // Occluded areas also see less of the environment.
        float specOcclusion = mix(1.0, shade, 0.85);
        color = color * (1.0 - 0.85 * metal)
              + metal * reflection * specOcclusion
              + mix(vec3(1.0), sceneColor.rgb, metal) * highlight * specOcclusion;
        // Rim light separates the silhouette from the background.
        color += uRim * pow(1.0 - max(N.z, 0.0), 3.0) * mix(1.0, shade, 0.5);
    }
    color *= uBrightness;
    if (uFog > 0.0 && covered > 0.0) {
        // Depth cue: fade toward the fog color from the front to the back of the structure.
        float f = clamp((depth - uFogNear) / max(uFogFar - uFogNear, 1e-4), 0.0, 1.0);
        color = mix(color, uFogColor * sceneColor.a, uFog * f * f * (3.0 - 2.0 * f));
    }
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = max(mix(vec3(luma), color, uSaturation), 0.0);
    if (uTonemap > 0.0) {
        color = softClip(color);
    }
    return vec4(color, sceneColor.a);
}

void main() {
    vec2 p = gl_FragCoord.xy/uRes;
    vec4 result = shadeLayer(uSceneColor, uSceneDepth, uSceneNormal, uAccumulatorOut, 1.0, p);
    if (uSurfaceOpacity < 1.0) {
        vec4 surface = shadeLayer(uSurfaceColor, uSurfaceDepth, uSurfaceNormal, uSurfaceAccumulator, 0.0, p);
        float inFront = step(texture2D(uSurfaceDepth, p).r, texture2D(uSceneDepth, p).r);
        if (surface.a > 0.0 && inFront > 0.0) {
            // More opaque where the surface turns away, so its shape stays readable.
            float facing = clamp(texture2D(uSurfaceNormal, p).b * 2.0 - 1.0, 0.0, 1.0);
            float alpha = mix(uSurfaceOpacity, 1.0, 0.5 * pow(1.0 - facing, 3.0)) * surface.a;
            result = vec4(surface.rgb * alpha + result.rgb * (1.0 - alpha),
                          alpha + result.a * (1.0 - alpha));
        }
    }
    gl_FragColor = result;
}
`; 
shaders ["atom"] = `#version 100
precision highp float;

attribute vec3 aImposter;
attribute vec3 aPosition;
attribute float aRadius;
attribute vec3 aColor;
attribute float aMetal;
attribute float aScale;

uniform mat4 uView;
uniform mat4 uProjection;
uniform mat4 uModel;
uniform float uAtomScale;
uniform float uRelativeAtomScale;
uniform float uAtomShade;

varying vec3 vColor;
varying vec3 vPosition;
varying float vRadius;
varying float vMetal;

void main() {
    vMetal = aMetal;
    vRadius = aScale * uAtomScale * (1.0 + (aRadius - 1.0) * uRelativeAtomScale);
    // The projection is orthographic, so a screen-aligned square of side 2r
    // covers the sphere; the fragment shader ray-casts it and writes depth.
    vec4 center = uView * uModel * vec4(aPosition, 1.0);
    gl_Position = uProjection * (center + vec4(vRadius * aImposter.xy, 0.0, 0.0));
    vColor = mix(aColor, vec3(1,1,1), uAtomShade);
    vPosition = vec3(uModel * vec4(aPosition, 1));
}


// __split__


#version 100
#extension GL_EXT_frag_depth: enable
precision highp float;

uniform vec2 uBottomLeft;
uniform vec2 uTopRight;
uniform float uRes;
uniform float uDepth;
uniform int uMode;

varying vec3 vPosition;
varying float vRadius;
varying vec3 vColor;
varying float vMetal;

vec2 res = vec2(uRes, uRes);

float raySphereIntersect(vec3 r0, vec3 rd) {
    float a = dot(rd, rd);
    vec3 s0_r0 = r0 - vPosition;
    float b = 2.0 * dot(rd, s0_r0);
    float c = dot(s0_r0, s0_r0) - (vRadius * vRadius);
    float disc = b*b - 4.0*a*c;
    if (disc <= 0.0) {
        return -1.0;
    }
    return (-b - sqrt(disc))/(2.0*a);
}

void main() {
    vec3 r0 = vec3(uBottomLeft + (gl_FragCoord.xy/res) * (uTopRight - uBottomLeft), 0.0);
    vec3 rd = vec3(0, 0, -1);
    float t = raySphereIntersect(r0, rd);
    if (t < 0.0) {
        discard;
    }
    vec3 coord = r0 + rd * t;
    vec3 normal = normalize(coord - vPosition);
    if (uMode == 0) {
        gl_FragColor = vec4(vColor, 1);
    } else if (uMode == 1) {
        // Alpha carries the material: 1.0 for metals, 0.5 otherwise.
        gl_FragColor = vec4(normal * 0.5 + 0.5, mix(0.5, 1.0, vMetal));
    }
    gl_FragDepthEXT = -coord.z/uDepth;
}
`; 
shaders ["blur"] = `#version 100
precision highp float;

attribute vec3 aPosition;

void main() {
    gl_Position = vec4(aPosition, 1);
}


// __split__


#version 100
precision highp float;

uniform sampler2D uTexture;
uniform float uRes;
uniform int leftRight;

void main() {
    vec2 dir;
    if (leftRight == 1) {
        dir = vec2(1,0)/uRes;
    } else {
        dir = vec2(0,1)/uRes;
    }
    const int range = 16;
    vec4 sample = vec4(0,0,0,0);
    for (int i = -range; i <= range; i++) {
        vec2 p = gl_FragCoord.xy/uRes + dir * float(i);
        sample += texture2D(uTexture, p);
    }
    sample /= float(range) * 2.0 + 1.0;
    gl_FragColor = sample;
}
`; 
shaders ["bond"] = `#version 100
precision highp float;

attribute vec3 aImposter;
attribute vec3 aPosA;
attribute vec3 aPosB;
attribute float aRadA;
attribute float aRadB;
attribute vec3 aColA;
attribute vec3 aColB;
attribute float aMetA;
attribute float aMetB;

uniform mat4 uView;
uniform mat4 uProjection;
uniform mat4 uModel;
uniform mat4 uRotation;
uniform float uBondRadius;
uniform float uAtomScale;
uniform float uRelativeAtomScale;

varying vec3 vNormal;
varying vec3 vPosA, vPosB;
varying float vRadA, vRadB;
varying vec3 vColA, vColB;
varying float vMetA, vMetB;
varying float vRadius;

mat3 alignVector(vec3 a, vec3 b) {
    vec3 v = cross(a, b);
    float s = length(v);
    float c = dot(a, b);
    mat3 I = mat3(
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    );
    mat3 vx = mat3(
        0, v.z, -v.y,
        -v.z, 0, v.x,
        v.y, -v.x, 0
    );
    return I + vx + vx * vx * ((1.0 - c) / (s * s));
}

void main() {
    vRadius = uBondRadius;
    vec3 pos = vec3(aImposter);
    // Scale the box in x and z to be bond-radius.
    pos = pos * vec3(vRadius, 1, vRadius);
    // Shift the origin-centered cube so that the bottom is at the origin.
    pos = pos + vec3(0, 1, 0);
    // Stretch the box in y so that it is the length of the bond.
    pos = pos * vec3(1, length(aPosA - aPosB) * 0.5, 1);
    // Find the rotation that aligns vec3(0, 1, 0) with vec3(uPosB - uPosA) and apply it.
    vec3 a = normalize(vec3(-0.000001, 1.000001, 0.000001));
    vec3 b = normalize(aPosB - aPosA);
    mat3 R = alignVector(a, b);
    pos = R * pos;
    // Shift the cube so that the bottom is centered at the middle of atom A.
    pos = pos + aPosA;

    vec4 position = uModel * vec4(pos, 1);
    gl_Position = uProjection * uView * position;
    vPosA = aPosA;
    vPosB = aPosB;
    vRadA = uAtomScale * (1.0 + (aRadA - 1.0) * uRelativeAtomScale);
    vRadB = uAtomScale * (1.0 + (aRadB - 1.0) * uRelativeAtomScale);
    vColA = aColA;
    vColB = aColB;
    vMetA = aMetA;
    vMetB = aMetB;
}


// __split__


#version 100
#extension GL_EXT_frag_depth: enable
precision highp float;

uniform mat4 uRotation;
uniform vec2 uBottomLeft;
uniform vec2 uTopRight;
uniform float uDepth;
uniform float uRes;
uniform float uBondShade;
uniform int uMode;

varying vec3 vPosA, vPosB;
varying float vRadA, vRadB;
varying vec3 vColA, vColB;
varying float vMetA, vMetB;
varying float vRadius;

mat3 alignVector(vec3 a, vec3 b) {
    vec3 v = cross(a, b);
    float s = length(v);
    float c = dot(a, b);
    mat3 I = mat3(
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    );
    mat3 vx = mat3(
        0, v.z, -v.y,
        -v.z, 0, v.x,
        v.y, -v.x, 0
    );
    return I + vx + vx * vx * ((1.0 - c) / (s * s));
}

void main() {

    vec2 res = vec2(uRes, uRes);
    vec3 r0 = vec3(uBottomLeft + (gl_FragCoord.xy/res) * (uTopRight - uBottomLeft), uDepth/2.0);
    vec3 rd = vec3(0, 0, -1);

    vec3 i = normalize(vPosB - vPosA);
         i = vec3(uRotation * vec4(i, 0));
    vec3 j = normalize(vec3(-0.000001, 1.000001, 0.000001));
    mat3 R = alignVector(i, j);

    vec3 r0p = r0 - vec3(uRotation * vec4(vPosA, 0));
    r0p = R * r0p;
    vec3 rdp = R * rd;

    float a = dot(rdp.xz, rdp.xz);
    float b = 2.0 * dot(rdp.xz, r0p.xz);
    float c = dot(r0p.xz, r0p.xz) - vRadius*vRadius;
    float disc = b*b - 4.0*a*c;
    if (disc <= 0.0) {
        discard;
    }
    float t = (-b - sqrt(disc))/(2.0*a);
    if (t < 0.0) {
        discard;
    }

    vec3 coord = r0p + rdp * t;
    if (coord.y < 0.0 || coord.y > length(vPosA - vPosB)) {
        discard;
    }

    vec3 color;
    float metal;
    if (coord.y < vRadA + 0.5 * (length(vPosA - vPosB) - (vRadA + vRadB))) {
        color = vColA;
        metal = vMetA;
    } else {
        color = vColB;
        metal = vMetB;
    }

    color = mix(color, vec3(1,1,1), uBondShade);

    R = alignVector(j, i);
    vec3 normal = normalize(R * vec3(coord.x, 0, coord.z));

    coord = r0 + rd * t;
    if (uMode == 0) {
        gl_FragColor = vec4(color, 1);
    } else if (uMode == 1) {
        gl_FragColor = vec4(normal * 0.5 + 0.5, mix(0.5, 1.0, metal));
    }
    gl_FragDepthEXT = -(coord.z - uDepth/2.0)/uDepth;
}
`; 
shaders ["cartoon"] = `#version 100
precision highp float;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;

uniform mat4 uView;
uniform mat4 uProjection;
uniform mat4 uModel;
uniform float uCartoonShade;

varying vec3 vNormal;
varying vec3 vColor;

void main() {
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
    vNormal = vec3(uModel * vec4(aNormal, 0.0));
    vColor = mix(aColor, vec3(1,1,1), uCartoonShade);
}


// __split__


#version 100
precision highp float;

uniform int uMode;

varying vec3 vNormal;
varying vec3 vColor;

void main() {
    if (uMode == 0) {
        gl_FragColor = vec4(vColor, 1);
    } else {
        vec3 normal = normalize(vNormal);
        gl_FragColor = vec4(normal * 0.5 + 0.5, 0.5);
    }
}
`;
shaders ["dof"] = `#version 100
precision highp float;

attribute vec3 aPosition;

void main() {
    gl_Position = vec4(aPosition, 1);
}


// __split__


#version 100
precision highp float;

uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform float uRes;
uniform float uDOFPosition;
uniform float uDOFStrength;
// Scene depth range (Angstrom) and zoom (1 / frame width in Angstrom).
uniform float uRange;
uniform float uZoom;

const int TAPS = 128;
const float MAX_COC = 0.08;

// Circle of confusion (fraction of the frame) for a normalized depth. It grows
// with the distance to the focal plane in Angstrom and with magnification, so
// zooming in on a detail gives a shallow, macro-lens depth of field.
float coc(float depth) {
    float angstrom = abs(uDOFPosition - depth) * uRange;
    return min(uDOFStrength * 0.06 * angstrom * uZoom, MAX_COC);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float radius = coc(texture2D(uDepth, uv).r);

    vec4 sum = texture2D(uColor, uv);
    float weight = 1.0;
    float pixel = 1.0 / uRes;
    if (radius > pixel) {
        // Rotate the spiral per pixel (interleaved gradient noise) so large
        // blurs show fine grain instead of a visible sampling pattern.
        float jitter = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        for (int i = 0; i < TAPS; i++) {
            // Golden-angle spiral: even coverage of the disk.
            float t = (float(i) + 0.5) / float(TAPS);
            float angle = float(i) * 2.39996323 + jitter;
            float dist = sqrt(t) * radius;
            vec2 q = uv + vec2(cos(angle), sin(angle)) * dist;
            vec4 c = texture2D(uColor, q);
            // A sample counts only if its own blur reaches this pixel, so sharp
            // objects do not bleed into blurred ones.
            float reach = clamp((coc(texture2D(uDepth, q).r) - dist) / pixel + 0.5, 0.0, 1.0);
            // Bright highlights bloom into bokeh discs.
            float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            float w = reach * (1.0 + 3.0 * smoothstep(0.75, 1.0, luma));
            sum += c * w;
            weight += w;
        }
    }
    gl_FragColor = sum / weight;
}`; 
shaders ["fxaa"] = `#version 100
precision highp float;

attribute vec3 aPosition;

void main() {
    gl_Position = vec4(aPosition, 1);
}


// __split__


#version 100
precision highp float;

uniform sampler2D uTexture;
uniform float uRes;

void main() {
    float FXAA_SPAN_MAX = 8.0;
    float FXAA_REDUCE_MUL = 1.0/8.0;
    float FXAA_REDUCE_MIN = 1.0/128.0;

    vec2 texCoords = gl_FragCoord.xy/uRes;

    vec4 rgbNW = texture2D(uTexture, texCoords + (vec2(-1.0, -1.0) / uRes));
    vec4 rgbNE = texture2D(uTexture, texCoords + (vec2(1.0, -1.0) / uRes));
    vec4 rgbSW = texture2D(uTexture, texCoords + (vec2(-1.0, 1.0) / uRes));
    vec4 rgbSE = texture2D(uTexture, texCoords + (vec2(1.0, 1.0) / uRes));
    vec4 rgbM  = texture2D(uTexture, texCoords);

    vec4 luma = vec4(0.299, 0.587, 0.114, 1.0);
    float lumaNW = dot(rgbNW, luma);
    float lumaNE = dot(rgbNE, luma);
    float lumaSW = dot(rgbSW, luma);
    float lumaSE = dot(rgbSE, luma);
    float lumaM  = dot(rgbM,  luma);

    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

    vec2 dir;
    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);

    float rcpDirMin = 1.0/(min(abs(dir.x), abs(dir.y)) + dirReduce);

    dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX), dir * rcpDirMin)) / uRes;

    vec4 rgbA = (1.0/2.0) * 
        (texture2D(uTexture, texCoords.xy + dir * (1.0/3.0 - 0.5)) + 
         texture2D(uTexture, texCoords.xy + dir * (2.0/3.0 - 0.5)));
    vec4 rgbB = rgbA * (1.0/2.0) + (1.0/4.0) * 
        (texture2D(uTexture, texCoords.xy + dir * (0.0/3.0 - 0.5)) +
         texture2D(uTexture, texCoords.xy + dir * (3.0/3.0 - 0.5)));
    float lumaB = dot(rgbB, luma);

    if((lumaB < lumaMin) || (lumaB > lumaMax)){
        gl_FragColor = rgbA;
    } else {
        gl_FragColor = rgbB;
    }

}`; 
shaders ["textured-quad"] = `#version 100
precision highp float;

attribute vec3 aPosition;

void main() {
    gl_Position = vec4(aPosition, 1);
}


// __split__


#version 100
precision highp float;

uniform sampler2D uTexture;
uniform float uRes;

void main() {
    gl_FragColor = texture2D(uTexture, gl_FragCoord.xy/uRes);
}
`; 
module.exports = {shaders};
