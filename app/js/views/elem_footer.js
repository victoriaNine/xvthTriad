define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "text!templates/templ_footer.html",
    "tweenMax"
], function Elem_Footer ($, _, Backbone, _$, Templ_Footer) {
    return Backbone.View.extend({
        tagName : "footer",
        id      : "footer",

        template : _.template(Templ_Footer),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .footer_logo"         : "toggleFooter",
            "click .footer_menu-homeBtn" : "toTitleScreen"
        },

        initialize,
        toggleAll,
        toggleLine,
        toggleLogo,
        toggleMenu,
        toggleSocial,

        toggleFooter,
        toTitleScreen
    });

    function initialize (options) {
        this.$el.html(this.template());
        $(_$.dom).append(this.$el);

        this.isTweening = false;
        this.isOpen     = false;

        this.line   = this.$(".footer_line");
        this.logo   = this.$(".footer_logo");
        this.menu   = this.$(".footer_menu");
        this.social = this.$(".footer_social");
        this.text   = this.$(".footer_text");

        var logo = $(_$.assets.get("svg.ui.logo"));
        this.logo.append(logo);
    }

    function toTitleScreen () {
        if (_$.ui.screen.id !== "screen_title") {
            _$.ui.screen.transitionOut("title");
        }
    }

    function toggleFooter () {
        _$.events.trigger("stopUserEvents");
        var tl = new TimelineMax();

        if (_$.state.inGame) {
            if (this.isOpen) {
                tl.add(this.toggleSocial("hide"));
            } else {
                tl.add(this.toggleSocial("show"));
            }
        } else {
            if (this.isOpen) {
                tl.add(this.toggleSocial("hide"));
                tl.add(this.toggleMenu("hide"), "-=1.5");
            } else {
                tl.add(this.toggleMenu("show"));
                tl.add(this.toggleSocial("show"), "-=1.5");
            }
        }

        tl.call(() => { _$.events.trigger("startUserEvents"); });
        this.isOpen = !this.isOpen;

        return tl.timeScale(2);
    }

    function toggleAll (state) {
        var tl = new TimelineMax();

        if (state === "show") {
            tl.add(this.toggleLine("show"));
            tl.add(this.toggleLogo("show"), "-=1");
            tl.add(this.toggleMenu("show"), "-=1.5");
            tl.add(this.toggleSocial("show"), "-=1.5");
        } else if (state === "hide") {
            tl.add(this.toggleSocial("hide"));
            tl.add(this.toggleMenu("hide"), "-=1.5");
            tl.add(this.toggleLogo("hide"), "-=1.5");
            tl.add(this.toggleLine("hide"), "-=1");
        }

        return tl;
    }

    function toggleLine (state) {
        var el = this.line;
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
        var el = this.logo;
        var tl = new TimelineMax();

        el.addClass("tweening");
        if (state === "show") {
            tl.add(_showElement(el));
            tl.call(() => {
                this.$el.addClass("is--showingLogo");
            });
        } else if (state === "hide") {
            this.$el.removeClass("is--showingLogo");
            tl.add(_hideElement(el));
        }

        tl.call(function () {
            el.removeClass("tweening");
        });

        return tl;
    }

    function toggleMenu (state) {
        return _staggerToggle(this.menu.find(".footer_menu-element"), state);
    }

    function toggleSocial (state) {
        return _staggerToggle(this.social.find(".footer_social-element"), state);
    }

    function _staggerToggle (elements, state) {
        var tl = new TimelineMax();
        var nbElement = elements.length;

        $(elements).each(function (i) {
            if (state === "show") {
                tl.add(_showElement($(this)), i * 0.15);
            } else if (state === "hide") {
                tl.add(_hideElement($(this)), (nbElement - i) * 0.15);
            }
        });

        return tl;
    }

    function _showElement (element) {
        var tl = new TimelineMax();

        tl.set(element, { clearProps: "display" });
        tl.set(element, { overflow: "hidden" });
        tl.from(element, 0.5, { width: 0, borderWidth: 0 }, 0);
        tl.from(element, 1.5, { opacity: 0 });
        tl.from(element, 1, { height: 0, padding :0, margin: 0, ease: Power3.easeOut }, 0.5);
        tl.set(element, { clearProps: "all" }, "+=.1");

        return tl;
    }

    function _hideElement (element) {
        var tl = new TimelineMax();

        tl.set(element, { overflow: "hidden" });
        tl.to(element, 1.5, { opacity:0 });
        tl.to(element, 1, { height:0, padding:0, margin:0, ease: Power3.easeOut }, 0);
        tl.to(element, 0.5, { width: 0, borderWidth: 0 }, 0.5);
        tl.set(element, { display: "none", clearProps: "height,width,overflow,borderWidth,padding,margin,opacity" }, "+=.1");

        return tl;
    }
});
