define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "text!templates/templ_serverPromptOverlay.html",
    "tweenMax"
], function Elem_ServerPromptOverlay ($, _, Backbone, _$, Templ_ServerPromptOverlay) {
    return Backbone.View.extend({
        tagName               : "div",
        className             : "serverPrompt_overlay screen overlay",

        template : _.template(Templ_ServerPromptOverlay),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .serverPrompt_overlay-confirmBtn"      : function () {
                this.confirmAction();
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "mouseenter .serverPrompt_overlay-confirmBtn" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            }
        },

        initialize,
        show,
        close,
        toTitleScreen
    });

    function initialize (attributes) {
        this.$el.html(this.template());
        this.isOpen        = false;
        this.confirmAction = null;
    }

    function show (options = { msg: "" }) {
        _$.events.trigger("stopUserEvents");
        this.undelegateEvents();
        var tl = new TimelineMax();
        var confirmText;
        var span = this.$("h1").find("span");

        if (this.$el.hasClass("is--active")) {
            tl.call(() => { this.$el.removeClass("is--active"); });
            tl.call(() => { this.$(".serverPrompt_overlay-confirmBtn").slideDown(400); }, [], null, "+=0.8");
        }

        tl.call(() => {
            if (options.type === "error") {
                span.text("An error");
                this.$("h1").html(span).append(" occured");
                confirmText = (_$.ui.screen.id === "screen_title") ? "Close" : "Go back to title screen";
                this.confirmAction = toTitleScreen;
            } else if (options.type === "info") {
                span.text(options.titleBold);
                this.$("h1").html(span).append(" " + options.titleRegular);
                confirmText = "Close";
                this.confirmAction = options.action;
            }

            this.$(".serverPrompt_overlay-message").text(options.msg);
            this.$(".serverPrompt_overlay-confirmBtn").text(confirmText);
        });
        tl.call(() => { this.$el.addClass("is--active"); });
        tl.call(() => { this.$(".serverPrompt_overlay-confirmBtn").slideDown(400); }, [], null, "+=0.8");
        tl.call(() => { _$.events.trigger("startUserEvents"); this.delegateEvents(); this.isOpen = true; });
    }

    function close (callback = _.noop) {
        this.$el.removeClass("is--active");
        this.isOpen        = false;
        this.confirmAction = null;

        _$.utils.addDomObserver(this.$el, callback, true, "remove");
        setTimeout(this.remove.bind(this), 900);
    }

    function toTitleScreen () {
        this.close(() => {
            if (_$.ui.screen.id !== "screen_title") {
                 _$.ui.screen.transitionOut("title");
            }
        });
    }
});
