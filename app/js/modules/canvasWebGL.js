define([
    "jquery",
    "underscore",
    "seriously",
    "global",
    "modules/firefly",
    "libs/seriouslyjs/effects/seriously.noise",
    "libs/seriouslyjs/effects/seriously.vignette",
    "libs/seriouslyjs/sources/seriously.depth",
    "libs/seriouslyjs/sources/seriously.imagedata",
    "libs/seriouslyjs/effects/seriously.displacement"
], function canvasWebGL ($, _, Seriously, _$, Firefly) {
    var FX_LEVEL         = 5;
    var ADD_FX           = false;
    var WIDTH            = document.body.offsetWidth;
    var HEIGHT           = document.body.offsetHeight;

    var canvas3d         = document.querySelector("#canvas");
    var canvas2d         = createCanvas(WIDTH, HEIGHT);
    var ctx2d            = canvas2d.getContext("2d");
    var canvas2dDepthMap = createCanvas(WIDTH, HEIGHT);
    var ctx2dDepthMap    = canvas2dDepthMap.getContext("2d");
    var fireflySettings  = { fireflies: [], firefliesNb: 40 };
    var flareSettings    = { opacity: 0 };
    var noiseSettings    = { time: 1 };
    var vignetteSettings = { amount: 1 };
    var displaceSettings = { x: 0, y: 0 };

    var bgImg;
    var bgDepthMap;
    var bgSettings;
    var bgFlare;
    var bgPattern;
    var seriously;
    var targetNode;
    var reformatNode;
    var noiseNode;
    var vignetteNode;
    var displaceNode;
    var scaleNode;
    var rAF;

    Object.defineProperty(_$.state, "FX_LEVEL", {
        get: function get () { return FX_LEVEL; },
        set: function set (value) { return setFXLevel(value); }
    });

    class CanvasWebGL {
        constructor () {
            this.dom         = canvas3d;
            this.initialized = false;
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
            flareSettings.tween.to(flareSettings, 10, { opacity: 0.5, ease: RoughEase.ease.config({ template:  Power0.easeNone, strength: 0.25, points: 50, taper: "none", randomize: true, clamp: true }) });
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

            _$.events.once("addFX", function () {
                ADD_FX = true;

                flareSettings.tween.play();
                vignetteSettings.tween.play();

                $(window).on("mousemove", function (e) {
                    if (FX_LEVEL >= 3) {
                        var newMapScale = {
                            x: 0.01 * e.pageX / WIDTH,
                            y: -1 * (0.01 * e.pageY / HEIGHT)
                        };

                        TweenMax.to(displaceSettings, 0.3, {
                            x        : newMapScale.x,
                            y        : newMapScale.y,
                            onUpdate : function () {
                                displaceNode.mapScale = [displaceSettings.x, displaceSettings.y];
                            }
                        });
                    }
                });
            });

            _$.events.on("resize", onResize);
            onResize();

            seriously.go();
            rAF = requestAnimationFrame(draw);
        }
    }

    function scaleBG () {
        var ratio;
        var appRatio;

        bgSettings.ratioX = WIDTH / bgSettings.INITIAL_WIDTH;
        bgSettings.ratioY = HEIGHT / bgSettings.INITIAL_HEIGHT;

        ratio             = _.max([bgSettings.ratioX, bgSettings.ratioY]);
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
        var canvas    = document.createElement("canvas");
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
            ctx2d.globalAlpha = 0.05;
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

    function setFXLevel (fxLevel) { if (fxLevel >= 0 && fxLevel <= 5) { FX_LEVEL = fxLevel; } }
    function getFXLevel () { return FX_LEVEL; }

    return CanvasWebGL;
});
