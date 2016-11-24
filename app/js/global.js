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
        addDomObserver,
        saveData,
        loadData,
        importSave,
        exportSave
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

    return _$;

    /* DESIGN */
    function getAppSizeRatio () {
        return document.body.scrollWidth / window.screen.actualWidth;
    }

    /* DOM */
    function addDomObserver (elements, eventName, once) {
        if (!_.isArray(elements)) {
            elements = [elements];
        }

        var domObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                elements.forEach((element) => {
                    if (mutation.addedNodes[0] === $(element)[0]) {
                        if (_.isString(eventName)) {
                            // Event
                            events.trigger(eventName, element);
                        } else {
                            // Callback
                            eventName(element);
                        }
                    }
                });

            });

            if (once) {
                domObserver.disconnect();
            }
        });
         
        domObserver.observe(dom[0], {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
            attributeOldValue: true,
            characterDataOldValue: true
        });

        return domObserver;
    }

    /* GAME */
    function getCardList () {
        return cardList;
    }

    function getRandomName () {
        var names = ["Squall", "Rinoa", "Quistis", "Zell", "Selphie", "Irvine"];
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
            top     += element.offsetTop  || 0;
            left    += element.offsetLeft || 0;
            element  = element.offsetParent;
        } while (element);

        return {
            left : left,
            top  : top
        };
    }

    function getDestinationCoord (card, destination, options) {
        options = options || {};

        // Offset the card slightly to compensate for drop shadow
        var cardOffsetX = -2;
        var cardOffsetY = -4;

        var destOffsets = getAbsoluteOffset($(destination)[0]);
        var destOffsetX = destOffsets.left;
        var destOffsetY = destOffsets.top;
        var destWidth   = $(destination).width();
        var destHeight  = $(destination).height();

        // If half of the destination is already showing, adjust the center anchor point
        if (options.halfWidth)  { destWidth  = destWidth * 2;/*(options.player === "user") ? destWidth * 2 : 0;*/ }
        if (options.halfHeight) { destHeight = destHeight * 2;/*(options.player === "user") ? destHeight * 2 : 0;*/ }

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
