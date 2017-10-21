import Stats from 'stats.js';
import $ from 'jquery';

import jqueryNearest from 'jquery-nearest';
jqueryNearest($);

import _$ from 'utils';

import AudioEngine from 'Modules/audioEngine';
import CanvasWebGL from 'Modules/canvasWebGL';
import AssetLoader from 'Modules/assetLoader';
import GamepadManager from 'Modules/gamepadManager';
import UpdateManager from 'Modules/updateManager';
import SocketManager from 'Modules/socketManager';
import Superlogin from 'Modules/superlogin';

import Screen_Loading from 'Screens/Loading';
import Screen_Title from 'Screens/Title';
import Partial_Footer from 'Partials/Footer';

import LoaderAudioBGM from 'Data/loaders/audioBGM.json';
import LoaderAudioSFX from 'Data/loaders/audioSFX.json';

const loaders = [
  LoaderAudioBGM,
  LoaderAudioSFX
];

function setupScale () {
  const ORIGINAL_SIZE = {
    width  : 1920,
    height : 950
  };

  const isSafariMobile = _$.app.env.device.model && _$.app.env.device.model.match(/iphone|ipad/i) && _$.app.env.browser.name.match(/safari/i);
  const URL_BAR_HEIGHT = isSafariMobile ? 44 : 0;

  const html = document.querySelector("html");
  const body = document.body;

  function getWindowWidth () { return document.documentElement.clientWidth; }
  function getWindowHeight () { return document.documentElement.clientHeight - URL_BAR_HEIGHT; }

  _$.ui.window = Object.create(null, {
    devicePixelRatio: { get: () => window.devicePixelRatio },
    width: { get: getWindowWidth },
    height: { get: getWindowHeight },
    actualWidth: { get: () => getWindowWidth() * window.devicePixelRatio },
    actualHeight: { get: () => getWindowHeight() * window.devicePixelRatio },
    screenWidth: { get: () => window.screen.width },
    screenHeight: { get: () => window.screen.height },
    actualScreenWidth: { get: () => window.screen.width * window.devicePixelRatio },
    actualScreenHeight: { get: () => window.screen.height * window.devicePixelRatio },
  });

  _$.events.on("scalarUpdate", (event, newScalar) => {
    _$.state.appScalar = newScalar;
  });

  window.addEventListener("resize", reScale);
  reScale();

  function reScale () {
    const originalRatio = 1 / _$.ui.window.devicePixelRatio;

    const actualWidth  = _$.ui.window.actualWidth;
    const actualHeight = _$.ui.window.actualHeight;
    const scalarW = actualWidth / ORIGINAL_SIZE.width;
    const scalarH = actualHeight / ORIGINAL_SIZE.height;
    let scalar;

    if (scalarW < scalarH) {
      scalar = scalarW;
      html.style.width  = ORIGINAL_SIZE.width + "px";
      html.style.height = (actualHeight / scalar) + "px";
    } else {
      scalar = scalarH;
      html.style.width  = (actualWidth / scalar) + "px";
      html.style.height = ORIGINAL_SIZE.height + "px";
    }

    $(html).css({ transform: `scale(${scalar})` });
    $(body).css({ transform: `scale(${originalRatio})` });
    _$.events.trigger("scalarUpdate", scalar);
  }
}

function setupStats () {
  const stats = new Stats();
  stats.dom.style.left = "auto";
  stats.dom.style.right = "0px";
  stats.dom.style.width = "80px";
  stats.showPanel(0);
  document.body.appendChild(stats.dom);

  requestAnimationFrame(function loop () {
    stats.update();
    requestAnimationFrame(loop);
  });
}

/* eslint-disable semi */
if (!_$.debug.debugMode) {
  //===============================
  // GOOGLE ANALYTICS
  //===============================
  (function(b,o,i,l,e,r){
    b.GoogleAnalyticsObject=l;b[l]||(b[l]=function(){(b[l].q=b[l].q||[]).push(arguments)});b[l].l=+new Date;
    e=o.createElement(i);r=o.getElementsByTagName(i)[0];
    e.src="//www.google-analytics.com/analytics.js";
    r.parentNode.insertBefore(e,r);
  }(window,document,"script","ga"));
  window.ga("create","UA-89445990-1");
  window.ga("send","pageview");
}
/* eslint-enable */

