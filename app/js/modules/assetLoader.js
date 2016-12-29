define(["underscore", "global", "es6Promise", "fetch"], function assetLoader (_, _$) {
    require("es6Promise").polyfill();
    require("fetch");

    class AssetLoader {
        constructor () {
            this.loading  = false;
            this.complete = false;
        }

        load (loaders) {
            var that = this;
            if (this.complete) {
                _$.debug.warn("All assets have already been loaded");
            } else if (this.loading) {
                _$.debug.warn("Assets are currently being loaded");
            } else {
                this.loading = true;

                var promises = [];
                _.each(loaders, function (loader) {
                    promises.push(_loadFiles(loader));
                });

                Promise.all(promises).then(function (responses) {
                    that.complete = true;
                    _$.events.trigger("allLoadersComplete");
                });
            }
        }
    }

    function _loadFiles (loader) {
        var promises = [];
        var promise;

        _.each(loader.files, function (fileInfo) {
            let type = fileInfo.type.slice(0, fileInfo.type.indexOf("."));
            let url;
            let name;

            if (type === "audio" && !fileInfo.name.match(".ogg|.mp3|.wav")) {
                fileInfo.name += Modernizr.audio.ogg ? ".ogg" : Modernizr.audio.mp3 ? ".mp3" : ".wav";
            }

            url  = _getFilePath(fileInfo.type) + fileInfo.name;
            name = fileInfo.name.slice(0, fileInfo.name.indexOf("."));

            if (type === "img") {
                promise = new Promise(function resolver (resolve, reject) {
                    var img     = new Image();
                    img.onload  = onLoad;
                    img.onerror = reject;
                    img.src     = url;

                    function onLoad () {
                        _onFileLoaded(img, fileInfo, loader.name);
                        resolve(img);
                    }
                });
            } else {
                promise = fetch(url).then(function (response) {
                    switch (type) {
                        case "audio":
                            return response.arrayBuffer().then(_decodeAudio.bind(null, fileInfo));
                        case "data":
                            return response.json();
                        case "text":
                            return response.text();
                        case "svg":
                            return (response.text()).then(_parseSvg.bind(null, fileInfo));
                    }
                }).then(function (data) {
                    _onFileLoaded(data, fileInfo, loader.name);
                    return data;
                });
            }

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

    function _parseSvg (fileInfo, data) {
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
