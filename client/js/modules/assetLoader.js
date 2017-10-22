import { first, each } from 'lodash';

import _$ from 'utils';

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
      this.fileNb  = 0;

      const promises = this.loaders.map(_loadFiles.bind(this));

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
  const promises = loader.files.map((fileInfo) => {
    let type = fileInfo.type.split('.')[0];
    if (type === "audio" && !fileInfo.name.match(".(ogg|mp3|wav)$")) {
      fileInfo.name += testAudioFormat("ogg") ? ".ogg" : testAudioFormat("mp3") ? ".mp3" : ".wav";
    }

    let assetName    = fileInfo.name.split('.')[0];
    let loadedModule = this.moduleLoaders[fileInfo.type](`./${fileInfo.name}`, true);
    let onLoad;

    let promise = new Promise((resolve, reject) => {
      if (type === "data") {
        resolve(loadedModule);
      } else if (type === "text") {
        resolve(loadedModule);
      } else {
        const request = new XMLHttpRequest();

        switch (type) {
          case "img":
            request.responseType = "blob";
            onLoad = _createImgNode.bind(null, loadedModule);
            break;
          case "audio":
            request.responseType = "arraybuffer";
            onLoad = _decodeAudio.bind(null, fileInfo);
            break;
          case "svg":
            request.responseType = "text";
            onLoad = _createSvgNode.bind(null, fileInfo);
            break;
        }

        request.onloadstart = () => { this.fileNb++; };
        request.onload = () => {
          onLoad(request.response).then((data) => {
            _onFileLoaded(data, fileInfo, loader.name);
            resolve(data);
          });
        };

        request.onprogress = _progressHandler.bind(this, loader.name, assetName);
        request.onerror = reject;
        request.open("GET", loadedModule, true);
        request.send();
      }
    });

    return promise;
  });

  return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
    Promise.all(promises).then((responses) => { // eslint-disable-line no-unused-vars
      _$.events.trigger(`loaderComplete:${loader.name}`);
      resolve();
    });
  });
}

function _progressHandler (loaderName, assetName, e) {
  let total  = 0;
  let loaded = 0;

  this.loadProgress[`${loaderName}:${assetName}`] = e;
  if (Object.keys(this.loadProgress).length === this.fileNb) {
    each(this.loadProgress, (progress) => {
      total  += progress.total;
      loaded += progress.loaded;
    });

    this.loaded = loaded;
    this.total  = total;

    _$.events.trigger(`loadProgress:${loaderName}:${assetName}`, e.loaded, e.total);
  }
}

function _onFileLoaded (file, fileInfo, loaderName) {
  const assetName = fileInfo.name.split('.')[0];
  if (fileInfo.type !== "font") {
    _$.assets.set(`${fileInfo.type}.${assetName}`, file);
  }

  _$.events.trigger(`fileLoaded:${loaderName}:${assetName}`);
}

function _createImgNode (url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
  });
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
  return new Promise((resolve) => {
    const assetName       = fileInfo.name.split('.')[0];
    const htmlWrapper     = document.createElement("html");
    htmlWrapper.innerHTML = data;

    const svgRoot = first(htmlWrapper.getElementsByTagName("svg"));
    svgRoot.classList.add(`svg-${assetName}`);

    resolve(svgRoot);
  });
}

export default AssetLoader;