const location = window.location;
if (location.pathname !== "/") {
  if (location.pathname === "/confirm-email" && location.search) {
    const confirmEmailMsg = location.search.match("success=true") ? "Email verified, thanks! You can now login." : window.unescape(location.search.match(/=(.*?)$/)[1]);

    _$.events.once("initialized", () => {
      _$.audio.audioEngine.playSFX("gameGain");
      _$.ui.screen.info({
        titleBold    : "Email",
        titleRegular : "confirmation",
        msg          : confirmEmailMsg
      });
    });
  } else if (location.pathname.match("/password-reset/(.+)")) {
    const token = location.pathname.match("/password-reset/(.+)")[1];

    _$.events.once("initialized", () => {
      _$.audio.audioEngine.playSFX("gameGain");
      _$.ui.screen.resetPassword(token);
    });
  }

  window.history.replaceState({}, "", "/");
}

if (_$.app.env.device.type === "mobile") {
  document.querySelector("html").classList.add("isMobile");
} else if (_$.app.env.device.type === "tablet") {
  document.querySelector("html").classList.add("isTablet");
} else {
  document.querySelector("html").classList.add("isDesktop");
}

if ((_$.app.env.device.type && _$.app.env.device.type !== "desktop") || !_$.app.env.browser.name.match(/chrome/i)) {
  document.querySelector("html").classList.add("noCanvas");
} else {
  _$.app.env.useCanvas = true;
}

if (_$.debug.debugMode) {
  setupStats();

  /*_$.events.on("all", (event, ...data) => {
    if (data.length) {
      _$.debug.log("event triggered:", event.name, event, data);
    } else {
      _$.debug.log("event triggered:", event.name, event);
    }
  });*/
}

_$.events.once("launch", () => {
  _$.ui.footer = new Partial_Footer();
  _$.ui.screen = new Screen_Title({ setup: true, fullIntro: true });

  window.addEventListener("beforeunload", (e) => {
    return _$.ui.screen.showSavePrompt(e);
  });

  window.addEventListener("blur", () => {
    if (_$.state.user && _$.state.user.get("inactiveAudio") === "playAll") {
      return;
    } else if (_$.state.user && _$.state.user.get("inactiveAudio") === "onlyNotifs") {
      _$.audio.audioEngine.channels.bgm.mute(true);
      _$.audio.audioEngine.channels.sfx.mute(true);
    } else {
      _$.audio.audioEngine.channels.master.mute(true);
    }
  });

  window.addEventListener("focus", () => {
    if (_$.state.user && _$.state.user.get("inactiveAudio") === "playAll") {
      return;
    } if (_$.state.user && _$.state.user.get("inactiveAudio") === "onlyNotifs") {
      _$.audio.audioEngine.channels.bgm.unmute(true);
      _$.audio.audioEngine.channels.sfx.unmute(true);
    } else {
      _$.audio.audioEngine.channels.master.unmute(true);
    }
  });

  // Prevent rubberband scrolling on touch devices
  document.body.addEventListener("touchmove", (e) => {
    if (e.targetTouches.length === 1) {
      e.preventDefault();
    }
  }, { passive: false });
});

_$.events.on("gamepadOn",  () => { _$.controls.type = "gamepad"; });
_$.events.on("gamepadOff", () => { _$.controls.type = "mouse"; });

_$.events.once("scalarUpdate", () => {
  _$.controls.type           = "mouse";

  if (_$.app.env.deviceType === "desktop") {
    _$.controls.gamepadManager = new GamepadManager();
  }

  _$.app.updateManager       = new UpdateManager();
  _$.app.assetLoader         = new AssetLoader();
  _$.audio.audioEngine       = new AudioEngine();
  _$.comm.socketManager      = new SocketManager();
  _$.comm.sessionManager     = new Superlogin(_$.app.sessionConfig, true);
  _$.ui.canvas               = new CanvasWebGL();
  _$.ui.screen               = new Screen_Loading({ loaders });
});

setupScale();
