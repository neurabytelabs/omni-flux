export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec4 position;
void main() {
  gl_Position = position;
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;
uniform vec2 iMouse;

// Master Params
uniform float iFeedback;
uniform float iSpeed;
uniform float iZoom;
uniform float iColorShift;
uniform float iDistortAmp;
uniform float iDistortFreq;
uniform float iRGBSplit;
uniform float iComplexity;
uniform float iBrightness;

// Audio Reactivity
uniform float iAudioLow;
uniform float iAudioMid;
uniform float iAudioHigh;
uniform float iAudioLevel;

out vec4 fragColor;

// Rotate 2D vector
vec2 rotate(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c) * v;
}

// Hue shift helper
vec3 hueShift(vec3 col, float shift) {
    vec3 m = vec3(cos(shift), -sin(shift) * .57735, 0);
    m = vec3(m.xy, -m.y) + ((1. - m.x) * .33333);
    return mat3(m, m.zxy, m.yzx) * col;
}

void main() {
    vec2 r = iResolution;
    float t = iTime * iSpeed;
    vec2 FC = gl_FragCoord.xy;
    
    // Audio Modulators
    // Mids affect complexity/geometry
    float modComplexity = iComplexity + (iAudioMid * 0.5); 
    // Bass affects distortion amplitude
    float modDistort = iDistortAmp + (iAudioLow * 0.15);
    // Treble affects color speed/shift
    float modColor = iColorShift + (iAudioHigh * 2.0);
    // Level affects zoom slightly (breathing)
    float modZoom = iZoom - (iAudioLevel * 0.05);

    // 1. Organic Coordinate System
    vec2 uv_norm = (FC.xy * 2. - r) / r.y;
    
    vec2 mouseOffset = vec2(0.);
    if (length(iMouse) > 0.0) {
        vec2 m = iMouse;
        m.y = 1.0 - m.y; 
        mouseOffset = (m - 0.5) * 4.0;
    }
    
    vec2 p = (uv_norm - mouseOffset) / (.3 * max(modZoom, 0.01));
    
    // 2. The Algorithm (Fractal/Chaos)
    vec2 v = vec2(0.);
    vec4 o = vec4(0.);
    
    float structAngle = modComplexity * 0.785; 
    
    for(float i = 0.; i < 9.; i++) {
        float ii = i + 1.;
        v = p;
        
        v = rotate(v, structAngle * ii * 0.1);
        
        for(float f = 0.; f < 9.; f++) {
           float fi = f + 1.;
           float coeff = ii * (1.0 + modComplexity * 0.5);
           v += sin(ceil(v.yx * fi + coeff) + r - t * 0.5) / fi;
        }
        
        float l = dot(p, p) - 5. - 2. / v.y;
        vec4 colorBase = cos(ii / 3. + .1 / l + vec4(1, 2, 3, 4) + modColor) + 1.0;
        o += .1 / abs(l) * colorBase;
    }
    
    // 3. Fluid Feedback System
    vec2 flow = vec2(
        sin(uv_norm.y * iDistortFreq * 20. + t), 
        cos(uv_norm.x * iDistortFreq * 20. + t * 0.8)
    );
    
    // Bass kick distortion
    vec2 uv_distorted = (FC.xy / r) + flow * modDistort;
    
    // Zoom into feedback
    uv_distorted = (uv_distorted - 0.5) * (0.995 + modDistort * 0.1) + 0.5;

    // 4. Chromatic Aberration
    // Audio High adds extra aberration
    float split = (iRGBSplit + iAudioHigh * 0.5) * 0.005;
    vec3 oldColor;
    oldColor.r = texture(iChannel0, uv_distorted + vec2(split, 0.0)).r;
    oldColor.g = texture(iChannel0, uv_distorted).g;
    oldColor.b = texture(iChannel0, uv_distorted - vec2(split, 0.0)).b;
    
    oldColor = hueShift(oldColor, 0.01 * iSpeed); 

    // 5. Final Composition
    // Volume adds brightness kick
    float modBrightness = iBrightness + iAudioLevel * 0.5;
    vec4 final = vec4(max(tanh(o.rgb * modBrightness + oldColor * iFeedback), 0.0), 1.0);
    
    fragColor = final;
}
`;