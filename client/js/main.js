import $ from 'jquery';
import Stats from 'stats.js';
import 'jquery-nearest';

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

  function pixelRatioAdjust (forceSize) {
    const html             = document.querySelector("html");
    const body             = document.body;
    const devicePixelRatio = window.devicePixelRatio = window.devicePixelRatio || 1;

    window.screen       = window.screen || {};
    screen.actualWidth  = window.screen.width * devicePixelRatio;
    screen.actualHeight = window.screen.height * devicePixelRatio;

    const scalar = 1 / devicePixelRatio;
    const offset = (devicePixelRatio * 100 - 100) / 2;

    if (forceSize) {
      html.style.transformOrigin = "0 0";
      _$.events.on("scalarUpdate", (event, newScalar) => {
        _$.state.appScalar = newScalar;
      });
      window.addEventListener("resize", reScale);
      reScale();
    } else {
      html.style.width   = window.innerWidth * devicePixelRatio + "px";
      html.style.height  = window.innerHeight * devicePixelRatio + "px";
      _$.state.appScalar = 1;
    }

    body.style.transform = `scale(${scalar}) translate(-${offset}%, -${offset}%)`;

    function reScale () {
      const fullWidth  = window.innerWidth * devicePixelRatio;
      const fullHeight = window.innerHeight * devicePixelRatio;
      const scalarW = fullWidth / ORIGINAL_SIZE.width;
      const scalarH = fullHeight / ORIGINAL_SIZE.height;
      let scalar;

      if (scalarW < scalarH) {
        scalar = scalarW;
        html.style.width  = ORIGINAL_SIZE.width + "px";
        html.style.height = ((window.innerHeight * devicePixelRatio) / scalar) + "px";
      } else {
        scalar = scalarH;
        html.style.width  = ((window.innerWidth * devicePixelRatio) / scalar) + "px";
        html.style.height = ORIGINAL_SIZE.height + "px";
      }

      html.style.transform = `scale(${scalar})`;
      _$.events.trigger("scalarUpdate", scalar);
    }
  }

  pixelRatioAdjust(true);
}

/* eslint-disable no-useless-escape */
// http://stackoverflow.com/a/11381730/989439
function mobileCheck () {
  let check = false;
  (function (a) {
    if (/(android|ipad|playbook|silk|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) {
      check = true;
    }
  })(window.navigator.userAgent||window.navigator.vendor||window.opera);
  return check;
}

function phoneCheck () {
  let check = false;
  (function (a) {
    if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) {
      check = true;
    }
  })(window.navigator.userAgent||window.navigator.vendor||window.opera);
  return check;
}
/* eslint-enable */

function tabletCheck () {
  return mobileCheck() && !phoneCheck();
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

/*_$.events.on("all", function (event, ...data) {
if (data.length) {
_$.debug.log("event triggered:", event.name, event, data);
} else {
_$.debug.log("event triggered:", event.name, event);
}
});*/

_$.events.once("launch", () => {
  _$.ui.footer = new Partial_Footer();
  _$.ui.screen = new Screen_Title({ setup: true, fullIntro: true });

  $(window).on("beforeunload", (e) => {
    return _$.ui.screen.showSavePrompt(e);
  }).on("blur", () => {
    if (_$.state.user && _$.state.user.get("inactiveAudio") === "playAll") {
      return;
    } else if (_$.state.user && _$.state.user.get("inactiveAudio") === "onlyNotifs") {
      _$.audio.audioEngine.channels.bgm.mute(true);
      _$.audio.audioEngine.channels.sfx.mute(true);
    } else {
      _$.audio.audioEngine.channels.master.mute(true);
    }
  }).on("focus", () => {
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
  _$.controls.gamepadManager = new GamepadManager();
  _$.app.updateManager       = new UpdateManager();
  _$.app.assetLoader         = new AssetLoader();
  _$.audio.audioEngine       = new AudioEngine();
  _$.comm.socketManager      = new SocketManager();
  _$.comm.sessionManager     = new Superlogin(_$.app.sessionConfig, true);
  _$.ui.canvas               = new CanvasWebGL();
  _$.ui.screen               = new Screen_Loading({ loaders });
});

setupScale();

if (_$.debug.debugMode) {
  setupStats();
}

if (mobileCheck()) {
  $("html").addClass("isMobile");
  _$.app.env.deviceType = "mobile";
}

if (phoneCheck())  {
  $("html").addClass("isPhone");
  _$.app.env.mobileDeviceType = "mobile";
}

if (tabletCheck()) {
  $("html").addClass("isTablet");
  _$.app.env.mobileDeviceType = "tablet";
}
