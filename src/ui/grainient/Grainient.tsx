// Grainient, de React Bits (https://reactbits.dev, licencia MIT), pasado a TypeScript.
// La lógica de dibujo es la original; solo se han añadido tipos.
import { useEffect, useRef, type CSSProperties, type HTMLAttributes } from 'react';
import { COMPOSITE, FIELD, VERTEX } from './shaders';
import './Grainient.css';

const MAX_COLORS = 8;
const MAX_STIRS = 24;
const MAX_TWIRLS = 4;
const STIR_LIFE = 1.3;
const STIR_STEP = 0.06;
const TWIRL_LIFE = 2.6;
const INTRO_SECONDS = 1.6;
const DEFAULT_COLORS = ['#120f17', '#2a0f0a', '#9a3412', '#f97316', '#fed7aa'];
const TYPES = { linear: 0, radial: 1 } as const;
const LIFT = 0.2;

type Uniforms = Record<string, WebGLUniformLocation | null>;
interface Programa {
  program: WebGLProgram;
  uniforms: Uniforms;
}
type Rgb = [number, number, number];

export interface GrainientProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'className'> {
  colors?: string[];
  type?: keyof typeof TYPES;
  angle?: number;
  bands?: number;
  speed?: number;
  flow?: number;
  scale?: number;
  softness?: number;
  silk?: number;
  grainAmount?: number;
  grainSize?: number;
  grainAnimated?: boolean;
  contrast?: number;
  saturation?: number;
  variation?: number;
  interactive?: boolean;
  stir?: number;
  clickSwirl?: boolean;
  intro?: boolean;
  lightMode?: boolean;
  dpr?: number;
  className?: string;
  style?: CSSProperties;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toLinear = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);

const toLab = ([r, g, b]: Rgb): Rgb => {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
};

const link = (gl: WebGL2RenderingContext, fragmentSource: string): Programa | null => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms: Uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
};

interface Muestra {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  grow: number;
  done: boolean;
}
interface Giro {
  x: number;
  y: number;
  age: number;
  direction: number;
}

