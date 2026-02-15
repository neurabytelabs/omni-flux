import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ShaderProgramInfo, FramebufferObj, ControlGroup, Preset, PresetParams } from '../types';
import { VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE } from '../constants';
import { AudioEngine } from '../utils/AudioEngine';
import { RecordingManager } from '../utils/RecordingManager';

const PRESETS: Preset[] = [
  {
    name: "DEFAULT",
    params: { feedback: 0.92, speed: 1.0, zoom: 1.0, complexity: 0.3, distortAmp: 0.04, distortFreq: 0.02, colorShift: 0.0, rgbSplit: 0.2, brightness: 1.0 }
  },
  {
    name: "CYBER_VOID",
    params: { feedback: 0.96, speed: 0.5, zoom: 0.8, complexity: 1.2, distortAmp: 0.005, distortFreq: 0.1, colorShift: 4.2, rgbSplit: 1.5, brightness: 1.2 }
  },
  {
    name: "INFERNO",
    params: { feedback: 0.85, speed: 2.5, zoom: 1.5, complexity: 0.1, distortAmp: 0.15, distortFreq: 0.05, colorShift: 1.5, rgbSplit: 0.0, brightness: 1.8 }
  },
  {
    name: "LIQUID_DREAM",
    params: { feedback: 0.98, speed: 0.2, zoom: 1.1, complexity: 0.6, distortAmp: 0.08, distortFreq: 0.01, colorShift: 2.8, rgbSplit: 0.8, brightness: 0.9 }
  },
  {
    name: "HYPER_GLITCH",
    params: { feedback: 0.60, speed: 3.0, zoom: 2.0, complexity: 1.8, distortAmp: 0.2, distortFreq: 0.2, colorShift: 0.5, rgbSplit: 2.0, brightness: 2.5 }
  },
  // NEW PRESETS
  {
    name: "NEURAL_STORM",
    params: { feedback: 0.94, speed: 1.8, zoom: 0.6, complexity: 1.9, distortAmp: 0.08, distortFreq: 0.15, colorShift: 3.14, rgbSplit: 2.5, brightness: 1.3 }
  },
  {
    name: "QUANTUM_FOAM",
    params: { feedback: 0.91, speed: 4.0, zoom: 3.5, complexity: 1.5, distortAmp: 0.02, distortFreq: 0.25, colorShift: 0.0, rgbSplit: 0.5, brightness: 1.1 }
  },
  {
    name: "DEEP_OCEAN",
    params: { feedback: 0.97, speed: 0.3, zoom: 1.2, complexity: 0.8, distortAmp: 0.12, distortFreq: 0.005, colorShift: 3.5, rgbSplit: 1.2, brightness: 0.8 }
  },
  {
    name: "SOLAR_FLARE",
    params: { feedback: 0.88, speed: 2.0, zoom: 0.9, complexity: 0.2, distortAmp: 0.25, distortFreq: 0.08, colorShift: 0.8, rgbSplit: 0.3, brightness: 2.2 }
  },
  {
    name: "MATRIX_RAIN",
    params: { feedback: 0.93, speed: 1.2, zoom: 1.0, complexity: 1.7, distortAmp: 0.0, distortFreq: 0.0, colorShift: 1.8, rgbSplit: 0.1, brightness: 1.5 }
  },
  {
    name: "AUDIO_PULSE",
    params: { feedback: 0.80, speed: 1.0, zoom: 0.5, complexity: 0.5, distortAmp: 0.01, distortFreq: 0.0, colorShift: 0.0, rgbSplit: 0.1, brightness: 0.8 }
  }
];

const LERP_FACTOR = 0.1;

