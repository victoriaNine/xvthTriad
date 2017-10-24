import { max } from 'lodash';
import Seriously from 'seriously';
import { TweenMax, RoughEase, Power0, SteppedEase, TimelineMax } from 'gsap';

import _$ from 'utils';
import Firefly from 'Modules/firefly';
import 'seriously/effects/seriously.noise';
import 'seriously/effects/seriously.vignette';
import 'seriously/sources/seriously.depth';
import 'seriously/sources/seriously.imagedata';
import 'seriously/effects/seriously.displacement';

const fireflySettings  = { fireflies: [], firefliesNb: 40 };
const flareSettings    = { opacity: 0 };
const noiseSettings    = { time: 1 };
const vignetteSettings = { amount: 1 };
const displaceSettings = { x: 0, y: 0 };

const bgImg = new Image();
const bgDepthMap = new Image();
const bgFlare = new Image();
let bgPattern = new Image();
let bgSettings;
let seriously;
let targetNode;
let reformatNode;
let noiseNode;
let vignetteNode;
let displaceNode;
let scaleNode;
let rAF;

function createCanvas (width, height) {
  const canvas  = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  return canvas;
}

class CanvasWebGL {
  constructor () {
    this.WIDTH = _$.ui.window.contentsWidth;
    this.HEIGHT = _$.ui.window.contentsHeight;

    this.canvas3d = document.querySelector("#canvas");
    this.canvas3d.width = this.WIDTH;
    this.canvas3d.height = this.HEIGHT;

    this.canvas2d         = createCanvas(this.WIDTH, this.HEIGHT);
    this.ctx2d            = this.canvas2d.getContext("2d");
    this.canvas2dDepthMap = createCanvas(this.WIDTH, this.HEIGHT);
    this.ctx2dDepthMap    = this.canvas2dDepthMap.getContext("2d");

    this.FX_LEVEL = 5;
    this.ADD_FX = false;
    this.initialized = false;

    Object.defineProperty(_$.state, "FX_LEVEL", {
      get: () => this.FX_LEVEL,
      set: (fxLevel) => { if (fxLevel >= 0 && fxLevel <= 5) { this.FX_LEVEL = fxLevel; } }
    });
  }

