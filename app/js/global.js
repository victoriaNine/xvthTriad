define([
    "underscore",
    "backbone",
    "jquery",
    "json!data/cardList.json"
], function global (_, Backbone, $, cardList) {
    class AssetStore {
        constructor () {
            this.img = {
                ui      : {},
                cards   : {},
                avatars : {}
            };

            this.audio = {};
        }

        set (path, value)                     { return _.set(this, path, value); }
        get (path, defaultValue, directAsset) {
            var asset = _.get(this, path);

            if (!asset) {
                console.warn("Missing asset:", path);

                if (defaultValue) {
                    return this.get(path, defaultValue, directAsset);
                }
            }

            return directAsset ? asset : asset.cloneNode(true);
        }
    }

    var appName = "xvthTriad";
    var dom     = $("#app");
    var assets  = new AssetStore();
    var events  = _.clone(Backbone.Events);
    var state   = {};
    var utils   = {
        getAppSizeRatio,
        getCardList,
        getRandomName,
        getRandomCards,
        getAbsoluteOffset,
        getDestinationCoord,
        getUID,
        addDomObserver,
        saveData,
        loadData,
        importSave,
        exportSave,

        fadeIn,
        fadeOut,
        showElement,
        hideElement,
        getNodeIndex
    };

    var _$ = window._$ = {
        appName,
        dom,
        state,
        assets,
        events,
        utils
    };

    var saveSettings   = {
        prefix        : appName + ":save//",
        extension     : "xvtsave",
        charOffset    : 1,
        charSeparator : "x"
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

    return _$;

    /* DESIGN */
    function getAppSizeRatio () {
        return document.body.scrollWidth / window.screen.actualWidth;
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

    function showElement (element) {
        var tl = new TimelineMax();

        tl.set(element, { overflow:"hidden", clearProps:"display" });
        tl.from(element, 0.5, { width: 0, borderWidth:0 }, 0);
        tl.from(element, 1.5, { opacity:0 });
        tl.from(element, 1, { height: 0, padding:0, margin:0, ease: Power3.easeOut, clearProps:"all" }, 0.5);

        return tl;
    }

    function hideElement (element) {
        var tl = new TimelineMax();

        tl.set(element, { overflow:"hidden" });
        tl.to(element, 1.5, { opacity:0 });
        tl.to(element, 1, { height:0, padding:0, margin:0, ease: Power3.easeOut }, 0);
        tl.to(element, 0.5, { width: 0, borderWidth: 0 }, 0.5);
        tl.set(element, { display:"none", clearProps:"height,width,overflow,borderWidth,padding,margin,opacity" }, "+=.1");

        return tl;
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

    function getAbsoluteOffset (element) {
        var top  = 0;
        var left = 0;

        do {
            top     += $(element)[0].offsetTop  || 0;
            left    += $(element)[0].offsetLeft || 0;
            element  = $(element)[0].offsetParent;
        } while (element);

        return {
            left : left,
            top  : top
        };
    }

    function getDestinationCoord (card, destination, options = {}) {
        // Offset the card slightly to compensate for drop shadow
        var cardOffsetX = -2;
        var cardOffsetY = 0;//options.hidden ? -2 : 2;

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

    //===============================
    // SAVE/LOAD MANAGEMENT
    //===============================
    function saveData () {
        var data   = _.omit(_$.state.user.attributes, "album");
        data.album = _.map(_$.state.user.attributes.album.models, "attributes");

        _setLocalStorage(_$.appName, _encodeSaveData(data));
    }

    function loadData (data) {
        data = data || _getLocalStorage(_$.appName);

        if (!data) {
            console.error("LoadData: No data");
            return;
        }

        var JSONdata = _decodeSaveData(data);
        _.each(_.omit(JSONdata, "album"), function (value, key) {
            _$.state.user.set(key, value);
        });

        _$.state.user.get("album").reset(JSONdata.album);
    }

    function importSave (saveFile) {
        var blob = URL.createObjectURL(saveFile);

        fetch(blob).then(function (response) {
            return response.text();
        }).then(function (data) {
            _$.loadData(data);
            return data;
        });
    }

    function exportSave (fileName) {
        var data = _getLocalStorage(_$.appName);

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
            fileName = _$.appName + "_" + saveTime + "." + saveSettings.extension;
        }

        if (typeof data === "object") {
            data = JSON.stringify(data, undefined, 4);
        }

        var blob = new Blob([data], { type: "text/plain" });
        var e    = document.createEvent("MouseEvents");
        var a    = document.createElement("a");

        a.download            = fileName;
        a.href                = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ["text/plain", a.download, a.href].join(":");
        e.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
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

    //===============================
    // LOCAL STORAGE
    //===============================
    function _setLocalStorage (key, value) { window.localStorage.setItem(key, JSON.stringify(value)); }
    function _getLocalStorage (key)        { return JSON.parse(window.localStorage.getItem(key)); }
});