const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  
  // Logic Engines
  const audioEngine = useRef(new AudioEngine());
  const recorder = useRef(new RecordingManager());

  // UI State
  const [fps, setFps] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>("Simulation"); 
  const [activePreset, setActivePreset] = useState<string>("DEFAULT");
  const [isRecording, setIsRecording] = useState(false);

  // Audio State
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioSensitivity, setAudioSensitivity] = useState(2.0);
  const [audioSmoothing, setAudioSmoothing] = useState(0.8);

  // --- PARAMETERS (State = Target) ---
  const [targetParams, setTargetParams] = useState<PresetParams>(PRESETS[0].params);
  
  // Current values for Lerping (Refs for perf in render loop)
  const currentParams = useRef<PresetParams>({ ...PRESETS[0].params });

  const mouseRef = useRef<{x: number, y: number}>({x: 0.5, y: 0.5});
  const isMouseDownRef = useRef(false);

  // Touch/Gesture Refs
  const touchStartDist = useRef<number>(0);
  const touchStartAngle = useRef<number>(0);
  const touchStartZoom = useRef<number>(0);
  const touchStartColor = useRef<number>(0);
  const touchStartX = useRef<number>(0);

  // WebGL Resources Refs
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programInfoRef = useRef<ShaderProgramInfo | null>(null);
  const bufferInfoRef = useRef<{ position: WebGLBuffer } | null>(null);
  const fbosRef = useRef<[FramebufferObj, FramebufferObj] | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // --- LOGIC ---

  const updateParam = (key: keyof PresetParams, val: number) => {
      setTargetParams(prev => ({ ...prev, [key]: val }));
      setActivePreset("CUSTOM");
  };

  const loadPreset = useCallback((preset: Preset) => {
    setActivePreset(preset.name);
    setTargetParams({ ...preset.params });
  }, []);

  const randomize = () => {
      const rand = (min: number, max: number) => Math.random() * (max - min) + min;
      const newParams: PresetParams = {
          feedback: rand(0.8, 0.99),
          speed: rand(0.1, 4.0),
          zoom: rand(0.5, 3.0),
          complexity: rand(0.0, 2.0),
          distortAmp: rand(0.0, 0.2),
          distortFreq: rand(0.0, 0.2),
          colorShift: rand(0.0, 6.28),
          rgbSplit: rand(0.0, 2.0),
          brightness: rand(0.5, 2.0)
      };
      setTargetParams(newParams);
      setActivePreset("RANDOM");
  };

  const toggleAudio = async () => {
    if (!audioEnabled) {
      const success = await audioEngine.current.init();
      if (success) setAudioEnabled(true);
    } else {
      audioEngine.current.cleanup();
      setAudioEnabled(false);
    }
  };

  const toggleRecording = () => {
      if(isRecording) {
          recorder.current.stop();
          setIsRecording(false);
      } else {
          if(canvasRef.current) {
            recorder.current.start(canvasRef.current);
            setIsRecording(true);
          }
      }
  };

  // --- WebGL Setup (Boilerplate condensed) ---

  const deleteFramebufferObj = (gl: WebGL2RenderingContext, fbo: FramebufferObj) => {
      gl.deleteTexture(fbo.texture);
      gl.deleteFramebuffer(fbo.fb);
  };

  const cleanupWebGL = useCallback(() => {
    const gl = glRef.current;
    if (!gl) return;
    if (programInfoRef.current?.program) gl.deleteProgram(programInfoRef.current.program);
    if (bufferInfoRef.current?.position) gl.deleteBuffer(bufferInfoRef.current.position);
    if (fbosRef.current) {
        deleteFramebufferObj(gl, fbosRef.current[0]);
        deleteFramebufferObj(gl, fbosRef.current[1]);
        fbosRef.current = null;
    }
    glRef.current = null;
  }, []);

  const compileShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const createFramebuffer = (gl: WebGL2RenderingContext, width: number, height: number): FramebufferObj | null => {
    const texture = gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const ext = gl.getExtension('EXT_color_buffer_float');
    // Mobile WebGL often needs HALF_FLOAT for performance/compatibility
    const internalFormat = ext ? gl.RGBA16F : gl.RGBA; 
    const type = ext ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fb = gl.createFramebuffer();
    if (!fb) return null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return { texture, fb };
  };

  const resizeBuffers = (gl: WebGL2RenderingContext) => {
     const width = gl.canvas.width;
     const height = gl.canvas.height;
     if (fbosRef.current) {
         deleteFramebufferObj(gl, fbosRef.current[0]);
         deleteFramebufferObj(gl, fbosRef.current[1]);
     }
     const fb1 = createFramebuffer(gl, width, height);
     const fb2 = createFramebuffer(gl, width, height);
     if (fb1 && fb2) fbosRef.current = [fb1, fb2];
  };

  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { 
        antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" 
    });
    if (!gl) { alert('WebGL2 not supported'); return; }
    glRef.current = gl;
    gl.getExtension('EXT_color_buffer_float');

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    programInfoRef.current = {
      program: program,
      attribLocations: { position: gl.getAttribLocation(program, 'position') },
      uniformLocations: {
        iResolution: gl.getUniformLocation(program, 'iResolution'),
        iTime: gl.getUniformLocation(program, 'iTime'),
        iChannel0: gl.getUniformLocation(program, 'iChannel0'),
        iMouse: gl.getUniformLocation(program, 'iMouse'),
        iFeedback: gl.getUniformLocation(program, 'iFeedback'),
        iSpeed: gl.getUniformLocation(program, 'iSpeed'),
        iZoom: gl.getUniformLocation(program, 'iZoom'),
        iColorShift: gl.getUniformLocation(program, 'iColorShift'),
        iDistortAmp: gl.getUniformLocation(program, 'iDistortAmp'),
        iDistortFreq: gl.getUniformLocation(program, 'iDistortFreq'),
        iRGBSplit: gl.getUniformLocation(program, 'iRGBSplit'),
        iComplexity: gl.getUniformLocation(program, 'iComplexity'),
        iBrightness: gl.getUniformLocation(program, 'iBrightness'),
        iAudioLow: gl.getUniformLocation(program, 'iAudioLow'),
        iAudioMid: gl.getUniformLocation(program, 'iAudioMid'),
        iAudioHigh: gl.getUniformLocation(program, 'iAudioHigh'),
        iAudioLevel: gl.getUniformLocation(program, 'iAudioLevel'),
      },
    };

    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    if (positionBuffer) bufferInfoRef.current = { position: positionBuffer };

    resizeBuffers(gl);
  }, [cleanupWebGL]);

  // --- RENDER LOOP ---

  const drawWaveform = (data: Uint8Array) => {
      const c = waveformCanvasRef.current;
      if(!c) return;
      const ctx = c.getContext('2d');
      if(!ctx) return;

      const w = c.width;
      const h = c.height;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00ff00';
      ctx.beginPath();
      
      const sliceWidth = w * 1.0 / data.length;
      let x = 0;
      
      for(let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0;
          const y = v * h/2;
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
      }
      ctx.stroke();
  };

  const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

  const render = useCallback((time: number) => {
    if (!isRunning) {
        requestRef.current = requestAnimationFrame(render);
        return;
    }

    // 1. Audio Processing
    let audioData = { low: 0, mid: 0, high: 0, level: 0 };
    if (audioEnabled) {
        const fullData = audioEngine.current.getFrequencyData(audioSensitivity, audioSmoothing);
        audioData = fullData;
        drawWaveform(audioEngine.current.getTimeDomainData());
    }

    timeRef.current = time * 0.001;
    const deltaTime = time - lastTimeRef.current;
    
    if (deltaTime >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / deltaTime));
      frameCountRef.current = 0;
      lastTimeRef.current = time;
    }
    frameCountRef.current++;

    const gl = glRef.current;
    const programInfo = programInfoRef.current;
    const bufferInfo = bufferInfoRef.current;
    const fbos = fbosRef.current;

    if (!gl || !programInfo || !bufferInfo || !fbos) {
      requestRef.current = requestAnimationFrame(render);
      return;
    }

    // 2. LERP Parameters
    const cur = currentParams.current;
    const tgt = targetParams; // captured from closure, needs to be fresh? Use state directly in render loop works if render is recreated or via ref.
    // Actually, since render is in useCallback with dependency on targetParams (which we shouldn't do for perf), 
    // we should use a ref for targetParams too or accept that we are using state inside the loop via closure update?
    // Best practice: Use Refs for the loop variables.
    // However, to simplify, let's just use the fact that setTargetParams triggers re-render of component, 
    // but requestAnimationFrame is running independently. 
    // WE NEED A REF FOR TARGET PARAMS to access inside the loop without recreating the function.
    
    // Correction: I will trust the closure or Ref method. Let's use a Ref to sync state to loop.
    
    const { program, attribLocations, uniformLocations } = programInfo;
    
    // Resize check
    const canvas = gl.canvas as HTMLCanvasElement;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
       canvas.width = displayWidth;
       canvas.height = displayHeight;
       resizeBuffers(gl);
       if (!fbosRef.current) return; 
    }
    
    const [read, write] = fbosRef.current!;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.position);
    gl.vertexAttribPointer(attribLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribLocations.position);

    // Apply Lerp
    cur.feedback += (targetParamRef.current.feedback - cur.feedback) * LERP_FACTOR;
    cur.speed += (targetParamRef.current.speed - cur.speed) * LERP_FACTOR;
    cur.zoom += (targetParamRef.current.zoom - cur.zoom) * LERP_FACTOR;
    cur.complexity += (targetParamRef.current.complexity - cur.complexity) * LERP_FACTOR;
    cur.distortAmp += (targetParamRef.current.distortAmp - cur.distortAmp) * LERP_FACTOR;
    cur.distortFreq += (targetParamRef.current.distortFreq - cur.distortFreq) * LERP_FACTOR;
    cur.colorShift += (targetParamRef.current.colorShift - cur.colorShift) * LERP_FACTOR;
    cur.rgbSplit += (targetParamRef.current.rgbSplit - cur.rgbSplit) * LERP_FACTOR;
    cur.brightness += (targetParamRef.current.brightness - cur.brightness) * LERP_FACTOR;

    // Update Uniforms
    gl.uniform2f(uniformLocations.iResolution, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(uniformLocations.iTime, timeRef.current);
    gl.uniform2f(uniformLocations.iMouse, mouseRef.current.x, mouseRef.current.y); 
    
    gl.uniform1f(uniformLocations.iFeedback, cur.feedback);
    gl.uniform1f(uniformLocations.iSpeed, cur.speed);
    gl.uniform1f(uniformLocations.iZoom, cur.zoom);
    gl.uniform1f(uniformLocations.iColorShift, cur.colorShift);
    gl.uniform1f(uniformLocations.iDistortAmp, cur.distortAmp);
    gl.uniform1f(uniformLocations.iDistortFreq, cur.distortFreq);
    gl.uniform1f(uniformLocations.iRGBSplit, cur.rgbSplit);
    gl.uniform1f(uniformLocations.iComplexity, cur.complexity);
    gl.uniform1f(uniformLocations.iBrightness, cur.brightness);

    // Audio Uniforms
    gl.uniform1f(uniformLocations.iAudioLow, audioData.low);
    gl.uniform1f(uniformLocations.iAudioMid, audioData.mid);
    gl.uniform1f(uniformLocations.iAudioHigh, audioData.high);
    gl.uniform1f(uniformLocations.iAudioLevel, audioData.level);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform1i(uniformLocations.iChannel0, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, write.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, gl.canvas.width, gl.canvas.height, 0, 0, gl.canvas.width, gl.canvas.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);

    fbosRef.current = [write, read];
    requestRef.current = requestAnimationFrame(render);
  }, [isRunning, audioEnabled, audioSensitivity, audioSmoothing]);

  // Sync state to Ref for Render Loop
  const targetParamRef = useRef(targetParams);
  useEffect(() => { targetParamRef.current = targetParams; }, [targetParams]);

  useEffect(() => {
    initWebGL();
    requestRef.current = requestAnimationFrame(render);
    return () => {
        cancelAnimationFrame(requestRef.current);
        cleanupWebGL();
        audioEngine.current.cleanup();
        recorder.current.stop();
    };
  }, [initWebGL, cleanupWebGL, render]);

  // --- INPUT HANDLING ---

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || !isMouseDownRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouseRef.current = { x, y };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
          const rect = canvasRef.current!.getBoundingClientRect();
          touchStartX.current = e.touches[0].clientX;
          const x = (e.touches[0].clientX - rect.left) / rect.width;
          const y = (e.touches[0].clientY - rect.top) / rect.height;
          mouseRef.current = { x, y };
      } else if (e.touches.length === 2) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          touchStartDist.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          touchStartAngle.current = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
          touchStartZoom.current = targetParams.zoom;
          touchStartColor.current = targetParams.colorShift;
      }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
      if (!canvasRef.current) return;
      
      if (e.touches.length === 1) {
          const rect = canvasRef.current.getBoundingClientRect();
          const x = (e.touches[0].clientX - rect.left) / rect.width;
          const y = (e.touches[0].clientY - rect.top) / rect.height;
          mouseRef.current = { x, y };
      } 
      else if (e.touches.length === 2) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          
          // Pinch Zoom
          const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const scale = dist / touchStartDist.current;
          updateParam('zoom', Math.max(0.1, Math.min(5.0, touchStartZoom.current / scale)));
          
          // Rotate Color
          const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
          const rotation = angle - touchStartAngle.current;
          updateParam('colorShift', (touchStartColor.current + rotation * 2) % 6.28);
      }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      // Swipe detection for presets
      if(e.changedTouches.length === 1) {
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if(Math.abs(dx) > 100) {
              const currentIdx = PRESETS.findIndex(p => p.name === activePreset);
              if (currentIdx === -1) {
                  loadPreset(PRESETS[0]);
              } else {
                  const dir = dx > 0 ? -1 : 1;
                  const nextIdx = (currentIdx + dir + PRESETS.length) % PRESETS.length;
                  loadPreset(PRESETS[nextIdx]);
              }
          }
      }
  };

  const takeScreenshot = () => {
      if(!canvasRef.current) return;
      const link = document.createElement('a');
      link.download = `OMNI-FLUX_${Date.now()}.png`;
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
  };

  const resetParams = () => {
     loadPreset(PRESETS[0]);
     mouseRef.current = {x: 0.5, y: 0.5};
     const gl = glRef.current;
     if(gl) resizeBuffers(gl);
  };

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
          if (e.code === 'Space') setIsRunning(r => !r);
          if (e.key === 'r' || e.key === 'R') resetParams();
          if (e.key === 's' || e.key === 'S') takeScreenshot();
          if (e.key === 'h' || e.key === 'H') setShowUI(h => !h);
          if (e.key === 'm' || e.key === 'M') toggleAudio();
          if (e.key === 'v' || e.key === 'V') toggleRecording();
          if (e.key === 'ArrowRight') {
              const idx = PRESETS.findIndex(p => p.name === activePreset);
              loadPreset(PRESETS[(idx + 1) % PRESETS.length]);
          }
          if (e.key === 'ArrowLeft') {
              const idx = PRESETS.findIndex(p => p.name === activePreset);
              loadPreset(PRESETS[(idx - 1 + PRESETS.length) % PRESETS.length]);
          }
          if (['1','2','3','4','5','6','7','8','9','0'].includes(e.key)) {
              const idx = parseInt(e.key === '0' ? '9' : String(parseInt(e.key) - 1));
              if(PRESETS[idx]) loadPreset(PRESETS[idx]);
          }
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
  }, [activePreset, loadPreset]); // dependencies

  // --- UI CONFIG ---
  
  const controlGroups: ControlGroup[] = [
      {
          title: "Simulation",
          items: [
            { label: "Feedback", value: targetParams.feedback, setValue: (v) => updateParam('feedback', v), min: 0.60, max: 0.995, step: 0.001, color: "fuchsia" },
            { label: "Speed", value: targetParams.speed, setValue: (v) => updateParam('speed', v), min: 0.0, max: 5.0, step: 0.01, color: "cyan" }
          ]
      },
      {
          title: "Geometry",
          items: [
            { label: "Zoom", value: targetParams.zoom, setValue: (v) => updateParam('zoom', v), min: 0.1, max: 5.0, step: 0.01, color: "yellow" },
            { label: "Complexity", value: targetParams.complexity, setValue: (v) => updateParam('complexity', v), min: 0.0, max: 2.0, step: 0.01, color: "orange" }
          ]
      },
      {
          title: "Optics",
          items: [
            { label: "Distort Amt", value: targetParams.distortAmp, setValue: (v) => updateParam('distortAmp', v), min: 0.0, max: 0.3, step: 0.001, color: "red" },
            { label: "Distort Freq", value: targetParams.distortFreq, setValue: (v) => updateParam('distortFreq', v), min: 0.0, max: 0.3, step: 0.001, color: "pink" }
          ]
      },
      {
          title: "Color / Post",
          items: [
            { label: "Color Shift", value: targetParams.colorShift, setValue: (v) => updateParam('colorShift', v), min: 0.0, max: 6.28, step: 0.01, color: "emerald" },
            { label: "RGB Split", value: targetParams.rgbSplit, setValue: (v) => updateParam('rgbSplit', v), min: 0.0, max: 3.0, step: 0.01, color: "blue" },
            { label: "Brightness", value: targetParams.brightness, setValue: (v) => updateParam('brightness', v), min: 0.1, max: 3.0, step: 0.01, color: "white" }
          ]
      }
  ];

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden group select-none font-sans">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block cursor-crosshair touch-none"
        onMouseMove={handleMouseMove}
        onMouseDown={(e) => { isMouseDownRef.current = true; handleMouseMove(e); }}
        onMouseUp={() => { isMouseDownRef.current = false; }}
        onMouseLeave={() => { isMouseDownRef.current = false; }}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />
      
      {/* HEADER */}
      <div 
        className={`absolute top-6 left-6 p-0 transition-all duration-500 pointer-events-none z-10 ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
      >
        <h1 className="text-white text-5xl font-black tracking-tighter mb-1 font-mono italic mix-blend-difference">
          OMNI<span className="text-fuchsia-500">-</span>FLUX
        </h1>
        <div className="h-1 w-full bg-gradient-to-r from-fuchsia-500 via-cyan-500 to-transparent mb-4"></div>
      </div>

      {/* DASHBOARD */}
      <div 
        className={`absolute top-28 left-6 w-80 max-h-[calc(100vh-160px)] overflow-y-auto overflow-x-hidden transition-all duration-500 z-10 scrollbar-hide
        ${showUI ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}
      >
        <div className="flex flex-col gap-2 pointer-events-auto pb-4">
           
           {/* MASTER PROMPTS (PRESETS) */}
           <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-lg overflow-hidden p-3 mb-2 shadow-lg shadow-fuchsia-500/10">
              <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-2">
                 <div className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Master Prompts</div>
                 <button onClick={randomize} className="text-[9px] bg-white/10 px-2 py-0.5 rounded text-fuchsia-400 hover:text-white">RND</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map(preset => (
                      <button 
                        key={preset.name}
                        onClick={() => loadPreset(preset)}
                        className={`text-[9px] font-bold py-2 px-1 rounded border transition-all duration-300 uppercase tracking-wider
                        ${activePreset === preset.name 
                            ? 'bg-fuchsia-600 text-white border-fuchsia-500 shadow-[0_0_10px_rgba(255,0,255,0.4)]' 
                            : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/20'}`}
                      >
                          {preset.name}
                      </button>
                  ))}
              </div>
           </div>

           {/* AUDIO SYSTEM */}
           <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden transition-all">
                <button 
                     onClick={() => setActiveSection(activeSection === "AUDIO_SYS" ? null : "AUDIO_SYS")}
                     className="w-full px-4 py-3 flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                    <span className={audioEnabled ? "text-green-400" : ""}>AUDIO_SYS {audioEnabled ? "[ON]" : "[OFF]"}</span>
                    <span className={`transform transition-transform ${activeSection === "AUDIO_SYS" ? 'rotate-180' : ''}`}>▼</span>
                </button>
                <div className={`px-4 space-y-3 transition-all duration-300 ease-in-out ${activeSection === "AUDIO_SYS" ? 'py-4 max-h-48 opacity-100' : 'max-h-0 py-0 opacity-0 overflow-hidden'}`}>
                    <button onClick={toggleAudio} className={`w-full py-1 text-[10px] border font-mono ${audioEnabled ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-red-500/50 text-red-500'}`}>
                        {audioEnabled ? "MIC INPUT ACTIVE" : "ENABLE MIC INPUT"}
                    </button>
                    {audioEnabled && (
                        <>
                           <div>
                               <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                                   <span>Sensitivity</span>
                                   <span>{audioSensitivity.toFixed(1)}</span>
                               </div>
                               <input type="range" min="0.1" max="10.0" step="0.1" value={audioSensitivity} onChange={e => setAudioSensitivity(parseFloat(e.target.value))} className="w-full h-1 bg-gray-800 rounded accent-green-500" />
                           </div>
                           <div>
                               <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                                   <span>Smoothing</span>
                                   <span>{audioSmoothing.toFixed(2)}</span>
                               </div>
                               <input type="range" min="0.0" max="0.99" step="0.01" value={audioSmoothing} onChange={e => setAudioSmoothing(parseFloat(e.target.value))} className="w-full h-1 bg-gray-800 rounded accent-green-500" />
                           </div>
                        </>
                    )}
                </div>
           </div>

           {/* CONTROLS */}
           {controlGroups.map((group) => (
               <div key={group.title} className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden transition-all">
                   <button 
                     onClick={() => setActiveSection(activeSection === group.title ? null : group.title)}
                     className="w-full px-4 py-3 flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                   >
                       {group.title}
                       <span className={`transform transition-transform ${activeSection === group.title ? 'rotate-180' : ''}`}>▼</span>
                   </button>
                   
                   <div className={`px-4 space-y-4 transition-all duration-300 ease-in-out ${activeSection === group.title ? 'py-4 max-h-96 opacity-100' : 'max-h-0 py-0 opacity-0 overflow-hidden'}`}>
                       {group.items.map((item) => (
                           <div key={item.label}>
                               <div className="flex justify-between text-[10px] uppercase font-mono mb-1 text-gray-400">
                                   <span>{item.label}</span>
                                   <span className={`text-${item.color}-400`}>{item.value.toFixed(3)}</span>
                               </div>
                               <input 
                                    type="range" 
                                    min={item.min} max={item.max} step={item.step}
                                    value={item.value}
                                    onChange={(e) => item.setValue(parseFloat(e.target.value))}
                                    className={`w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-${item.color}-500 hover:accent-${item.color}-400 transition-all`}
                               />
                           </div>
                       ))}
                   </div>
               </div>
           ))}
           
           <div className="bg-black/70 backdrop-blur-md border border-white/5 rounded px-3 py-2 flex items-center justify-between text-[10px] font-mono text-gray-500 relative overflow-hidden">
               <div className="z-10 flex gap-4">
                  <span>GPU_THREAD::{fps}</span>
                  {audioEnabled && <span className="text-green-500 animate-pulse">MIC_ON</span>}
               </div>
               {/* Mini Waveform */}
               <canvas ref={waveformCanvasRef} width={100} height={20} className="opacity-50" />
           </div>
        </div>
      </div>

      {/* FOOTER CONTROLS */}
      <div className="absolute bottom-0 left-0 w-full p-6 flex justify-between items-end pointer-events-none z-20 bg-gradient-to-t from-black/90 to-transparent">
          <div className="flex gap-2 pointer-events-auto items-center">
            <button onClick={() => setIsRunning(!isRunning)} className="btn-primary bg-white text-black hover:bg-gray-200">
                {isRunning ? 'HALT' : 'EXECUTE'}
            </button>
            <button onClick={resetParams} className="btn-secondary text-red-500 border-red-500/30 hover:bg-red-500/10 hover:border-red-500">
                RESET
            </button>
            <button onClick={takeScreenshot} className="btn-secondary text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-500">
                CAP
            </button>
            <button 
                onClick={toggleRecording} 
                className={`btn-secondary border-red-500/30 hover:bg-red-900/20 relative ${isRecording ? 'text-red-500 border-red-500 bg-red-900/20' : 'text-gray-400'}`}
            >
                {isRecording && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
                {isRecording ? 'STOP_REC' : 'REC_VIDEO'}
            </button>
        </div>
        
        <button 
           onClick={() => setShowUI(!showUI)}
           className="pointer-events-auto text-[10px] font-mono uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
        >
          {showUI ? '[ HIDE_HUD ]' : '[ SHOW_HUD ]'}
        </button>
      </div>
      
      <style>{`
        .btn-primary {
            @apply font-mono text-xs font-bold px-5 py-3 rounded-sm uppercase tracking-wider transition-all duration-200;
        }
        .btn-secondary {
            @apply font-mono text-xs font-bold px-4 py-3 rounded-sm border bg-black/50 backdrop-blur-sm uppercase tracking-wider transition-all duration-200;
        }
        /* Custom scrollbar hiding */
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default Visualizer;