define([
    "jquery",
    "underscore", 
    "backbone",
    "views/screen",
    "text!templates/templ_userSettings.html",
    "global",
    "tweenMax"
], function Screen_UserSettings ($, _, Backbone, Screen, Templ_UserSettings, _$) {
    return Screen.extend({
        id        : "screen_userSettings",

        // Our template for the line of statistics at the bottom of the app.
        template  : _.template(Templ_UserSettings),

        // Delegated events for creating new items, and clearing completed ones.
        events    : {
            "click .setting-difficulty"                          : "toggleDifficulty",
            "click .userSettings_content-save-choice-saveBtn"    : "saveGame",
            "click .userSettings_content-save-choice-cancelBtn"  : "resetChanges",
            "click .userSettings_content-save-choice-exportBtn"  : "exportSaveFile",
            "click .userSettings_content-save-choice-resetBtn"   : "resetUser",
            "click .userSettings_content-load-choice-loadBtn"    : "loadGame",
            "click .userSettings_content-load-choice-cancelBtn"  : function () { $(".setting-import input").val(""); this.toggleLoad("hide"); },
            "keyup .setting-name input"                          : function (e) { this.validateInput(e.target); },
            "change .setting-avatar input"                       : function (e) { this.validateInput(e.target); },
            "change .setting-import input"                       : function (e) { this.validateInput(e.target); },
            "mouseenter .userSettings_content-save-choice-element,.userSettings_content-load-choice-element" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            },
            "click .userSettings_content-save-choice-element,.userSettings_content-load-choice-element,.setting-difficulty,.setting-avatar input,.setting-import input" : function () {
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "focus .setting-name input" : function () {
                _$.audio.audioEngine.playSFX("uiInput");
            }
        },

        initialize,

        toggleDifficulty,
        toggleLoad,

        saveGame,
        resetChanges,
        loadGame,
        exportSaveFile,
        resetUser,

        transitionIn,
        transitionOut,
        validateInput
    });

    function initialize (options) {
        this.$el.html(this.template({
            avatarSrc : _$.state.user.get("avatar"),
            wonCount  : _$.state.user.get("gameStats").won,
            lostCount : _$.state.user.get("gameStats").lost,
            drawCount : _$.state.user.get("gameStats").draw
        }));

        this.resetChanges();
        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        this.add();
    }

    function toggleDifficulty (e, init) {
        var closestValidOption = $(e.target).hasClass("is--disabled") ? $(e.target).parent().children(":not(.is--disabled)").eq(0) : $(e.target);
        var index              = _$.utils.getNodeIndex(closestValidOption);
        var selectHeight       = this.$(".setting-difficulty").height();
        var toggle             = this.$(".setting-difficulty .userSettings_content-settings-setting-toggle");
        var dropdown           = this.$(".userSettings_content-settings-setting-select");
        var defaultOption      = $(e.target).parent().children(".difficultySetting-" + _$.state.user.get("difficulty"));

        if (this.$(".setting-difficulty").hasClass("is--active") || init) {
            if (!init) {
                this.$(".setting-difficulty").removeClass("is--active");
            }

            TweenMax.to(dropdown[0], 0.4, { scrollTop: index * selectHeight });
        } else {
            this.$(".setting-difficulty").addClass("is--active");
        }

        $(window).on("click.toggleDifficulty", (clickEvent) => {
            if (!$(clickEvent.target).parents(".setting-difficulty").length) {
                var defaultOptionIndex = _$.utils.getNodeIndex(defaultOption);
                TweenMax.to(dropdown[0], 0.4, { scrollTop: defaultOptionIndex * selectHeight });
                this.$(".setting-difficulty").removeClass("is--active");
                $(window).off("click.toggleDifficulty");
            }
        });
    }

    function saveGame () {
        var selectHeight = this.$(".setting-difficulty").height();
        var settings     = {};
        var settingName;
        var difficultySetting;
        var difficultySettingIndex;

        settings.name   = this.$(".setting-name input").val().trim();
        settings.avatar = this.$(".setting-avatar input")[0].files[0];

        difficultySettingIndex = Math.ceil(this.$(".userSettings_content-settings-setting-select").scrollTop() / selectHeight);
        difficultySetting      = this.$(".userSettings_content-settings-setting-select").children().eq(difficultySettingIndex)[0].className.replace("difficultySetting-", "");
        settings.difficulty    = difficultySetting;

        if (settings.avatar) {
            var url = URL.createObjectURL(settings.avatar);
            _$.utils.getBase64Image(url, (base64URL) => {
                _$.state.user.set({ avatar: base64URL });
                proceed.call(this);
            });
        } else {
            proceed.call(this);
        }

        function proceed () {
            _$.state.user.set({ name: settings.name, difficulty: settings.difficulty });
            _$.utils.saveData();
            this.transitionOut("title");
        }
    }

    function resetChanges () {
        this.$(".setting-name input").val(_$.state.user.get("name"));
        $(".setting-avatar input, .setting-import input").val("");
        this.toggleDifficulty({ target: this.$(".difficultySetting-" + _$.state.user.get("difficulty"))[0] }, true);
    }

    function loadGame () {
        var file = this.$(".setting-import input")[0].files[0];
        _$.utils.importSave(file, () => {
            this.transitionOut("title", { fullIntro: true });
            TweenMax.to(_$.dom, 1, { opacity: 0, delay: 1 });
            _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
        });
    }

    function exportSaveFile () {
        _$.utils.exportSave();
    }

    function resetUser () {
        this.transitionOut("title", { setup: true, resetUser: true, fullIntro: true });
        TweenMax.to(_$.dom, 1, { opacity: 0, delay: 1 });
        _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.set(this.$(".userSettings_content-settings"), { clearProps: "opacity" });
        tl.set(this.$(".userSettings_content-settings-setting, .userSettings_header-avatar"), { opacity: 0 });
        tl.call(() => {
            this.$(".userSettings_header").slideDown(500);
        });
        tl.to(this.$(".userSettings_header-avatar"), 0.5, { opacity: 1, clearProps:"all" }, tl.recent().endTime() + 0.5);
        tl.staggerTo(this.$(".userSettings_content-settings-setting"), 0.5, { opacity: 1, clearProps:"all" }, 0.1, tl.recent().endTime() - 0.5);
        tl.call(() => {
            this.$(".userSettings_content-save").slideDown(500);
            _$.events.trigger("startUserEvents");
        });

        return this;
    }

    function transitionOut (nextScreen, nextScreenOptions = {}) {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        if (_$.ui.footer.isOpen) {
            tl.add(_$.ui.footer.toggleFooter(), 0);
        }
        tl.call(() => {
            this.$(".userSettings_content-save, .userSettings_content-load").slideUp(500);
        }, null, [], "-=1.5");
        tl.to(this.$(".userSettings_content-settings, .userSettings_header-avatar"), 0.5, { opacity: 0 }, tl.recent().endTime() + 0.5);
        tl.call(() => {
            this.$(".userSettings_header").slideUp(500);
        });
        tl.call(() => {
            onTransitionComplete.call(this);
        }, null, [], tl.recent().endTime() + 0.5);

        function onTransitionComplete () {
            _$.utils.addDomObserver(this.$el, () => {
                _$.events.trigger("startUserEvents");

                if (nextScreen === "title") {
                    var Screen_Title = require("views/screen_title");
                    _$.ui.screen = new Screen_Title(nextScreenOptions);
                } else if (nextScreen === "rulesSelect") {
                    var Screen_RulesSelect = require("views/screen_rulesSelect");
                    _$.ui.screen = new Screen_RulesSelect(nextScreenOptions);
                }
            }, true, "remove");

            this.remove();
        }

        return this;
    }

    function toggleLoad (state) {
        if (state === "show") {
            this.$(".userSettings_content-load").css({pointerEvents: ""}).slideDown();
            this.$(".userSettings_content-save").css({pointerEvents: "none"}).slideUp();
        } else if (state === "hide") {
            this.$(".userSettings_content-load").css({pointerEvents: "none"}).slideUp();
            this.$(".userSettings_content-save").css({pointerEvents: ""}).slideDown();
        }
    }

    function validateInput (input) {
        var value = $(input).val().trim();
        var check;

        if (input === this.$(".setting-name input")[0]) {
            check = value.length && !value.match(/\W/g);
        } else if (input === this.$(".setting-avatar input")[0]) {
            check = !input.files.length || !!input.files[0].name.match(/\.jpg|\.jpeg|\.png|\.gif$/);
        } else if (input === this.$(".setting-import input")[0]) {
            check = !input.files.length || input.files[0].name.endsWith("." + _$.appInfo.extension);
        }

        if (check) {
            if ($(input).hasClass("is--invalid")) {
                $(input).removeClass("is--invalid");
            }
        } else {
            if (!$(input).hasClass("is--invalid")) {
                $(input).addClass("is--invalid");
            }
        }

        if (this.$(".setting-name input, .setting-avatar input, .setting-import input").hasClass("is--invalid")) {
            if (this.$(".userSettings_content-save").is(":visible")) {
                this.$(".userSettings_content-save").css({pointerEvents: "none"}).slideUp();
            }

            if (this.$(".userSettings_content-load").is(":visible")) {
                this.$(".userSettings_content-load").css({pointerEvents: "none"}).slideUp();
            }
        } else {
            if (input === $(".setting-import input")[0]) {
                if (!input.files.length && this.$(".userSettings_content-load").is(":visible")) {
                    this.toggleLoad("hide");
                } else if (input.files.length && !this.$(".userSettings_content-load").is(":visible")) {
                    this.toggleLoad("show");
                }
            } else if (!this.$(".userSettings_content-save, .userSettings_content-load").is(":visible")) {
                this.$(".userSettings_content-save").css({pointerEvents: ""}).slideDown();
            }
        }
    }
});
