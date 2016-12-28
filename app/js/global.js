define([
    "underscore",
    "backbone",
    "jquery",
    "json!data/cardList.json"
], function global (_, Backbone, $, cardList) {
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

        set (path, value) { return _.set(this, path, value); }
        get (path, defaultValue, noClone) {
            var asset = _.get(this, path);

            if (!asset) {
                console.warn("Missing asset:", path);

                if (defaultValue) {
                    return this.get(path, defaultValue, noClone);
                }
            }

            return noClone ? asset : asset.cloneNode(true);
        }
    }

    var startTime = Date.now();
    var app       = Object.create(null, {
        version      : { value: "0.1.0" },
        versionName  : { value: "Beta" },
        name         : { value: "xvthTriad" },
        saveExt      : { value: "xvtsave" },
        currentTime  : { get: getCurrentTime },
        checkUpdates : { value: checkUpdates },
        saveData     : { value: saveData },
        loadData     : { value: loadData },
        importSave   : { value: importSave },
        exportSave   : { value: exportSave }
    });
    var dom       = $("#app");
    var assets    = new AssetManager();
    var events    = _.clone(Backbone.Events);
    var state     = { inGame: false };
    var ui        = {};
    var controls  = {};
    var audio     = {};
    var comm      = {};
    var utils = {
        getAppSizeRatio,
        getDragSpeed,
        getCardList,
        getRandomName,
        getRandomCards,
        getAbsoluteOffset,
        getDestinationCoord,
        getPositionFromCaseName,
        getCaseNameFromPosition,
        getUID,
        addDomObserver,

        fadeIn,
        fadeOut,
        getTopElementAt,
        isVisibleByUser,
        getNodeIndex,
        getLocalStorage,

        getBase64Image,
        timecodeToSecs,
        openSharePopup
    };

    var debug = {
        debugMode : false,
        log,
        warn,
        error
    };

    var saveSettings = {
        prefix        : app.name + ":save//",
        extension     : app.saveExt,
        charOffset    : 1,
        charSeparator : "x"
    };

    var shareSettings = {
        url      : $("meta[property='og:url']").attr("content"),
        text     : $("meta[property='twitter:description']").attr("content"),
        posttype : "link",
        hashtags : "ff,ff15,ffxv,tripletriad",
        tags     : $("meta[name='keywords']").attr("content"),
        title    : $("meta[property='og:title']").attr("content"),
        content  : $("meta[property='og:url']").attr("content"),
        caption  : $("meta[property='og:description']").attr("content"),
        showVia  : ""
    };

    var _$ = {
        app,
        dom,
        ui,
        audio,
        state,
        assets,
        events,
        utils,
        debug,
        controls,
        comm
    };

    $(window).resize(function() {
        if (_.isNil(window.resizedFinished)) {
            _$.events.trigger("resizeStart");
        }

        clearTimeout(window.resizedFinished);
        window.resizedFinished = setTimeout(function () {
            window.resizedFinished = null;
            _$.events.trigger("resize");
        }, 500);
    });

    if (_$.debug.debugMode) {
        window._$ = _$;
    }

    return _$;

    /* TIME */
    function getCurrentTime () {
        return parseInt((_$.audio.audioEngine && _$.audio.audioEngine.audioCtx) ?
                _$.audio.audioEngine.audioCtx.currentTime * 1000 : Date.now() - startTime);
    }

    /* SOCIAL SHARE*/
    function openSharePopup (platform) {
        window.open(_getShareUrl(_.extend(shareSettings, { platform })), "", "toolbar=0,status=0,width=540,height=600");
    }

    function _getShareUrl (options = {}) {
        switch (options.platform) {
            case "facebook":
                return "https://www.facebook.com/sharer.php?u=" + encodeURIComponent(options.url);
            case "twitter":
                return "https://twitter.com/intent/tweet?url=" + encodeURIComponent(options.url) +
                "&text="     + encodeURIComponent(options.text) +
                "&hashtags=" + encodeURIComponent(options.hashtags);
            case "reddit":
                return "https://www.reddit.com/submit?url=" + encodeURIComponent(options.url);
            case "tumblr":
                return "http://tumblr.com/widgets/share/tool?canonicalUrl=" + encodeURIComponent(options.url) +
                "&posttype=" + encodeURIComponent(options.posttype) +
                "&tags="     + encodeURIComponent(options.tags) +
                "&title="    + encodeURIComponent(options.title) +
                "&content="  + encodeURIComponent(options.content) +
                "&caption="  + encodeURIComponent(options.caption) +
                "&show-via=" + encodeURIComponent(options.showVia);
        }
    }

    /* LOGGING */
    function log ()   { _makeLog("log", arguments); }
    function warn ()  { _makeLog("warn", arguments); }
    function error () { _makeLog("error", arguments); }

    function _makeLog (type, message) {
        var log = [_$.app.currentTime.toString()].concat(Array.prototype.slice.call(message));
        if (_$.debug.debugMode) {
            console[type].apply(null, log);
        }
    }

    /* AUDIO */
    function timecodeToSecs (timeCode) {
        var timeValues = _.map(timeCode.split(":"), parseFloat);
        return timeValues[0] * 60 * 60 + timeValues[1] * 60 + timeValues[2];
    }

    /* DESIGN */
    function getAppSizeRatio () {
        return document.body.scrollWidth / window.screen.actualWidth;
    }

    function getDragSpeed () {
        return 1.25 / _$.state.appScalar;
    }

    function fadeIn (elements, callback, duration = 0.5, delay = 0) {
        var tl = new TimelineMax({
            delay: delay,
            onCompleteParams: ["{self}"],
            onComplete: function (tween) {
                if (_.isFunction(callback)) {
                    callback(tween);
                }
            }
        });

        tl.set(elements, { display: "" });
        tl.from(elements, duration, { opacity: 0 });
        
        return tl;
    }

    function fadeOut (elements, callback, duration = 0.5, delay = 0) {
        var tl = new TimelineMax({
            delay: delay,
            onCompleteParams: ["{self}"],
            onComplete: function (tween) {
                if (_.isFunction(callback)) {
                    callback(tween);
                }
            }
        });

        tl.to(elements, duration, { opacity: 0 });
        tl.set(elements, { display: "none", clearProps: "opacity" });

        return tl;
    }

    function isVisibleByUser (element) {
        element = $(element);
        var offset  = _$.utils.getAbsoluteOffset(element);
        var centerX = (offset.left + element.width() / 2);
        var centerY = (offset.top + element.height() / 2);
        var elementFromPoint = _$.utils.getTopElementAt(centerX, centerY);

        return !!$(elementFromPoint).closest(element).length;
    }

    function getTopElementAt (offsetX, offsetY) {
        return document.elementFromPoint(offsetX / window.devicePixelRatio, offsetY / window.devicePixelRatio);
    }

    function getAbsoluteOffset (element) {
        element = $(element)[0];
        var top  = 0;
        var left = 0;

        while (element) {
            top     += $(element)[0].offsetTop  || 0;
            left    += $(element)[0].offsetLeft || 0;
            element  = $(element)[0].offsetParent;
        }

        return {
            left : left,
            top  : top
        };
    }

    /* DOM */
    function addDomObserver (elements, eventName, once = true, mutationType = "add") {
        if (!_.isArray(elements)) {
            elements = [elements];
        }

        var domObserver = new MutationObserver((mutations) => {
            _.each(mutations, (mutation) => {
                _.each(elements, (element) => {
                    if ((mutationType === "add" && mutation.addedNodes[0] === $(element)[0]) ||
                        (mutationType === "remove" && mutation.removedNodes[0] === $(element)[0])) {
                        resolve(element);
                    }
                });
            });
        });

        function resolve (element) {
            if (_.isString(eventName)) {
                // Event
                _$.events.trigger(eventName, element);
            } else {
                // Callback
                eventName(element);
            }

            if (once) {
                domObserver.disconnect();
            }
        }
         
        domObserver.observe(_$.dom[0], {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
            attributeOldValue: true,
            characterDataOldValue: true
        });

        return domObserver;
    }

    function getNodeIndex (element) {
        return Array.from($(element)[0].parentNode.children).indexOf($(element)[0]);
    }

    function getBase64Image (url, callback = _.noop) {
        return fetch(url).then(response => response.blob()).then(blob => {
            return new Promise((resolve, reject) => {
                var reader = new FileReader();
                reader.onloadend = () => {
                    callback(reader.result);
                    resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        });
    }

    /* GAME */
    function getUID (length = 8, usedList = {}) {
        var hex    = "0123456789ABCDEF";
        var string = "";

        for (let i = 0; i < length; i++) {
            string += hex[parseInt(Math.random() * 16)];
        }

        return usedList[string] ? getUID(length, usedList) : string;
    }

    function getCardList () {
        return cardList;
    }

    function getRandomName () {
        var names = ["Noctis", "Luna", "Ignis", "Prompto", "Gladiolus", "Regis", "Ardyn", "Iedolas"];
        return names[_.random(names.length - 1)] + "_" + _.random(9999);
    }

    function getRandomCards (options) {
        var i       = 0;
        var cards   = [];
        var matches = [];
        var card;
        var level;

        while (i < options.amount) {
            if (_.isNil(options.level) && _.isNil(options.minLevel) && _.isNil(options.maxLevel)) {
                if (_.isNil(options.album)) {
                    matches = cardList;
                } else {
                    matches = options.album.toJSON();
                }
            } else {
                level   = options.level ? options.level : (_.random(options.minLevel - 1, options.maxLevel - 1) + 1);
                matches = options.album ? options.album.where({level: level}) : _.filter(cardList, {level: level});
            }

            card = matches[_.random(matches.length - 1)];

            if (!options.unique || (options.unique && !_.find(cards, card))) {
                cards.push(card);
                i++;
            }
        }

        return cards;
    }

    function getDestinationCoord (card, destination, options = {}) {
        // Offset the card slightly to compensate for drop shadow
        var cardOffsetX = -2;
        var cardOffsetY = 0;

        var destOffsets = getAbsoluteOffset($(destination)[0]);
        var destOffsetX = destOffsets.left;
        var destOffsetY = destOffsets.top;
        var destWidth   = $(destination).width();
        var destHeight  = $(destination).height();

        // Difference in size to center the card on its destination
        var deltaWidth  = destWidth - $(card).width();
        var deltaHeight = destHeight - $(card).height();

        var destX = (destOffsetX + deltaWidth / 2) + cardOffsetX;
        var destY = (destOffsetY + deltaHeight / 2) + cardOffsetY;

        return {
            left : destX,
            top  : destY
        };
    }

    function getPositionFromCaseName (caseName) {
        return {
            x: parseInt(caseName.match(/\d/g)[0]),
            y: parseInt(caseName.match(/\d/g)[1])
        };
    }

    function getCaseNameFromPosition (position = {}) {
        return "case" + position.x + position.y;
    }

    //===============================
    // SAVE/LOAD MANAGEMENT
    //===============================
    function saveData () {
        var data     = _.omit(_$.state.user.attributes, "album");
        data.album   = _.map(_$.state.user.attributes.album.models, "attributes");
        data.version = _$.app.version;

        setLocalStorage(_$.app.name, _encodeSaveData(data));
    }

    function loadData (data) {
        data = data || getLocalStorage(_$.app.name);

        if (!data) {
            console.error("LoadData: No data");
            return;
        }

        var JSONdata = _decodeSaveData(data);
        _$.app.checkUpdates(JSONdata, (updatedData) => {
            _.each(_.omit(updatedData, ["album", "version"]), function (value, key) {
                _$.state.user.set(key, value);
            });

            _$.state.user.get("album").reset(updatedData.album);
        });
    }

    function importSave (saveFile, callback = _.noop) {
        var blob = URL.createObjectURL(saveFile);

        fetch(blob).then(function (response) {
            return response.text();
        }).then(function (data) {
            _$.app.loadData(data);
            callback(data);
            return data;
        });
    }

    function exportSave (fileName) {
        var data = getLocalStorage(_$.app.name);

        if (!data) {
            console.error("ExportSave: No data");
            return;
        }

        var timeStamp = new Date();
        var saveTime  = (
            timeStamp.toLocaleDateString() + "-" +
            ((timeStamp.getHours() < 10) ? "0" + timeStamp.toLocaleTimeString() : timeStamp.toLocaleTimeString())
        ).replace(/[^\d+-]/g, "");

        if (!fileName) {
            fileName = _$.app.name + "_" + saveTime + "." + saveSettings.extension;
        }

        if (typeof data === "object") {
            data = JSON.stringify(data, undefined, 4);
        }

        var blob = new Blob([data], { type: "text/plain" });
        var a    = document.createElement("a");
        var e    = new MouseEvent("click", {
            bubbles       : true,
            cancelable    : false,
            view          : window,
            detail        : 0,
            screenX       : 0,
            screenY       : 0,
            clientX       : 0,
            clientY       : 0,
            ctrlKey       : false,
            altKey        : false,
            shiftKey      : false,
            metaKey       : false,
            button        : 0,
            relatedTarget : null
        });

        a.download            = fileName;
        a.href                = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ["text/plain", a.download, a.href].join(":");
        a.dispatchEvent(e);
    }

    function _encodeSaveData (JSONdata) {
        var encodedData = saveSettings.prefix;
        JSONdata = JSON.stringify(JSONdata);

        JSONdata.split("").forEach(function (char) {
            encodedData += saveSettings.charSeparator + (char.codePointAt(0) + saveSettings.charOffset);
        });

        return encodedData;
    }

    function _decodeSaveData (encodedData) {
        if (encodedData.indexOf(saveSettings.prefix) !== 0) {
            console.error("DecodeSave: Invalid save file");
            return "";
        }

        var JSONdata = "";
        encodedData.replace(saveSettings.prefix, "").match(new RegExp(saveSettings.charSeparator + "\\d+", "g")).forEach(function (chunk) {
            JSONdata += String.fromCodePoint(chunk.match(/\d+/) - saveSettings.charOffset);
        });

        return JSON.parse(JSONdata);
    }

    function checkUpdates (saveData, onUpdateCallback) {
        if (saveData.version === _$.app.version) {
            onUpdateCallback(saveData);
        } else {
            var updatedData = _$.app.updateManager.update(saveData);
            onUpdateCallback(updatedData);
        }
    }

    //===============================
    // LOCAL STORAGE
    //===============================
    function setLocalStorage (key, value) { window.localStorage.setItem(key, JSON.stringify(value)); }
    function getLocalStorage (key)        { return JSON.parse(window.localStorage.getItem(key)); }
});