export function Grainient({
  colors = DEFAULT_COLORS,
  type = 'linear',
  angle = 55,
  bands = 1,
  speed = 1,
  flow = 0.8,
  scale = 1,
  softness = 1,
  silk = 0.35,
  grainAmount = 0.08,
  grainSize = 1.2,
  grainAnimated = true,
  contrast = 1,
  saturation = 1,
  variation = 0,
  interactive = true,
  stir = 1,
  clickSwirl = true,
  intro = true,
  lightMode = false,
  dpr,
  className = '',
  style,
  ...rest
}: GrainientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const palette = (Array.isArray(colors) && colors.length ? colors : DEFAULT_COLORS).slice(0, MAX_COLORS);
  const settings = {
    colors: palette.length > 1 ? palette : [palette[0], palette[0]],
    type: TYPES[type] ?? 0,
    angle,
    bands: clamp(bands, 1, 8),
    speed: Math.max(0, speed),
    flow: clamp(flow, 0, 3),
    scale: clamp(scale, 0.25, 3),
    softness: clamp(softness, 0, 1),
    silk: clamp(silk, 0, 1),
    grainAmount: clamp(grainAmount, 0, 0.5),
    grainSize: clamp(grainSize, 0.5, 4),
    grainAnimated,
    contrast: clamp(contrast, 0.2, 2),
    saturation: clamp(saturation, 0, 2),
    variation: Math.max(0, variation),
    interactive,
    stir: clamp(stir, 0, 2),
    clickSwirl,
    intro,
    lightMode,
    dpr,
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!container || !canvas || !gl) return undefined;

    const field = link(gl, FIELD);
    const composite = link(gl, COMPOSITE);
    if (!field || !composite) return undefined;
    const fu = field.uniforms;
    const cu = composite.uniforms;
    const vao = gl.createVertexArray();
    const target = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const buffer = gl.createFramebuffer();
    const fieldSize = { width: 0, height: 0 };

    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const colorCache = new Map<string, Rgb>();
    const parse = (value: string): Rgb => {
      const key = String(value);
      const cached = colorCache.get(key);
      if (cached) return cached;
      let rgb: Rgb = [0, 0, 0];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = '#000000';
        probe.fillStyle = key;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
        rgb = [r / 255, g / 255, b / 255];
      }
      colorCache.set(key, rgb);
      return rgb;
    };

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const view = { width: 1, height: 1, ratio: 1 };
    const ramp = new Float32Array(MAX_COLORS * 3);
    const stirs = new Float32Array(MAX_STIRS * 4);
    const stirWeights = new Float32Array(MAX_STIRS);
    const twirls = new Float32Array(MAX_TWIRLS * 4);
    const trail: Muestra[] = [];
    const spins: Giro[] = [];
    const pointer = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, vx: 0, inside: false, fresh: true };
    let paletteKey = '';
    let time = 0;
    let introClock = settingsRef.current.intro && !reduce ? 0 : 1;
    let frameSeed = 0;
    let grainClock = 0;
    let raf = 0;
    let last = 0;
    let visible = true;

    const syncPalette = () => {
      const s = settingsRef.current;
      const key = `${s.colors.join(',')}|${s.lightMode}`;
      if (key === paletteKey) return;
      paletteKey = key;
      const labs = s.colors.map((color) => toLab(parse(color)));
      if (!s.lightMode) {
        labs.forEach((lab, i) => ramp.set(lab, i * 3));
      } else {
        const blank = labs.map(([L]) => Math.abs(L - labs[0][0]) < 0.1);
        const tints = labs.filter((_, i) => !blank[i]).reverse();
        labs.forEach((_, i) => {
          const [L, a, b] = blank[i] ? [1, 0, 0] : (tints.shift() as Rgb);
          ramp.set([L + (1 - L) * LIFT, a * (1 - LIFT), b * (1 - LIFT)], i * 3);
        });
      }
    };

    const draw = () => {
      const s = settingsRef.current;
      const aspect = view.width / view.height;
      syncPalette();
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
      gl.viewport(0, 0, fieldSize.width, fieldSize.height);
      gl.useProgram(field.program);
      gl.uniform1f(fu.uAspect, aspect);
      gl.uniform1f(fu.uTime, time);
      gl.uniform3fv(fu.uRamp, ramp);
      gl.uniform1i(fu.uCount, s.colors.length);
      const radians = (s.angle * Math.PI) / 180;
      gl.uniform1i(fu.uType, s.type);
      gl.uniform2f(fu.uDir, Math.sin(radians), Math.cos(radians));
      gl.uniform1f(fu.uExtent, aspect * Math.abs(Math.sin(radians)) + Math.abs(Math.cos(radians)));
      gl.uniform1f(fu.uBands, s.bands);
      gl.uniform1f(fu.uSoftness, s.softness);
      gl.uniform1f(fu.uFlow, s.flow);
      gl.uniform1f(fu.uScale, s.scale);
      gl.uniform1f(fu.uSilk, s.silk);
      gl.uniform4fv(fu.uStir, stirs);
      gl.uniform1fv(fu.uStirWeight, stirWeights);
      gl.uniform4fv(fu.uTwirl, twirls);
      gl.uniform2f(fu.uSeed, s.variation * 3.17, s.variation * 1.91);
      gl.uniform1f(fu.uContrast, s.contrast);
      gl.uniform1f(fu.uSaturation, s.saturation);
      gl.uniform1f(fu.uSettle, introClock * introClock * (3 - 2 * introClock));
      gl.uniform1f(fu.uReveal, introClock);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(composite.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.uniform1i(cu.uField, 0);
      gl.uniform1f(cu.uGrain, s.grainAmount);
      gl.uniform1f(cu.uGrainSize, s.grainSize * view.ratio);
      gl.uniform1f(cu.uFrame, frameSeed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const resize = () => {
      const s = settingsRef.current;
      view.width = Math.max(1, container.clientWidth);
      view.height = Math.max(1, container.clientHeight);
      view.ratio = Math.min(s.dpr || window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(view.width * view.ratio));
      canvas.height = Math.max(1, Math.round(view.height * view.ratio));
      const width = Math.max(1, Math.round(canvas.width / 2));
      const height = Math.max(1, Math.round(canvas.height / 2));
      if (width !== fieldSize.width || height !== fieldSize.height) {
        fieldSize.width = width;
        fieldSize.height = height;
        gl.bindTexture(gl.TEXTURE_2D, target);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      draw();
      wake();
    };

    const updateTouches = (dt: number, aspect: number) => {
      const s = settingsRef.current;
      const follow = 1 - Math.exp(-dt / 0.06);
      const px = pointer.sx;
      const py = pointer.sy;
      pointer.sx += (pointer.x - pointer.sx) * follow;
      pointer.sy += (pointer.y - pointer.sy) * follow;
      const vx = ((pointer.sx - px) / dt) * aspect;
      const vy = (pointer.sy - py) / dt;
      pointer.vx = vx;
      const head = trail[0];
      trail.forEach((sample) => {
        if (sample.done) sample.age += dt;
      });
      if (s.interactive && pointer.inside && Math.hypot(vx, vy) > 0.02 && !reduce) {
        if (!head || head.done) {
          trail.unshift({ x: 0, y: 0, vx: 0, vy: 0, age: 0, grow: 0, done: false });
          if (trail.length > MAX_STIRS) trail.pop();
        }
        const live = trail[0];
        live.x = (pointer.sx - 0.5) * aspect;
        live.y = pointer.sy - 0.5;
        live.vx = vx;
        live.vy = vy;
        live.grow = Math.min(1, live.grow + dt / STIR_STEP);
        live.done = live.grow >= 1;
      } else if (head) {
        head.done = true;
      }
      while (trail.length && trail[trail.length - 1].age > STIR_LIFE) trail.pop();
      for (let i = 0; i < MAX_STIRS; i++) {
        const sample = trail[i];
        if (!sample) {
          stirWeights[i] = 0;
          continue;
        }
        const fade = 1 - sample.age / STIR_LIFE;
        const cap = Math.min(1, 2.2 / Math.max(Math.hypot(sample.vx, sample.vy), 0.001));
        stirs.set([sample.x, sample.y, sample.vx * cap, sample.vy * cap], i * 4);
        stirWeights[i] = fade * fade * sample.grow * s.stir * 0.05;
      }
      spins.forEach((spin) => {
        spin.age += dt;
      });
      while (spins.length && spins[spins.length - 1].age > TWIRL_LIFE) spins.pop();
      for (let i = 0; i < MAX_TWIRLS; i++) {
        const spin = spins[i];
        if (!spin) {
          twirls[i * 4 + 2] = 0;
          continue;
        }
        const k = spin.age / TWIRL_LIFE;
        const envelope = Math.min(1, spin.age / 0.18) * (1 - k) * (1 - k);
        twirls.set([spin.x, spin.y, spin.direction * 2.4 * envelope, 0.16 + 0.1 * Math.min(1, spin.age / 0.5)], i * 4);
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const s = settingsRef.current;
      const dt = last ? clamp((now - last) / 1000, 0.001, 0.05) : 1 / 60;
      last = now;
      if (!reduce) time += dt * s.speed * 0.16;
      if (introClock < 1) introClock = Math.min(1, introClock + dt / INTRO_SECONDS);
      grainClock += dt;
      if (s.grainAnimated && !reduce && grainClock > 1 / 24) {
        grainClock = 0;
        frameSeed = (frameSeed + 1) % 97;
      }
      updateTouches(dt, view.width / view.height);
      draw();
      const busy =
        (!reduce && (s.speed > 0 || s.grainAnimated)) || introClock < 1 || trail.length > 0 || spins.length > 0;
      if (busy) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    function wake() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    const locate = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = 1 - (event.clientY - rect.top) / Math.max(1, rect.height);
      pointer.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      pointer.x = x;
      pointer.y = y;
      if (pointer.fresh || !pointer.inside) {
        pointer.sx = x;
        pointer.sy = y;
        pointer.fresh = false;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      locate(event);
      if (pointer.inside || trail.length) wake();
    };

    const onPointerDown = (event: PointerEvent) => {
      locate(event);
      const s = settingsRef.current;
      if (!pointer.inside || !s.clickSwirl || reduce) return;
      spins.unshift({
        x: (pointer.x - 0.5) * (view.width / view.height),
        y: pointer.y - 0.5,
        age: 0,
        direction: pointer.vx < 0 ? 1 : -1,
      });
      if (spins.length > MAX_TWIRLS) spins.pop();
      wake();
    };

    const onPointerLeave = () => {
      pointer.inside = false;
    };

    const onVisibility = () => {
      last = 0;
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        last = 0;
        wake();
      }
    });
    intersection.observe(container);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    wakeRef.current = wake;

    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteTexture(target);
      gl.deleteFramebuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(field.program);
      gl.deleteProgram(composite.program);
      // El original fuerza aquí loseContext(); se omite porque en React StrictMode el efecto se
      // vuelve a montar sobre el mismo lienzo y el contexto perdido ya no se recupera.
    };
  }, []);

  useEffect(() => {
    wakeRef.current?.();
  });

  return (
    <div
      ref={containerRef}
      className={`grainient-container${className ? ` ${className}` : ''}`}
      style={style}
      {...rest}
    >
      <canvas ref={canvasRef} className="grainient-canvas" aria-hidden="true" />
    </div>
  );
}

export default Grainient;
