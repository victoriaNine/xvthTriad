define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "text!templates/templ_promptOverlay.html"
], function Elem_PromptOverlay ($, _, Backbone, _$, Templ_PromptOverlay) {
    return Backbone.View.extend({
        tagName               : "div",
        className             : "prompt_overlay screen overlay",

        template : _.template(Templ_PromptOverlay),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .prompt_overlay-confirmBtn"      : function () {
                this.confirmAction();
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "click .prompt_overlay-confirm2Btn"      : function () {
                this.confirmAction2();
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "mouseenter .prompt_overlay-confirmBtn,.prompt_overlay-confirm2Btn" : function () {
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
        this.span           = this.$("h1").find("span");
        this.isOpen         = false;
        this.confirmAction  = null;
        this.confirmAction2 = null;
    }

    function show (options = { msg: "" }) {
        _$.events.trigger("stopUserEvents");
        this.undelegateEvents();
        var tl   = new TimelineMax();
        var confirmText, confirmText2;

        if (this.$el.hasClass("is--active")) {
            tl.call(() => { this.$el.removeClass("is--active"); });
            tl.call(() => { this.$(".prompt_overlay-confirmBtn, .prompt_overlay-confirm2Btn").slideUp(400); }, [], null, "+=0.8");
        }

        tl.call(() => {
            if (options.type === "error") {
                this.span.text("An error");
                this.$("h1").html(this.span).append(" occured");

                confirmText        = (_$.ui.screen.id === "screen_title") ? "Close" : "Return to title screen";
                this.confirmAction = toTitleScreen;
            } else if (options.type === "info") {
                this.span.text(options.titleBold);
                this.$("h1").html(this.span).append(" " + options.titleRegular);

                confirmText        = options.btnMsg || "Close";
                this.confirmAction = options.action || this.close;
            } else if (options.type === "choice") {
                this.span.text(options.titleBold);
                this.$("h1").html(this.span).append(" " + options.titleRegular);

                confirmText         = options.btn1Msg;
                this.confirmAction  = options.action1;
                confirmText2        = options.btn2Msg;
                this.confirmAction2 = options.action2;

                this.$(".prompt_overlay-confirm2Btn").text(confirmText2);
            }

            this.$(".prompt_overlay-message").text(options.msg);
            this.$(".prompt_overlay-confirmBtn").text(confirmText);
        });
        tl.call(() => { this.$el.addClass("is--active"); });
        if (options.type === "choice") {
            tl.call(() => { this.$(".prompt_overlay-confirmBtn, .prompt_overlay-confirm2Btn").slideDown(400); }, [], null, "+=0.8");
        } else if (!options.autoClose) {
            tl.call(() => { this.$(".prompt_overlay-confirmBtn").slideDown(400); }, [], null, "+=0.8");
        }
        tl.call(() => { _$.events.trigger("startUserEvents"); this.delegateEvents(); this.isOpen = true; });
        if (options.autoClose) {
            tl.call(() => { this.confirmAction(); }, [], null, "+=1");
        }
    }

    function close (callback) {
        this.$el.removeClass("is--active");
        _$.utils.addDomObserver(this.$el, () => {
            this.isOpen         = false;
            this.confirmAction  = null;
            this.confirmAction2 = null;

            this.span.empty();
            this.$("h1").html(this.span);
            this.$(".prompt_overlay-message, .prompt_overlay-confirmBtn, .prompt_overlay-confirm2Btn").empty();
            this.$(".prompt_overlay-confirmBtn, .prompt_overlay-confirm2Btn").hide();

            if (_.isFunction(callback)) {
                callback();
            }
        }, true, "remove");
        setTimeout(this.remove.bind(this), 800);
    }

    function toTitleScreen () {
        this.close(() => {
            if (_$.ui.screen.id !== "screen_title") {
                 _$.ui.screen.transitionOut("title");
            }
        });
    }
});
