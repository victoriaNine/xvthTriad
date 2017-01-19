define([
    "underscore",
    "backbone",
    "jquery",
    "elo",
    "json!data/cardList.json",
    "json!data/countryList.json"
], function global (_, Backbone, $, Elo, cardList, countryList) {
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
                _$.debug.warn("Missing asset:", path);

                if (defaultValue) {
                    return this.get(path, defaultValue, noClone);
                }
            }

            return noClone ? asset : asset.cloneNode(true);
        }
    }

    var startTime = Date.now();
    var app       = Object.create(null, {
        name          : { value: "{{ NAME }}" },
        version       : { value: "{{ VERSION }}" },
        versionName   : { value: "{{ VERSION_NAME }}" },
        versionFlag   : { value: "{{ VERSION_FLAG }}" },
        currentTime   : { get: getCurrentTime },
        checkUpdates  : { value: checkUpdates },
        saveData      : { value: saveData },
        loadData      : { value: loadData },
        checkDataType : { value: getSaveDataType },
        importSave    : { value: importSave },
        exportSave    : { value: exportSave },
        encodeData    : { value: getEncodedData },
        decodeData    : { value: getDecodedData },
        track         : { value: sendGAevent },
        env           : { value: {
            deviceType       : "browser",
            mobileDeviceType : null
        }},
        sessionConfig: { value : {
            noDefaultEndpoint  : false,
            providers          : ["local"],
            refreshThreshold   : 0.9
        }},
        saveConfig: { value: {
            savePrefix    : "{{ NAME }}:save//",
            sessionPrefix : "{{ NAME }}:session//",
            extension     : "xvtsave"
        }}
    });
    var dom       = $("#app");
    var assets    = new AssetManager();
    var events    = _.clone(Backbone.Events);
    var state     = {};
    var ui        = {};
    var controls  = {};
    var audio     = {};
    var comm      = {};
    var utils = {
        getAppSizeRatio,
        getDragSpeed,
        getCardList,
        getCountryList,
        getRandomName,
        getRandomCards,
        getAbsoluteOffset,
        getDestinationCoord,
        getPositionFromCaseName,
        getCaseNameFromPosition,
        getFormattedNumber,
        getFormattedDate,
        getElo,
        getUID,
        getUserData,
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
        debugMode: true,
        log,
        warn,
        error
    };

    var shareSettings = {
        url      : $("meta[property='og:url']")[0].content,
        text     : $("meta[name='twitter:description']")[0].content,
        posttype : "link",
        hashtags : "ff,ff15,ffxv,tripletriad",
        tags     : $("meta[name='keywords']")[0].content,
        title    : $("meta[property='og:title']")[0].content,
        content  : $("meta[property='og:url']")[0].content,
        caption  : $("meta[property='og:description']")[0].content,
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
        if (_.isNil(window.resizeTiemout)) {
            _$.events.trigger("resizeStart");
        }

        clearTimeout(window.resizeTiemout);
        window.resizeTiemout = setTimeout(function () {
            window.resizeTiemout = null;
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

    /* TRACKING */
    function sendGAevent (...args) {
        if (!_$.debug.debugMode) {
            window.ga(...args);
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
        return window.devicePixelRatio / _$.state.appScalar;
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

    function getBase64Image (url, callback) {
        return fetch(url).then(response => response.blob()).then(blob => {
            return new Promise((resolve, reject) => {
                var reader = new FileReader();
                reader.onloadend = () => {
                    if (_.isFunction(callback)) {
                        callback(reader.result);
                    }
                    
                    resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        });
    }

    /* GAME */
    function getUserData () {
        var data     = _.omit(_$.state.user.attributes, "album");
        data.album   = _.map(_$.state.user.attributes.album.models, "attributes");
        data.version = _$.app.version;

        return data;
    }

    function getUID (length = 16, usedList = {}, base = "") {
        var chars      = "0123456789abcdefghijklmnopqrstuvwxyz_";
        var string     = "";
        var charsCount = chars.length;

        for (var i = 0; i < length; i++) {
            string += chars[parseInt(Math.random() * charsCount)];
        }

        string = base + string;
        return usedList[string] ? getUID(length, usedList) : string;
    }

    function getCardList ()    { return cardList; }
    function getCountryList () { return countryList; }

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

    function getDestinationCoord (card, destination) {
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

    function getFormattedNumber (number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function getFormattedDate (dateObject, options = {}) {
        if (_.isString(dateObject)) {
            dateObject = new Date(dateObject);
        }

        var date  = dateObject.getFullYear() + "." + (dateObject.getMonth() < 10 ? ("0" + (dateObject.getMonth() + 1)) : dateObject.getMonth() + 1) + "." + (dateObject.getDate() < 10 ? "0" + dateObject.getDate() : dateObject.getDate());
        var time  = (dateObject.getHours() < 10 && options.hoursHH ? "0" + dateObject.getHours() : dateObject.getHours()) + ":";
            time += (dateObject.getMinutes() < 10 ? "0" + dateObject.getMinutes() : dateObject.getMinutes());

        if (options.seconds) {
            time += ":" + (dateObject.getSeconds() < 10 ? "0" + dateObject.getSeconds() : dateObject.getSeconds());
        }

        return { date, time };
    }

    function getElo (kFactor = 32, min = 0, max = +Infinity) {
        return new Elo(kFactor, min, max);
    }

    //===============================
    // SAVE/LOAD MANAGEMENT
    //===============================
    function saveData (credentials, onError) {
        if (_$.comm.sessionManager.getSession()) {
            return saveToDb(credentials, onError);
        } else {
            return saveToStorage();
        }
    }

    function loadData (data) {
        data = data || _$.utils.getLocalStorage(_$.app.name);
        var type = getSaveDataType(data);

        if (type === "session") {
            return loadFromDb();
        } else if (type === "save") {
            return loadFromStorage(data);
        }
    }

    function saveToDb (form = {}) {
        var data    = _$.utils.getUserData();
        var profile = _.omit(data, ["version", "userId", "name", "email"]);
        _.extend(form, { name: data.name, profile: profile });

        return _$.comm.sessionManager.updateProfile(form).then((response) => {
            if (response.data && response.data.error) {
                throw response.data.error;
            } else {
                _$.comm.sessionManager.refresh().catch((error) => {
                    _$.debug.error("global.js@488", error);
                });
                _$.events.trigger("userDataSaved:toDatabase");
                return response;
            }
        }).catch((error) => {
            _$.debug.error("global.js@494", error);
            throw error;
        });
    }

    function loadFromDb () {
        return _$.comm.sessionManager.getUser.call(_$.comm.sessionManager).then((userData) => {
            _$.state.user.set({
                userId : userData._id,
                name   : userData.name,
                email  : userData.email
            });

            _.each(_.omit(userData.profile, "album"), function (value, key) {
                _$.state.user.set(key, value);
            });

            _$.state.user.setAlbum(userData.profile.album);
            _$.state.user.dataLoaded = true;
            _$.events.trigger("userDataLoaded:fromDatabase");
            return userData;
        }).catch((error) => {
            _$.debug.error("global.js@515", error);
            throw error;
        });
    }

    function saveToStorage () {
        return _encodeSaveData(_$.utils.getUserData()).then((saveData) => {
            setLocalStorage(_$.app.name, saveData);
            _$.events.trigger("userDataSaved:toStorage");
        }).catch((error) => {
            _$.debug.error("global.js@523", error);
            throw error;
        });
    }

    function loadFromStorage (storageData) {
        if (!storageData) {
            _$.debug.error("loadFromStorage: No data");
            return Promise.reject();
        }

        return _decodeSaveData(storageData, "save").then((JSONdata) => {
            _$.app.checkUpdates(JSONdata, (updatedData) => {
                _.each(_.omit(updatedData, ["album", "version", "userId"]), function (value, key) {
                    _$.state.user.set(key, value);
                });

                _$.state.user.setAlbum(updatedData.album);
                _$.state.user.dataLoaded = true;
                _$.events.trigger("userDataLoaded:fromStorage");
            });
        }).catch((error) => {
            _$.debug.error("global.js@545", error);
            throw error;
        });
    }

    function importSave (saveFile, callback) {
        var blob = URL.createObjectURL(saveFile);

        fetch(blob).then(function (response) {
            return response.text();
        }).then(function (data) {
            _$.app.loadData(data);
            if (_.isFunction(callback)) {
                callback(data);
            }
            return data;
        });
    }

    function exportSave (fileName) {
        var data = getLocalStorage(_$.app.name);

        if (!data) {
            _$.debug.error("ExportSave: No data");
            return;
        }

        var timeStamp = new Date();
        var saveTime  = (
            timeStamp.toLocaleDateString() + "-" +
            ((timeStamp.getHours() < 10) ? "0" + timeStamp.toLocaleTimeString() : timeStamp.toLocaleTimeString())
        ).replace(/[^\d+-]/g, "");

        if (!fileName) {
            fileName = _$.app.name + "_" + saveTime + "." + _$.app.saveExt;
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

    function _encodeSaveData (JSONdata, type = "save") {
        var prefix = (type === "save") ? _$.app.saveConfig.savePrefix : _$.app.saveConfig.sessionPrefix;

        return new Promise((resolve, reject) => {
            _$.comm.socketManager.emit("encodeSaveData", { JSONdata, prefix }, (response) => {
                resolve(response.msg);
            });
        });
    }

    function _decodeSaveData (encodedData, type = "save") {
        var prefix = (type === "save") ? _$.app.saveConfig.savePrefix : _$.app.saveConfig.sessionPrefix;

        if (!_.isString(encodedData) || encodedData.indexOf(prefix) !== 0) {
            var recognizedType = getSaveDataType(encodedData);
            if (recognizedType) {
                _$.debug.warn("DecodeSave: Data is of " + recognizedType + " type");
            } else {
                _$.debug.error("DecodeSave: Invalid " + type + " data");
            }

            return Promise.resolve("");
        }

        return new Promise((resolve, reject) => {
            _$.comm.socketManager.emit("decodeSaveData", { encodedData, prefix }, (response) => {
                resolve(response.msg);
            });
        });
    }

    function getEncodedData  (data, type) { return data ? _encodeSaveData(data, type) : Promise.resolve(null); }
    function getDecodedData  (data, type) { return data ? _decodeSaveData(data, type) : Promise.resolve(null); }
    function getSaveDataType (data) {
        if (_.isString(data) && data.indexOf(_$.app.saveConfig.savePrefix) === 0) {
            return "save";
        } else if (_.isString(data) && data.indexOf(_$.app.saveConfig.sessionPrefix) === 0) {
            return "session";
        } else {
            window.localStorage.removeItem(_$.app.name);
            return false;
        }
    }

    function checkUpdates (saveData, onUpdateCallback) {
        if (saveData.version === _$.app.version) {
            onUpdateCallback(saveData);
        } else {
            var updatedData = _$.app.updateManager.update(saveData);
            onUpdateCallback(updatedData);
            _$.app.saveData();
        }
    }

    //===============================
    // LOCAL STORAGE
    //===============================
    function setLocalStorage    (key, value) { window.localStorage.setItem(key, JSON.stringify(value)); }
    function getLocalStorage    (key)        { return JSON.parse(window.localStorage.getItem(key)); }
});
