import { findIndex, slice, map, identity } from 'lodash';

const PATCH_HISTORY = [
  { version: "1.0.0", flag: "beta", patch: identity },
  { version: "1.0.1", flag: "beta", patch: patch_1_0_1 }
];

class UpdateManager {
  update (saveData) {
    const saveVersion    = saveData.version;
    const updateFrom     = findIndex(PATCH_HISTORY, { version: saveVersion });
    const updateTo       = PATCH_HISTORY.length;
    const patchesToApply = slice(PATCH_HISTORY, updateFrom, updateTo);

    if (!patchesToApply.length) {
      return saveData;
    }

    const patchFns = map(patchesToApply, "patch");
    return _pipe(...patchFns)(saveData);
  }
}

function _pipe (...fns) {
  return function (x) {
    return fns.reduce((prev, func) => {
      return func(prev);
    }, x);
  };
}

function patch_1_0_1 (userData) {
  userData.placingMode = "dragDrop";
  userData.bgmVolume   = 1;
  userData.sfxVolume   = 0.5;
  return userData;
}

export default UpdateManager;
