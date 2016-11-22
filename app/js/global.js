define([
    "underscore",
    "backbone",
    "jquery",
    "json!data/cards.json"
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

    var dom    = $("#app");
    var assets = new AssetStore();
    var events = _.clone(Backbone.Events);
    var state  = {};
    var utils  = {
        getAppSizeRatio,
        getCardList,
        getRandomName,
        getRandomCards,
        getAbsoluteOffset,
        getDestinationCoord,
        addDomObserver,
        toggleFooter
    };

    var _$ = window._$ = {
        appName : "xvthTriad",
        dom,
        state,
        assets,
        events,
        utils
    };

    return _$;

    /* DESIGN */
    function getAppSizeRatio () {
        return document.body.scrollWidth / window.screen.actualWidth;
    }

    function toggleFooter (options) {
        var footerTl = new TimelineMax();

        if (!options || options && options.all) {
            if (options.all === "show") {
                footerTl.add(toggleLine("show"));
                footerTl.add(toggleLogo("show"), "-=1");
                footerTl.add(toggleMenu("show"), "-=1.5");
                footerTl.add(toggleSocial("show"), "-=1.5");
            } else if (options.all === "hide") {
                footerTl.add(toggleSocial("hide"));
                footerTl.add(toggleMenu("hide"), "-=1.5");
                footerTl.add(toggleLogo("hide"), "-=1.5");
                footerTl.add(toggleLine("hide"), "-=1");
            }
        } else {
            if (options.line) {
                footerTl.add(toggleLine(options.line));
            }

            if (options.logo) {
                footerTl.add(toggleLogo(options.logo));
            }

            if (options.menu) {
                footerTl.add(toggleMenu(options.menu));
            }

            if (options.social) {
                footerTl.add(toggleSocial(options.social));
            }
        }

        return footerTl;

        function toggleLine (state) {
            var el = $(".footer_line");
            var tl = new TimelineMax();

            if (state === "show") {
                tl.set(el, { clearProps:"display" });
                tl.from(el, 1.5, { opacity:0, width:0, ease: Power3.easeOut, clearProps:"all" });
            } else if (state === "hide") {
                tl.to(el, 1.5, { width: 0, opacity: 0 });
                tl.set(el, { display:"none", clearProps:"width,opacity" }, "+=.1");
            }

            return tl;
        }

        function toggleLogo (state) {
            var el = $(".footer_logo");
            var tl = new TimelineMax();

            el.addClass("tweening");
            if (state === "show") {
                tl.add(showElement(el));
                tl.call(function () {
                    $("#footer").addClass("--showLogo");
                });
            } else if (state === "hide") {
                $("#footer").removeClass("--showLogo");
                tl.add(hideElement(el));
            }

            tl.call(function () {
                el.removeClass("tweening");
            });

            return tl;
        }

        function toggleMenu (state) {
            return staggerToggle($(".footer_menu-element"), state);
        }

        function toggleSocial (state) {
            return staggerToggle($(".footer_social-element"), state);
        }

        function staggerToggle (elements, state) {
            var tl = new TimelineMax();
            var nbElement = elements.length;

            $(elements).each(function (i) {
                if (state === "show") {
                    tl.add(showElement($(this)), i * 0.15);
                } else if (state === "hide") {
                    tl.add(hideElement($(this)), (nbElement - i) * 0.15);
                }
            });

            return tl;
        }

        function showElement (element) {
            var tl = new TimelineMax();

            tl.set(element, { overflow:"hidden", clearProps:"display" });
            tl.from(element, 1.5, { opacity:0 });
            tl.from(element, 0.5, { width: 0, borderWidth:0 }, 0);
            tl.from(element, 1, { height: 0, padding:0, margin:0, ease: Power3.easeOut, clearProps:"all" }, "-=1");

            return tl;
        }

        function hideElement (element) {
            var tl = new TimelineMax();

            tl.set(element, { overflow:"hidden" });
            tl.to(element, 1.5, { opacity:0 });
            tl.to(element, 1, { height:0, padding:0, margin:0, ease: Power3.easeOut }, 0);
            tl.to(element, 0.5, { width: 0, borderWidth: 0 }, "-=1");
            tl.set(element, { display:"none", clearProps:"height,width,overflow,borderWidth,padding,margin,opacity" }, "+=.1");

            return tl;
        }
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
                if (_.isNil(options.collection)) {
                    matches = cardList;
                } else {
                    matches = options.collection.toJSON();
                }
            } else {
                level   = options.level ? options.level : (_.random(options.minLevel - 1, options.maxLevel - 1) + 1);
                matches = options.collection ? options.collection.where({level: level}) : _.filter(cardList, {level: level});
            }

            card = matches[_.random(matches.length - 1)];

            if (!options.unique || (options.unique && !_.find(cards, card))) {
                if (options.owner !== undefined) {
                    card.owner        = options.owner;
                    card.currentOwner = options.owner;
                }

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
});
