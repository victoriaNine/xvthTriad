import $ from 'jquery';

import _$ from 'utils';

export const ORIGINAL_SIZE = {
  width  : 1920,
  height : 950
};

const html = document.querySelector("html");
const body = document.body;

function getWindowWidth () { return window.innerWidth; }
function getWindowHeight () { return window.innerHeight; }

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

export default function setupScale () {
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
}
