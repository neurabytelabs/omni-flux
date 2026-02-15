export interface ShaderProgramInfo {
  program: WebGLProgram;
  attribLocations: {
    position: number;
  };
  uniformLocations: {
    iResolution: WebGLUniformLocation | null;
    iTime: WebGLUniformLocation | null;
    iChannel0: WebGLUniformLocation | null;
    iMouse: WebGLUniformLocation | null;
    
    // Core Simulation
    iFeedback: WebGLUniformLocation | null;
    iSpeed: WebGLUniformLocation | null;
    
    // Geometry
    iZoom: WebGLUniformLocation | null;
    iComplexity: WebGLUniformLocation | null;
    
    // Optics / Distortion
    iDistortAmp: WebGLUniformLocation | null;
    iDistortFreq: WebGLUniformLocation | null;
    
    // Color / Post
    iColorShift: WebGLUniformLocation | null;
    iRGBSplit: WebGLUniformLocation | null;
    iBrightness: WebGLUniformLocation | null;

    // Audio
    iAudioLow: WebGLUniformLocation | null;
    iAudioMid: WebGLUniformLocation | null;
    iAudioHigh: WebGLUniformLocation | null;
    iAudioLevel: WebGLUniformLocation | null;
  };
}

export interface FramebufferObj {
  texture: WebGLTexture;
  fb: WebGLFramebuffer;
}

export interface ControlGroup {
  title: string;
  items: ControlItem[];
}

export interface ControlItem {
  label: string;
  value: number;
  setValue: (val: number) => void;
  min: number;
  max: number;
  step: number;
  color: string;
}

export interface PresetParams {
  feedback: number;
  speed: number;
  zoom: number;
  complexity: number;
  distortAmp: number;
  distortFreq: number;
  colorShift: number;
  rgbSplit: number;
  brightness: number;
}

export interface Preset {
  name: string;
  params: PresetParams;
}

export interface AudioData {
  low: number;
  mid: number;
  high: number;
  level: number;
  waveform: Uint8Array;
}