  init () {
    if (this.initialized) {
      _$.debug.warn("The canvas is already initialized.");
      return;
    }

    this.initialized = true;
    bgImg.src = require(`Assets/img/ui/bg.jpg`);
    bgDepthMap.src = require(`Assets/img/ui/bgDepthMap.png`);
    bgFlare.src = require(`Assets/img/ui/bgFlare.png`);
    bgPattern.onload = () => { bgPattern = this.ctx2d.createPattern(bgPattern, "repeat"); };
    bgPattern.src = require(`Assets/img/ui/bgPattern.png`);
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
      fireflySettings.fireflies[i] = new Firefly(this.canvas2d);
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

    targetNode          = seriously.target(this.canvas3d);
    targetNode.source   = scaleNode;

    _$.events.once("addFX", () => {
      this.ADD_FX = true;

      flareSettings.tween.play();
      vignetteSettings.tween.play();

      _$.utils.addEventListeners(window, "mousemove touchmove", (e) => {
        if (this.FX_LEVEL >= 3) {
          let pageX = e.pageX;
          let pageY = e.pageY;

          if (e.targetTouches && e.targetTouches.length === 1) {
            pageX = e.targetTouches[0].pageX;
            pageY = e.targetTouches[0].pageY;
          }

          const newMapScale = {
            x: 0.01 * pageX / this.WIDTH,
            y: -1 * (0.01 * pageY / this.HEIGHT)
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
      rAF = requestAnimationFrame(this.draw);
    });

    _$.events.on("resize", this.onResize);
    this.onResize();
  }

  scaleBG = () => {
    let ratio;

    bgSettings.ratioX = this.WIDTH / bgSettings.INITIAL_WIDTH;
    bgSettings.ratioY = this.HEIGHT / bgSettings.INITIAL_HEIGHT;

    ratio             = max([bgSettings.ratioX, bgSettings.ratioY]);
    bgSettings.x1     = bgSettings.INITIAL_X1 * ratio;
    bgSettings.x2     = bgSettings.INITIAL_X2 * ratio;
    bgSettings.y1     = bgSettings.INITIAL_Y1 * ratio;
    bgSettings.y2     = bgSettings.INITIAL_Y2 * ratio;
    bgSettings.width  = bgSettings.INITIAL_WIDTH * ratio;
    bgSettings.height = bgSettings.INITIAL_HEIGHT * ratio;

    bgSettings.flareX      = bgSettings.FLARE_INITIAL_X;
    bgSettings.flareY      = bgSettings.FLARE_INITIAL_Y;
    bgSettings.flareWidth  = bgSettings.FLARE_INITIAL_WIDTH;
    bgSettings.flareHeight = bgSettings.FLARE_INITIAL_HEIGHT;
  };

  draw = () => {
    this.ctx2d.clearRect(0, 0, this.WIDTH, this.HEIGHT);
    this.ctx2d.drawImage(
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

    if (this.ADD_FX && this.FX_LEVEL >= 4) {
      this.ctx2d.save();
      this.ctx2d.globalAlpha              = flareSettings.opacity;
      this.ctx2d.globalCompositeOperation = "color-dodge";
      this.ctx2d.drawImage(bgFlare, bgSettings.flareX, bgSettings.flareY, bgSettings.flareWidth, bgSettings.flareHeight);
      this.ctx2d.restore();
    }

    if (this.ADD_FX && this.FX_LEVEL === 5) {
      for (let i = 0, ii = fireflySettings.firefliesNb; i < ii; i++) {
        fireflySettings.fireflies[i].draw(rAF);
      }
    }

    if (this.FX_LEVEL >= 1) {
      this.ctx2d.save();
      this.ctx2d.globalAlpha = 0.03;
      this.ctx2d.fillStyle   = bgPattern;
      this.ctx2d.fillRect(0, 0, this.WIDTH, this.HEIGHT);
      this.ctx2d.restore();
    }

    if (this.FX_LEVEL >= 2) {
      if (reformatNode.source) {
        reformatNode.source.update();
      }

      noiseNode.time      = noiseSettings.time;
      if (this.ADD_FX) {
        vignetteNode.amount = vignetteSettings.amount;
      }
    }

    if (this.FX_LEVEL >= 3) {
      this.ctx2dDepthMap.clearRect(0, 0, this.WIDTH, this.HEIGHT);
      this.ctx2dDepthMap.clearRect(0, 0, this.WIDTH, this.HEIGHT);
      this.ctx2dDepthMap.drawImage(
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

      if (this.ADD_FX && displaceNode.map) {
        displaceNode.map.update();
      }
    }

    rAF = requestAnimationFrame(this.draw);
  };

  onResize = () => {
    this.WIDTH  = _$.ui.window.contentsWidth;
    this.HEIGHT = _$.ui.window.contentsHeight;

    targetNode.width  = reformatNode.width  = noiseNode.width  = vignetteNode.width  = this.WIDTH;
    targetNode.height = reformatNode.height = noiseNode.height = vignetteNode.height = this.HEIGHT;

    [this.canvas2d, this.canvas3d, this.canvas2dDepthMap].forEach((canvas) => {
      canvas.width = this.WIDTH;
      canvas.height = this.HEIGHT;
    });

    for (let i = 0, ii = fireflySettings.firefliesNb; i < ii; i++) {
      fireflySettings.fireflies[i].onResize({ drawAreaWidth: this.WIDTH, drawAreaHeight: this.HEIGHT });
    }

    if (reformatNode.source) { reformatNode.source.destroy(); }
    reformatNode.source = seriously.source(this.canvas2d);

    if (displaceNode.map) { displaceNode.map.destroy(); }
    displaceNode.map = seriously.source(this.canvas2dDepthMap);

    this.scaleBG();
  };
}

export default CanvasWebGL;
