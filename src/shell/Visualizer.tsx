/*
 * GEISS CORNER — a Winamp-style feedback visualizer docked in the sidebar.
 * Classic recipe: each frame the previous frame is resampled through an
 * audio-reactive warp field (zoom, swirl, ripple), slightly blurred, dimmed
 * and hue-drifted, then the live waveform from the master-bus analyser is
 * burned on top. The trails do the rest. All GPU: two ping-pong textures at
 * a fixed 320² and three tiny shaders — the CPU touches audio twice a frame.
 *
 * Purely visual: it consumes the engine's shared analyser and affects
 * nothing musical, so none of its state serializes. Click cycles the warp.
 */

import { useEffect, useRef, type JSX } from 'react';
import { readPalette } from '@/labs/shared/stage';

const RES = 320;
const WAVE_POINTS = 256;
const PRESETS = 4;

const QUAD_VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const WARP_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreb;
uniform float uPreset;

void main() {
  vec2 p = vUv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  float zoom;
  float swirl;
  vec2 drift = vec2(0.0);
  if (uPreset < 0.5) {
    /* Smoke: slow outward bloom, breathing swirl. */
    zoom = 1.0 - (0.006 + 0.020 * uBass);
    swirl = 0.35 * sin(uTime * 0.13) + 0.6 * uMid * r;
  } else if (uPreset < 1.5) {
    /* Whirlpool: everything spirals down the drain. */
    zoom = 1.0 + (0.008 + 0.018 * uBass);
    swirl = -0.9 * r - 0.25 * uMid;
  } else if (uPreset < 2.5) {
    /* Tunnel: hard outward rush with a steady roll. */
    zoom = 1.0 - (0.013 + 0.030 * uBass);
    swirl = 0.25 + 0.2 * sin(uTime * 0.07);
  } else {
    /* Banner: sideways wind and a treble shimmer. */
    zoom = 1.0 - 0.004;
    swirl = 0.5 * sin(a * 3.0 + uTime * 0.21) * r;
    drift = vec2(0.0045 * sin(uTime * 0.17) + 0.003, 0.006 * uMid);
  }
  a += swirl * 0.06;
  vec2 q = vec2(cos(a), sin(a)) * r * zoom + 0.5 + drift;
  q += 0.0015 * vec2(sin(q.y * 40.0 + uTime * 0.9), cos(q.x * 40.0 - uTime * 0.8)) * (0.3 + uTreb);
  float e = 1.0 / ${RES}.0;
  vec3 c = texture2D(uTex, q).rgb * 0.2
    + texture2D(uTex, q + vec2(e, 0.0)).rgb * 0.2
    + texture2D(uTex, q - vec2(e, 0.0)).rgb * 0.2
    + texture2D(uTex, q + vec2(0.0, e)).rgb * 0.2
    + texture2D(uTex, q - vec2(0.0, e)).rgb * 0.2;
  c *= 0.965 + 0.022 * uBass;
  c = mix(c, c.gbr, 0.02);
  c -= 0.0025;
  gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
}`;

const WAVE_VS = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const WAVE_FS = `
precision mediump float;
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
}`;

const SHOW_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
void main() {
  gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function program(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  return prog;
}

function makeTarget(gl: WebGLRenderingContext): { tex: WebGLTexture; fbo: WebGLFramebuffer } {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, RES, RES, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo };
}

/** '#rrggbb' → [r, g, b] in 0..1; anything else falls back. */
function rgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function Visualizer({ analyser }: { analyser: AnalyserNode | null }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(analyser);
  analyserRef.current = analyser;
  const presetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = RES;
    canvas.height = RES;
    /* preserveDrawingBuffer keeps screenshots honest — at 320² the extra
       copy is nothing, and people screenshot their workbench. */
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return; /* No WebGL: the square stays a quiet bevel. */

    const warp = program(gl, QUAD_VS, WARP_FS);
    const wave = program(gl, WAVE_VS, WAVE_FS);
    const show = program(gl, QUAD_VS, SHOW_FS);

    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const waveBuf = gl.createBuffer()!;

    let targets = [makeTarget(gl), makeTarget(gl)];

    const uWarp = {
      tex: gl.getUniformLocation(warp, 'uTex'),
      time: gl.getUniformLocation(warp, 'uTime'),
      bass: gl.getUniformLocation(warp, 'uBass'),
      mid: gl.getUniformLocation(warp, 'uMid'),
      treb: gl.getUniformLocation(warp, 'uTreb'),
      preset: gl.getUniformLocation(warp, 'uPreset'),
    };
    const uWaveColor = gl.getUniformLocation(wave, 'uColor');
    const uShowTex = gl.getUniformLocation(show, 'uTex');
    const aWarpPos = gl.getAttribLocation(warp, 'aPos');
    const aWavePos = gl.getAttribLocation(wave, 'aPos');
    const aShowPos = gl.getAttribLocation(show, 'aPos');

    const freq = new Uint8Array(1024);
    const time = new Float32Array(2048);
    const wavePts = new Float32Array(WAVE_POINTS * 2);
    let bass = 0;
    let mid = 0;
    let treb = 0;

    let palette = readPalette(canvas);
    let waveRgb = rgb(palette.accent2, [0.44, 0.72, 0.88]);
    const chromeObserver = new MutationObserver(() => {
      palette = readPalette(canvas);
      waveRgb = rgb(palette.accent2, [0.44, 0.72, 0.88]);
    });
    chromeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-chrome'],
    });

    const band = (lo: number, hi: number): number => {
      let sum = 0;
      for (let i = lo; i < hi; i++) sum += freq[i];
      return sum / ((hi - lo) * 255);
    };

    let frame = 0;
    let quietFrames = 0;
    const t0 = performance.now();
    const loop = (): void => {
      frame = requestAnimationFrame(loop);
      const an = analyserRef.current;
      /* Before audio ever starts there is nothing to draw: once the trails
         have long since faded to black, skip the GPU entirely. */
      if (!an) {
        quietFrames += 1;
        if (quietFrames > 240) return;
      } else {
        quietFrames = 0;
      }
      const now = (performance.now() - t0) / 1000;
      if (an) {
        an.getByteFrequencyData(freq);
        an.getFloatTimeDomainData(time);
        /* Smoothed band energies so the warp breathes instead of twitching. */
        bass += (band(1, 24) - bass) * 0.25;
        mid += (band(24, 180) - mid) * 0.25;
        treb += (band(180, 720) - treb) * 0.25;
      } else {
        bass *= 0.95;
        mid *= 0.95;
        treb *= 0.95;
      }

      const [read, write] = targets;

      /* 1. Warp the previous frame into the write target. */
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
      gl.viewport(0, 0, RES, RES);
      gl.disable(gl.BLEND);
      gl.useProgram(warp);
      gl.bindTexture(gl.TEXTURE_2D, read.tex);
      gl.uniform1i(uWarp.tex, 0);
      gl.uniform1f(uWarp.time, now);
      gl.uniform1f(uWarp.bass, bass);
      gl.uniform1f(uWarp.mid, mid);
      gl.uniform1f(uWarp.treb, treb);
      gl.uniform1f(uWarp.preset, presetRef.current);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(aWarpPos);
      gl.vertexAttribPointer(aWarpPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      /* 2. Burn the waveform in, additive. */
      if (an) {
        const stride = time.length / WAVE_POINTS;
        for (let i = 0; i < WAVE_POINTS; i++) {
          const v = time[Math.floor(i * stride)];
          wavePts[i * 2] = (i / (WAVE_POINTS - 1)) * 1.9 - 0.95;
          wavePts[i * 2 + 1] = Math.max(-0.92, Math.min(0.92, v * 1.4));
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(wave);
        const [r, g, b] = waveRgb;
        const glow = 0.55 + treb * 0.45;
        gl.uniform3f(uWaveColor, r * glow, g * glow, b * glow);
        gl.bindBuffer(gl.ARRAY_BUFFER, waveBuf);
        gl.bufferData(gl.ARRAY_BUFFER, wavePts, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aWavePos);
        gl.vertexAttribPointer(aWavePos, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINE_STRIP, 0, WAVE_POINTS);
        gl.disable(gl.BLEND);
      }

      /* 3. Show it. */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, RES, RES);
      gl.useProgram(show);
      gl.bindTexture(gl.TEXTURE_2D, write.tex);
      gl.uniform1i(uShowTex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(aShowPos);
      gl.vertexAttribPointer(aShowPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      targets = [write, read];
    };
    frame = requestAnimationFrame(loop);

    return () => {
      /* No loseContext() here: under StrictMode the effect remounts onto
         the same canvas, and an explicitly lost context stays lost. The
         context is reclaimed with the canvas element itself. */
      cancelAnimationFrame(frame);
      chromeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="sb-viz"
      role="img"
      aria-label="Audio visualizer — click to change the warp"
      title="Click to change the warp"
      onClick={() => {
        presetRef.current = (presetRef.current + 1) % PRESETS;
      }}
    />
  );
}
