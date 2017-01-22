define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "text!templates/templ_overlayHelp.ejs",
    "text!templates/templ_helpBasicRules.ejs",
    "text!templates/templ_helpAdvancedRules.ejs",
    "text!templates/templ_helpStartSolo.ejs",
    "text!templates/templ_helpStartVersus.ejs",
    "text!templates/templ_helpChallengePlayer.ejs",
    "text!templates/templ_helpRankings.ejs"
], function Screen_OverlayHelp ($, _, Backbone, _$, Screen, Templ_OverlayHelp) {
    const HELP_TOPICS = "basicRules|advancedRules|startSolo|startVersus|challengePlayer|rankings";

    return Screen.extend({
        id       : "screen_overlayHelp",
        template : _.template(Templ_OverlayHelp),
        events   : {
            "click .help_content-screenNav-choice-backBtn" : "showTopics",
            "click .help_content-topics-topic[class*=topic-]" : function (e) {
                this.showGuide(e.currentTarget.className.match(HELP_TOPICS)[0]);
            },
            "mouseenter .help_content-topics-topic[class*=topic-]" : function (e) {
                this.showHelp(e.currentTarget.className.match(HELP_TOPICS)[0]);
            },
            "mouseleave .help_content-topics-topic" : function (e) {
                this.showHelp();
            },
            "click .help_content-topics-topic[class*=topic-],.help_content-screenNav-choice-element" : function (e) {
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "mouseenter .help_content-topics-topic[class*=topic-],.help_content-screenNav-choice-element" : function (e) {
                _$.audio.audioEngine.playSFX("uiHover");
            }
        },

        initialize,
        transitionIn,
        transitionOut,
        close,
        showGuide,
        showTopics,
        showHelp
    });

    function initialize (options) {
        Screen.prototype.initialize.call(this);

        this.$el.html(this.template());
        this.currentGuide   = null;
        this.guideTemplates = {
            basicRules      : require("text!templates/templ_helpBasicRules.ejs"),
            advancedRules   : require("text!templates/templ_helpAdvancedRules.ejs"),
            startSolo       : require("text!templates/templ_helpStartSolo.ejs"),
            startVersus     : require("text!templates/templ_helpStartVersus.ejs"),
            challengePlayer : require("text!templates/templ_helpChallengePlayer.ejs"),
            rankings        : require("text!templates/templ_helpRankings.ejs")
        };

        this.showHelp();

        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        this.add();
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.to(_$.ui.screen.$el, 0.5, { opacity: 0 });
        tl.from(this.$el, 0.5, { opacity: 0, clearProps: "all" });
        tl.call(() => {
            this.$(".help_header").slideDown(500);
        });
        tl.staggerFrom(this.$(".help_content-topics-topic"), 0.5, { opacity: 0, clearProps:"all" }, 0.1, "+=0.5");
        tl.call(() => {
            _$.events.trigger("startUserEvents");
            _$.events.trigger("helpPageOpen");
        });

        return this;
    }

    function transitionOut (nextScreen) {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.call(() => {
            this.$(".help_content-screenNav").slideUp(500);
        });
        tl.to(this.$(".help_content-topics, .help_content-guide"), 0.5, { opacity: 0 }, "+=0.5");
        tl.call(() => {
            this.$(".help_header").slideUp(500);
        });
        tl.to(this.$el, 0.5, { opacity: 0 });
        tl.to(_$.ui.screen.$el, 0.5, { opacity: 1, clearProps: "opacity" });
        tl.call(onTransitionComplete.bind(this));

        function onTransitionComplete () {
            _$.utils.addDomObserver(this.$el, () => {
                _$.events.trigger("startUserEvents");
                _$.events.trigger("helpPageClosed");

                if (nextScreen && nextScreen !== _$.ui.screen.id.replace("screen_", "")) {
                    _$.ui.screen.transitionOut(nextScreen, { fromMenu: true });
                }
            }, true, "remove");
            this.remove();
        }

        return this;
    }

    function close () {
        _$.ui.footer.toggleHelpPage();
    }

    function showGuide (topicName) {
        _$.app.track("send", "event", {
            eventCategory: "helpEvent",
            eventAction: topicName
        });

        _$.events.trigger("stopUserEvents");

        var title         = this.$(".topic-" + topicName).text();
        var guide         = $("<div>").addClass("help_" + topicName);
        var guideTemplate = _.template(this.guideTemplates[topicName]);
        guide.html(guideTemplate());

        var img;
        $(guide).find("figure").each(function (index, figure) {
            img = _$.assets.get("img.help." + topicName + (index + 1));

            if (img) {
                $(figure).prepend(img);
            }
        });

        var tl = new TimelineMax();
        tl.to(this.$(".help_content-topics"), 0.5, { opacity: 0 });
        tl.set(this.$(".help_content-topics"), { display: "none", clearProps: "opacity" });
        tl.set(this.$(".help_content-guide"), { clearProps: "display" });
        tl.to(this.$(".help_header-title, .help_header-help, hr"), 0.5, { opacity: 0 });
        tl.call(() => {
            this.$(".help_content-guide-scroll").html(guide);
            this.$(".help_header-title-topicName").text(" / " + title);
            this.showHelp(topicName);
        });
        tl.to(this.$(".help_header-title, .help_header-help, hr"), 0.5, { opacity: 1, clearProps: "opacity" });
        tl.fromTo(this.$(".help_content-guide-scroll"), 0.5, { height: 0, opacity: 0 }, { height: "100%", opacity: 1, clearProps: "all" });
        tl.call(() => {
            this.$(".help_content-screenNav").slideDown(500);
            _$.events.trigger("startUserEvents");
            this.currentGuide = topicName;
        });
    }

    function showTopics () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.call(() => { this.$(".help_content-screenNav").slideUp(500); });
        tl.to(this.$(".help_content-guide"), 0.5, { opacity: 0 }, "+=0.5");
        tl.set(this.$(".help_content-guide"), { display: "none", clearProps: "opacity" });
        tl.set(this.$(".help_content-topics"), { clearProps: "display" });
        tl.to(this.$(".help_header-title, .help_header-help, hr"), 0.5, { opacity: 0 });
        tl.call(() => {
            this.$(".help_content-guide-scroll, .help_header-title-topicName").empty();
            this.showHelp();
        });
        tl.to(this.$(".help_header-title, .help_header-help, hr"), 0.5, { opacity: 1, clearProps: "opacity" });
        tl.staggerFrom(this.$(".help_content-topics-topic"), 0.5, { opacity: 0, clearProps:"all" }, 0.1);
        tl.call(() => {
            _$.events.trigger("startUserEvents");
        });
    }

    function showHelp (msgName, asIs) {
        var defaultMsg = "Select a topic to get information on it.";
        var text;

        if (!msgName) {
            text = defaultMsg;
        } else if (asIs) {
            text = msgName;
        } else {
            switch (msgName) {
                case "basicRules":
                    text = "Learn the basic rules of the Fifteenth Triad.";
                    break;
                case "advancedRules":
                    text = "Learn the advanced and special rules of the Fifteenth Triad.";
                    break;
                case "startSolo":
                    text = "How to start a game in Solo mode (play against the computer).";
                    break;
                case "startVersus":
                    text = "How to start a game in Versus mode (play against a friend).";
                    break;
                case "challengePlayer":
                    text = "How to challenge another player in the Lounge Room.";
                    break;
                case "rankings":
                    text = "Learn about the ranking system.";
                    break;
            }
        }

        this.$(".help_header-help").html(text);
    }
});
