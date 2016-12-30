define(["underscore", "global", "es6Promise", "fetch"], function assetLoader (_, _$) {
    require("es6Promise").polyfill();
    require("fetch");

    class AssetLoader {
        constructor () {
            this.loaders      = null;
            this.loaded       = 0;
            this.total        = 0;
            this.loadProgress = {};
            this.loading      = false;
            this.completed    = false;
        }

        load (loaders) {
            var that = this;
            if (this.completed) {
                _$.debug.warn("All assets have already been loaded");
            } else if (this.loading) {
                _$.debug.warn("Assets are currently being loaded");
            } else {
                this.loaders = loaders;
                this.loading = true;

                var promises = [];
                _.each(this.loaders, function (loader) {
                    promises.push(_loadFiles.call(that, loader));
                });

                Promise.all(promises).then(function (responses) {
                    that.complete = true;
                    _$.events.trigger("allLoadersComplete");
                });
            }
        }

        getPercentage () {
            return parseInt((this.loaded * 100 / this.total) || 0);
        }
    }

    function _loadFiles (loader) {
        var that     = this;
        var promises = [];
        var promise;

        _.each(loader.files, function (fileInfo) {
            let type      = fileInfo.type.slice(0, fileInfo.type.indexOf("."));
            let assetName = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
            let url;
            let name;
            let request;
            let onLoad;

            if (type === "audio" && !fileInfo.name.match(".ogg|.mp3|.wav")) {
                fileInfo.name += Modernizr.audio.ogg ? ".ogg" : Modernizr.audio.mp3 ? ".mp3" : ".wav";
            }

            url     = _getFilePath(fileInfo.type) + fileInfo.name;
            name    = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
            promise = new Promise(function resolver (resolve, reject) {
                var progressStarted = false;
                var request         = new XMLHttpRequest();
                request.open("GET", url, true);

                switch (type) {
                    case "img":
                        request.responseType = "blob";
                        onLoad = _createImgNode.bind(null, fileInfo, url);
                        break;
                    case "audio":
                        request.responseType = "arraybuffer";
                        onLoad = _decodeAudio.bind(null, fileInfo);
                        break;
                    case "data":
                        request.responseType = "json";
                        onLoad = () => request.responseType;
                        break;
                    case "text":
                        request.responseType = "text";
                        onLoad = () => request.responseType;
                        break;
                    case "svg":
                        request.responseType = "text";
                        onLoad = _createSvgNode.bind(null, fileInfo);
                        break;
                }

                request.onload = function () {
                    resolve(new Promise(function (resolveSub, rejectSub) {
                        return resolveSub(onLoad(request.response));
                    }).then(function (data) {
                        _onFileLoaded(data, fileInfo, loader.name);
                        return data;
                    }));
                };

                request.onprogress = function (e) {
                    var total  = 0;
                    var loaded = 0;

                    that.loadProgress[loader.name + ":" + assetName] = e;
                    _.each(that.loadProgress, function (progress) {
                        total  += progress.total;
                        loaded += progress.loaded;
                    });

                    that.loaded = loaded;
                    that.total  = total;

                    _$.events.trigger("loadProgress:" + loader.name + ":" + assetName, e.loaded, e.total);
                };

                request.onerror = reject;
                request.send();
            });

            promises.push(promise);
        });

        return new Promise(function resolver (resolve, reject) {
            Promise.all(promises).then(function (responses) {
                _$.events.trigger("loaderComplete:" + loader.name);
                resolve();
            });
        });
    }

    function _onFileLoaded (file, fileInfo, loaderName) {
        var assetName = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
        if (fileInfo.type !== "font") {
             _$.assets.set(fileInfo.type + "." + assetName, file);
        }
        
        _$.events.trigger("fileLoaded:" + loaderName + ":" + assetName);
    }

    function _decodeAudio (fileInfo, data) {
        return new Promise(function resolver (resolve, reject) {
            _$.audio.audioEngine.createAudioInstance(fileInfo, data, onDecode, reject);

            function onDecode (audioBuffer) {
                resolve(audioBuffer);
            }
        });
    }

    function _createImgNode (fileInfo, url, data) {
        var img = new Image();
        img.src = url;
        return img;
    }

    function _createSvgNode (fileInfo, data) {
        var assetName         = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
        var htmlWrapper       = document.createElement("html");
        htmlWrapper.innerHTML = data;

        var svgRoot = _.first(htmlWrapper.getElementsByTagName("svg"));
        svgRoot.classList.add("svg-" + assetName);

        return svgRoot;
    }

    function _getFilePath (type) {
        return "./assets/" + type.replace(".", "/") + "/";
    }

    return AssetLoader;
});
