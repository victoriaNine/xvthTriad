define([
    "jquery",
    "underscore", 
    "backbone",
    "gsap",
    "global",
    "text!templates/templ_footer.html"
], function Elem_Footer ($, _, Backbone, GSAP, _$, Templ_Footer) {
    return Backbone.View.extend({
        tagName : "footer",
        id      : "footer",

        template : _.template(Templ_Footer),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
        },

        initialize,
        render,
        toggleAll,
        toggleLine,
        toggleLogo,
        toggleMenu,
        toggleSocial
    });

    function initialize (options) {
        this.$el.append(this.template());
        $(_$.dom).append(this.$el);

        this.line   = this.$(".footer_line");
        this.logo   = this.$(".footer_logo");
        this.menu   = this.$(".footer_menu");
        this.social = this.$(".footer_social");
        this.text   = this.$(".footer_text");

        var logo = $(_$.assets.get("svg.ui.logo"));
        this.logo.append(logo);
    }

    function render () {        
        return this;
    }

    function toggleAll (state) {
        var footerTl = new TimelineMax();

        if (state === "show") {
            footerTl.add(this.toggleLine("show"));
            footerTl.add(this.toggleLogo("show"), "-=1");
            footerTl.add(this.toggleMenu("show"), "-=1.5");
            footerTl.add(this.toggleSocial("show"), "-=1.5");
        } else if (state === "hide") {
            footerTl.add(this.toggleSocial("hide"));
            footerTl.add(this.toggleMenu("hide"), "-=1.5");
            footerTl.add(this.toggleLogo("hide"), "-=1.5");
            footerTl.add(this.toggleLine("hide"), "-=1");
        }

        return footerTl;
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
                this.$el.addClass("--showLogo");
            });
        } else if (state === "hide") {
            this.$el.removeClass("--showLogo");
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

        tl.set(element, { overflow:"hidden", clearProps:"display" });
        tl.from(element, 0.5, { width: 0, borderWidth:0 }, 0);
        tl.from(element, 1.5, { opacity:0 });
        tl.from(element, 1, { height: 0, padding:0, margin:0, ease: Power3.easeOut, clearProps:"all" }, 0.5);

        return tl;
    }

    function _hideElement (element) {
        var tl = new TimelineMax();

        tl.set(element, { overflow:"hidden" });
        tl.to(element, 1.5, { opacity:0 });
        tl.to(element, 1, { height:0, padding:0, margin:0, ease: Power3.easeOut }, 0);
        tl.to(element, 0.5, { width: 0, borderWidth: 0 }, 0.5);
        tl.set(element, { display:"none", clearProps:"height,width,overflow,borderWidth,padding,margin,opacity" }, "+=.1");

        return tl;
    }
});
