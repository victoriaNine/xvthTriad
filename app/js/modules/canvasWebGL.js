import $ from 'jquery';
import { max } from 'lodash';
import Seriously from 'seriously';
import { TweenMax, RoughEase, Power0, SteppedEase, TimelineMax } from 'gsap';

import _$ from 'common';
import Firefly from 'Modules/firefly';
import 'seriously/effects/seriously.noise';
import 'seriously/effects/seriously.vignette';
import 'seriously/sources/seriously.depth';
import 'seriously/sources/seriously.imagedata';
import 'seriously/effects/seriously.displacement';

let FX_LEVEL         = 5;
let ADD_FX           = false;
let WIDTH            = document.body.offsetWidth;
let HEIGHT           = document.body.offsetHeight;

const canvas3d         = document.querySelector("#canvas");
const canvas2d         = createCanvas(WIDTH, HEIGHT);
const ctx2d            = canvas2d.getContext("2d");
const canvas2dDepthMap = createCanvas(WIDTH, HEIGHT);
const ctx2dDepthMap    = canvas2dDepthMap.getContext("2d");
const fireflySettings  = { fireflies: [], firefliesNb: 40 };
const flareSettings    = { opacity: 0 };
const noiseSettings    = { time: 1 };
const vignetteSettings = { amount: 1 };
const displaceSettings = { x: 0, y: 0 };

let bgImg;
let bgDepthMap;
let bgSettings;
let bgFlare;
let bgPattern;
let seriously;
let targetNode;
let reformatNode;
let noiseNode;
let vignetteNode;
let displaceNode;
let scaleNode;
let rAF;

Object.defineProperty(_$.state, "FX_LEVEL", {
  get: function get () { return FX_LEVEL; },
  set: function set (fxLevel) { if (fxLevel >= 0 && fxLevel <= 5) { FX_LEVEL = fxLevel; } }
});

class CanvasWebGL {
  constructor () {
    this.dom         = canvas3d;
    this.initialized = false;

    $(this.dom).attr({ width: WIDTH, height: HEIGHT });
  }

  init () {
    if (this.initialized) {
      _$.debug.warn("The canvas is already initialized.");
      return;
    }

    this.initialized = true;
    bgImg        = _$.assets.get("img.ui.bg");
    bgDepthMap   = _$.assets.get("img.ui.bgDepthMap");
    bgFlare      = _$.assets.get("img.ui.bgFlare");
    bgPattern    = ctx2d.createPattern(_$.assets.get("img.ui.bgPattern"), "repeat");
    bgSettings   = {
      INITIAL_X1: 161,
      INITIAL_X2: 2321,
      INITIAL_Y1: 68,
      INITIAL_Y2: 1283,

      FLARE_INITIAL_X: 1035,
      FLARE_INITIAL_Y: 440,
      FLARE_INITIAL_WIDTH: bgFlare.width,
      FLARE_INITIAL_HEIGHT: bgFlare.height
    };

    bgSettings.INITIAL_WIDTH  = bgSettings.INITIAL_X2 - bgSettings.INITIAL_X1;
    bgSettings.INITIAL_HEIGHT = bgSettings.INITIAL_Y2 - bgSettings.INITIAL_Y1;

    // Fireflies
    for (let i = 0, ii = fireflySettings.firefliesNb; i < ii; i++) {
      fireflySettings.fireflies[i] = new Firefly(canvas2d);
    }

    flareSettings.tween = new TimelineMax({ delay: 1, repeat: -1, paused:true });
    flareSettings.tween.to(flareSettings, 10, { opacity: 0.4, ease: RoughEase.ease.config({ template:  Power0.easeNone, strength: 0.25, points: 50, taper: "none", randomize: true, clamp: true }) });
    flareSettings.tween.to(flareSettings, 10, { opacity: 0.1, ease: RoughEase.ease.config({ template:  Power0.easeNone, strength: 0.25, points: 100, taper: "none", randomize: true, clamp: true }) });
    flareSettings.tween.to(flareSettings, 4, { opacity: 0.0, ease: RoughEase.ease.config({ template:  Power0.easeNone, strength: 0.25, points: 50, taper: "none", randomize: true, clamp: true }) });

    vignetteSettings.tween = new TimelineMax({ repeat: -1, paused:true });
    vignetteSettings.tween.to(vignetteSettings, 6, { amount: 1.77, ease: RoughEase.ease.config({ template:  Power0.easeNone, strength: 0.25, points: 50, taper: "none", randomize: true, clamp: true }) });
    vignetteSettings.tween.to(vignetteSettings, 6, { amount: 1, ease: RoughEase.ease.config({ template:  Power0.easeNone, strength: 0.25, points: 100, taper: "none", randomize: true, clamp: true }) });

    noiseSettings.tween = TweenMax.to(noiseSettings, 1, { time: 0.9, repeat: -1, yoyo: true, ease: SteppedEase.config(15) });

    seriously           = new Seriously();
    reformatNode        = seriously.transform("reformat");
    reformatNode.mode   = "none";

    noiseNode           = seriously.effect("noise");
    noiseNode.overlay   = true;
    noiseNode.amount    = 0.1;
    noiseNode.time      = noiseSettings.time;
    noiseNode.source    = reformatNode;

    vignetteNode        = seriously.effect("vignette");
    vignetteNode.amount = vignetteSettings.amount;
    vignetteNode.source = noiseNode;

    displaceNode          = seriously.effect("displacement");
    displaceNode.source   = vignetteNode;
    displaceNode.offset   = 0;
    displaceNode.mapScale = [displaceSettings.x, displaceSettings.y];

    scaleNode             = seriously.transform("2d");
    scaleNode.source      = displaceNode;
    scaleNode.scale(1.02);

    targetNode          = seriously.target(canvas3d);
    targetNode.source   = scaleNode;

    _$.events.once("addFX", () => {
      ADD_FX = true;

      flareSettings.tween.play();
      vignetteSettings.tween.play();

      $(window).on("mousemove", (e) => {
        if (FX_LEVEL >= 3) {
          const newMapScale = {
            x: 0.01 * e.pageX / WIDTH,
            y: -1 * (0.01 * e.pageY / HEIGHT)
          };

          TweenMax.to(displaceSettings, 0.3, {
            x        : newMapScale.x,
            y        : newMapScale.y,
            onUpdate : () => {
              displaceNode.mapScale = [displaceSettings.x, displaceSettings.y];
            }
          });
        }
      });

      seriously.go();
      rAF = requestAnimationFrame(draw);
    });

    _$.events.on("resize", onResize);
    onResize();
  }
}

