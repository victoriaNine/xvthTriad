import { get, set } from 'lodash';
import _$ from 'utils';

class AssetManager {
  constructor () {
    this.img = {
      ui      : {},
      cards   : {},
      avatars : {}
    };

    this.audio = {
      bgm : {},
      sfx : {}
    };
  }

  set (path, value) { return set(this, path, value); }
  get (path, defaultValue, noClone) {
    const asset = get(this, path);

    if (!asset) {
      _$.debug.warn("Missing asset:", path);

      if (defaultValue) {
        return this.get(path, defaultValue, noClone);
      }

      return null;
    }

    return noClone ? asset : asset.cloneNode(true);
  }
}

export default AssetManager;
