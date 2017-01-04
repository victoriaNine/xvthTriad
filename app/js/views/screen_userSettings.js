define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "text!templates/templ_userSettings.html"
], function Screen_UserSettings ($, _, Backbone, _$, Screen, Templ_UserSettings) {
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
            "click .userSettings_content-save-choice-backBtn"    : function () {
                this.transitionOut("title");
            },
            "click .userSettings_content-load-choice-loadBtn"    : "loadGame",
            "click .userSettings_content-load-choice-cancelBtn"  : function () {
                $(".setting-import input").val("");
                this.toggleLoad("hide");
            },
            "keyup .setting-name input"                          : _.debounce(function (e) {
                this.validateInput(e.target);
            }, 250),
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
        remove,

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

        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        this.add();
    }

    function remove () {
        Screen.prototype.remove.call(this);
        $(window).off("click.toggleDifficulty");
    }

    function toggleDifficulty (e, auto) {
        var closestValidOption = $(e.target).hasClass("is--disabled") ? $(e.target).parent().children(":not(.is--disabled)").eq(0) : $(e.target);
        var index              = _$.utils.getNodeIndex(closestValidOption);
        var selectHeight       = this.$(".setting-difficulty").height();
        var toggle             = this.$(".setting-difficulty .userSettings_content-settings-setting-toggle");
        var dropdown           = this.$(".userSettings_content-settings-setting-select");

        if (this.$(".setting-difficulty").hasClass("is--active") || auto) {
            if (!auto) {
                $(window).off("click.toggleDifficulty");
                this.$(".setting-difficulty").removeClass("is--active");
            }

            TweenMax.to(dropdown[0], 0.4, { scrollTop: index * selectHeight, delay: 0.6 });
            return;
        } else {
            this.$(".setting-difficulty").addClass("is--active");
        }

        $(window).on("click.toggleDifficulty", (clickEvent) => {
            if (!$(clickEvent.target).parents(".setting-difficulty").length) {
                $(window).off("click.toggleDifficulty");
                var defaultOption      = this.$(".difficultySetting-" + _$.state.user.get("difficulty"));
                var defaultOptionIndex = _$.utils.getNodeIndex(defaultOption);
                this.$(".setting-difficulty").removeClass("is--active");
                TweenMax.to(dropdown[0], 0.4, { scrollTop: defaultOptionIndex * selectHeight, delay: 0.6 });
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
            _$.app.track("set", {
                "dimension0" : "difficulty",
                "metric0"    : "albumSize",
                "metric1"    : "gameStats"
            });
            _$.app.track("send", "event", {
                eventCategory : "userSettingsEvent",
                eventAction   : "saveGame",
                dimension0    : _$.state.user.get("difficulty"),               // difficulty
                metric0       : _$.state.user.get("album").length,             // albumSize
                metric1       : JSON.stringify(_$.state.user.get("gameStats")) // gameStats
            });
            
            _$.app.saveData();
            this.transitionOut("title");
        }
    }

    function resetChanges () {
        this.$(".setting-name input").val(_$.state.user.get("name"));
        $(".setting-avatar input, .setting-import input").val("");
        this.toggleDifficulty({ target: this.$(".difficultySetting-" + _$.state.user.get("difficulty"))[0] }, true);
    }

    function loadGame () {
        if (!_$.debug.debugMode) {
            _$.app.track("send", "event", {
                eventCategory : "userSettingsEvent",
                eventAction   : "loadGame"
            });
        }

        var file = this.$(".setting-import input")[0].files[0];
        _$.app.importSave(file, () => {
            this.transitionOut("title", { fullIntro: true });
            TweenMax.to(_$.dom, 1, { opacity: 0, delay: 1 });
            _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
        });
    }

    function exportSaveFile () {
        _$.app.track("set", {
            "dimension0" : "difficulty",
            "metric0"    : "albumSize",
            "metric1"    : "gameStats"
        });
        _$.app.track("send", "event", {
            eventCategory : "userSettingsEvent",
            eventAction   : "exportSaveFile",
            dimension0    : _$.state.user.get("difficulty"),               // difficulty
            metric0       : _$.state.user.get("album").length,             // albumSize
            metric1       : JSON.stringify(_$.state.user.get("gameStats")) // gameStats
        });

        _$.app.exportSave();
    }

    function resetUser () {
        _$.app.track("set", {
            "dimension0" : "difficulty",
            "metric0"    : "albumSize",
            "metric1"    : "gameStats"
        });
        _$.app.track("send", "event", {
            eventCategory : "userSettingsEvent",
            eventAction   : "resetUser",
            dimension0    : _$.state.user.get("difficulty"),               // difficulty
            metric0       : _$.state.user.get("album").length,             // albumSize
            metric1       : JSON.stringify(_$.state.user.get("gameStats")) // gameStats
        });

        this.transitionOut("title", { setup: true, resetUser: true, fullIntro: true });
        TweenMax.to(_$.dom, 1, { opacity: 0, delay: 1 });
        _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");
        this.resetChanges();

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

    function transitionOut (nextScreen, options) {
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
            this.changeScreen(nextScreen, options);
        }, null, [], tl.recent().endTime() + 0.5);

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
            check = !input.files.length || input.files[0].name.endsWith("." + _$.app.saveExt);
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
                this.$(".userSettings_content-save").css({ pointerEvents: "" }).slideDown();
            }
        }
    }
});
