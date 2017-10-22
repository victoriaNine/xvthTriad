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

import setupScale from './internal/scale';

const loaders = [
  LoaderAudioBGM,
  LoaderAudioSFX
];

// Environment detection
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

// Setup actions for email links
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

// Setting up events
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

  window.addEventListener("resize", () => {
    if (Number.isInteger(window.resizeTimeout)) {
      _$.events.trigger("resizeStart");
    }

    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
      window.resizeTimeout = null;
      _$.events.trigger("resize");
    }, 500);
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

// Add listener for when the scaling is completed
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

// Debug tools
if (_$.debug.debugMode) {
  require('./internal/stats').default();

  /*_$.events.on("all", (event, ...data) => {
    if (data.length) {
      _$.debug.log("event triggered:", event.name, event, data);
    } else {
      _$.debug.log("event triggered:", event.name, event);
    }
  });*/
}

// Setup scaling and launch
setupScale();
