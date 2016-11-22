define(["underscore", "global"], function assetLoader (_, _$) {
    var events = _$.events;
    var assets = _$.assets;

    return {
        init: init
    };

    function init (loaders) {
        var promises = [];

        _.each(loaders, function (loader) {
            promises.push(_loadFiles(loader));
        });

        Promise.all(promises).then(function (responses) {
            events.trigger("allLoadersComplete");
        });
    }

    function _loadFiles (loader) {
        var promises = [];
        var promise;
        var url;
        var type;
        var name;

        _.each(loader.files, function (fileInfo) {
            url  = _getFilePath(fileInfo.type) + fileInfo.name;
            type = fileInfo.type.slice(0, fileInfo.type.indexOf("."));
            name = fileInfo.name.slice(0, fileInfo.name.indexOf("."));

            if (type === "img") {
                promise = new Promise(function resolver (resolve, reject) {
                    var img     = new Image();
                    img.onload  = onLoad;
                    img.onerror = reject;
                    img.src     = url;

                    function onLoad () {
                        _onFileLoaded(img, fileInfo);
                        resolve(img);
                    }
                });
            } else {
                promise = fetch(url).then(function (response) {
                    switch (type) {
                        case "audio":
                            return response.buffer();
                        case "data":
                            return response.json();
                        case "text":
                            return response.text();
                        case "svg":
                            return (response.text()).then(_parseSvg.bind(null, fileInfo));
                    }
                }).then(function (data) {
                    _onFileLoaded(data, fileInfo);
                    return data;
                });
            }

            promises.push(promise);
        });

        return new Promise(function resolver (resolve, reject) {
            Promise.all(promises).then(function (responses) {
                events.trigger("loaderComplete:" + loader.name);
                resolve();
            });
        });
    }

    function _onFileLoaded (file, fileInfo) {
        var assetName = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
        assets.set(fileInfo.type + "." + assetName, file);
        events.trigger("fileLoaded:" + assetName);
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
});
