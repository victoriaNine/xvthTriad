import { first, each } from 'lodash';

import _$ from 'store';

function testAudioFormat (format) {
  const audio = document.createElement('audio');

  switch (format) {
    case 'mp3':
      return !!(audio.canPlayType && audio.canPlayType('audio/mpeg;').replace(/no/, ''));
    case 'ogg':
      return !!(audio.canPlayType && audio.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/, ''));
  }
}

class AssetLoader {
  constructor () {
    this.loaders      = null;
    this.loaded       = 0;
    this.total        = 0;
    this.loadProgress = {};
    this.loading      = false;
    this.completed    = false;
  }

  moduleLoaders = {
    'img.avatars': require.context("./../../assets/img/avatars/", true),
    'img.cards': require.context("./../../assets/img/cards/", true),
    'img.flags': require.context("./../../assets/img/flags/", true),
    'img.help': require.context("./../../assets/img/help/", true),
    'img.icons': require.context("./../../assets/img/icons/", true),
    'img.ui': require.context("./../../assets/img/ui/", true),
    'audio.bgm': require.context("./../../assets/audio/bgm/", true),
    'audio.sfx': require.context("./../../assets/audio/sfx/", true),
    /*data: require.context("./../../assets/data/", true),
    text: require.context("./../../assets/text/", true),*/
    'svg.ui': require.context("./../../assets/svg/ui/", true),
  };

  load (loaders) {
    if (this.completed) {
      _$.debug.warn("All assets have already been loaded");
    } else if (this.loading) {
      _$.debug.warn("Assets are currently being loaded");
    } else {
      this.loaders = loaders;
      this.loading = true;

      const promises = [];
      this.loaders.forEach((loader) => {
        promises.push(_loadFiles.call(this, loader));
      });

      Promise.all(promises).then((responses) => { // eslint-disable-line no-unused-vars
        this.completed = true;
        _$.events.trigger("allLoadersComplete");
      });
    }
  }

  getPercentage () {
    return parseInt((this.loaded * 100 / this.total) || 0, 10);
  }
}

function _loadFiles (loader) {
  const promises = [];
  let promise;

  loader.files.forEach((fileInfo) => {
    let type      = fileInfo.type.split('.')[0];
    if (type === "audio" && !fileInfo.name.match(".(ogg|mp3|wav)$")) {
      fileInfo.name += testAudioFormat("ogg") ? ".ogg" : testAudioFormat("mp3") ? ".mp3" : ".wav";
    }

    let assetName    = fileInfo.name.split('.')[0];
    let loadedModule = this.moduleLoaders[fileInfo.type](`./${fileInfo.name}`, true);
    let onLoad;

    promise = new Promise((resolve, reject) => {
      if (type === "img") {
        const img = new Image();
        img.onload = function () {
          _onFileLoaded(img, fileInfo, loader.name);
          resolve(img);
        };
        img.onprogress = progressHandler.bind(this, assetName);
        img.onerror = reject;
        img.src = loadedModule;
      } else if (type === "data") {
        resolve(loadedModule);
      } else if (type === "text") {
        resolve(loadedModule);
      } else {
        const request = new XMLHttpRequest();

        switch (type) {
          case "audio":
            request.responseType = "arraybuffer";
            onLoad = _decodeAudio.bind(null, fileInfo);
            break;
          case "svg":
            request.responseType = "text";
            onLoad = _createSvgNode.bind(null, fileInfo);
            break;
        }

        request.open("GET", loadedModule, true);
        request.onload = function () {
          new Promise((resolveSub, rejectSub) => { // eslint-disable-line no-unused-vars
            return resolveSub(onLoad(request.response));
          }).then((data) => {
            _onFileLoaded(data, fileInfo, loader.name);
            resolve(data);
          });
        };

        request.onprogress = progressHandler.bind(this, assetName);
        request.onerror = reject;
        request.send();
      }
    });

    promises.push(promise);
  });

  function progressHandler (assetName, e) {
    let total  = 0;
    let loaded = 0;

    this.loadProgress[loader.name + ":" + assetName] = e;
    each(this.loadProgress, (progress) => {
      total  += progress.total;
      loaded += progress.loaded;
    });

    this.loaded = loaded;
    this.total  = total;

    _$.events.trigger("loadProgress:" + loader.name + ":" + assetName, e.loaded, e.total);
  }

  return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
    Promise.all(promises).then((responses) => { // eslint-disable-line no-unused-vars
      _$.events.trigger("loaderComplete:" + loader.name);
      resolve();
    });
  });
}

function _onFileLoaded (file, fileInfo, loaderName) {
  const assetName = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
  if (fileInfo.type !== "font") {
    _$.assets.set(fileInfo.type + "." + assetName, file);
  }

  _$.events.trigger("fileLoaded:" + loaderName + ":" + assetName);
}

function _decodeAudio (fileInfo, data) {
  return new Promise((resolve, reject) => {
    _$.audio.audioEngine.createAudioInstance(fileInfo, data, onDecode, reject);

    function onDecode (audioBuffer) {
      resolve(audioBuffer);
    }
  });
}

function _createSvgNode (fileInfo, data) {
  const assetName         = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
  const htmlWrapper       = document.createElement("html");
  htmlWrapper.innerHTML = data;

  const svgRoot = first(htmlWrapper.getElementsByTagName("svg"));
  svgRoot.classList.add("svg-" + assetName);

  return svgRoot;
}

export default AssetLoader;