function scaleBG () {
  let ratio;
  let appRatio;

  bgSettings.ratioX = WIDTH / bgSettings.INITIAL_WIDTH;
  bgSettings.ratioY = HEIGHT / bgSettings.INITIAL_HEIGHT;

  ratio             = max([bgSettings.ratioX, bgSettings.ratioY]);
  bgSettings.x1     = bgSettings.INITIAL_X1 * ratio;
  bgSettings.x2     = bgSettings.INITIAL_X2 * ratio;
  bgSettings.y1     = bgSettings.INITIAL_Y1 * ratio;
  bgSettings.y2     = bgSettings.INITIAL_Y2 * ratio;
  bgSettings.width  = bgSettings.INITIAL_WIDTH * ratio;
  bgSettings.height = bgSettings.INITIAL_HEIGHT * ratio;

  appRatio               = _$.utils.getAppSizeRatio() / _$.state.appScalar;
  bgSettings.flareX      = bgSettings.FLARE_INITIAL_X * appRatio;
  bgSettings.flareY      = bgSettings.FLARE_INITIAL_Y * appRatio;
  bgSettings.flareWidth  = bgSettings.FLARE_INITIAL_WIDTH * appRatio;
  bgSettings.flareHeight = bgSettings.FLARE_INITIAL_HEIGHT * appRatio;
}

function createCanvas (width, height) {
  const canvas  = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  return canvas;
}

function draw () {
  ctx2d.clearRect(0, 0, WIDTH, HEIGHT);
  ctx2d.drawImage(
    bgImg,
    bgSettings.INITIAL_X1,
    bgSettings.INITIAL_Y1,
    bgSettings.INITIAL_WIDTH,
    bgSettings.INITIAL_HEIGHT,
    0,
    0,
    bgSettings.width,
    bgSettings.height
  );

  if (ADD_FX && FX_LEVEL >= 4) {
    ctx2d.save();
    ctx2d.globalAlpha              = flareSettings.opacity;
    ctx2d.globalCompositeOperation = "color-dodge";
    ctx2d.drawImage(bgFlare, bgSettings.flareX, bgSettings.flareY, bgSettings.flareWidth, bgSettings.flareHeight);
    ctx2d.restore();
  }

  if (ADD_FX && FX_LEVEL === 5) {
    for (let i = 0, ii = fireflySettings.firefliesNb; i < ii; i++) {
      fireflySettings.fireflies[i].draw(rAF);
    }
  }

  if (FX_LEVEL >= 1) {
    ctx2d.save();
    ctx2d.globalAlpha = 0.03;
    ctx2d.fillStyle   = bgPattern;
    ctx2d.fillRect(0, 0, WIDTH, HEIGHT);
    ctx2d.restore();
  }

  if (FX_LEVEL >= 2) {
    if (reformatNode.source) {
      reformatNode.source.update();
    }

    noiseNode.time      = noiseSettings.time;
    if (ADD_FX) {
      vignetteNode.amount = vignetteSettings.amount;
    }
  }

  if (FX_LEVEL >= 3) {
    ctx2dDepthMap.clearRect(0, 0, WIDTH, HEIGHT);
    ctx2dDepthMap.clearRect(0, 0, WIDTH, HEIGHT);
    ctx2dDepthMap.drawImage(
      bgDepthMap,
      bgSettings.INITIAL_X1,
      bgSettings.INITIAL_Y1,
      bgSettings.INITIAL_WIDTH,
      bgSettings.INITIAL_HEIGHT,
      0,
      0,
      bgSettings.width,
      bgSettings.height
    );

    if (ADD_FX && displaceNode.map) {
      displaceNode.map.update();
    }
  }

  rAF = requestAnimationFrame(draw);
}

function onResize () {
  WIDTH             = document.body.offsetWidth;
  HEIGHT            = document.body.offsetHeight;
  targetNode.width  = reformatNode.width  = noiseNode.width  = vignetteNode.width  = WIDTH;
  targetNode.height = reformatNode.height = noiseNode.height = vignetteNode.height = HEIGHT;

  $([canvas2d, canvas3d, canvas2dDepthMap]).attr({ width: WIDTH, height: HEIGHT });

  for (let i = 0, ii = fireflySettings.firefliesNb; i < ii; i++) {
    fireflySettings.fireflies[i].onResize({ drawAreaWidth: WIDTH, drawAreaHeight: HEIGHT });
  }

  if (reformatNode.source) { reformatNode.source.destroy(); }
  reformatNode.source = seriously.source(canvas2d);

  if (displaceNode.map) { displaceNode.map.destroy(); }
  displaceNode.map = seriously.source(canvas2dDepthMap);

  scaleBG();
}

export default CanvasWebGL;
