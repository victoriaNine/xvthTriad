define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "text!templates/templ_overlayRankings.ejs"
], function Screen_OverlayRankings ($, _, Backbone, _$, Screen, Templ_OverlayRankings) {
    const RANKINGS = ["aceOfCards", "theCollector"];

    return Screen.extend({
        id       : "screen_overlayRankings",
        template : _.template(Templ_OverlayRankings),
        events   : {
            "click .rankings_rankinglist-element-ranking" : function (e) {
                _$.audio.audioEngine.playSFX("uiConfirm");
                var rankingName = e.currentTarget.className.match(RANKINGS.join("|"))[0];
                if (rankingName !== this.currentRanking) { this.showRanking(rankingName); }
            }
        },

        initialize,
        transitionIn,
        transitionOut,
        close,
        setupRanking,
        showRanking
    });

    function initialize (options) {
        Screen.prototype.initialize.call(this);

        this.$el.html(this.template());
        var logo = $(_$.assets.get("svg.ui.logo"));
        this.$(".rankings_leaderboard-logo").append(logo);

        this.defaultRanking = RANKINGS[0];
        this.currentRanking = null;
        this.rankingData    = {};
        this.ranksDom       = {};

        this.rankingListTmpl = this.$(".rankings_rankinglist-element-ranking")[0].outerHTML;
        this.$(".rankings_rankinglist-element-ranking").remove();
        this.rankerTmpl      = this.$(".rankings_leaderboard-ranks-rank-ranker")[0].outerHTML;
        this.$(".rankings_leaderboard-ranks-rank-ranker").remove();
        this.ranksTmpl       = this.$(".rankings_leaderboard-ranks-wrapper")[0].outerHTML;
        this.$(".rankings_leaderboard-ranks-wrapper").remove();

        var promises = [];
        _.each(RANKINGS, (rankingName) => {
            promises.push(new Promise((resolve, reject) => {
                _$.comm.socketManager.emitBatch("getRanking", { name: rankingName }, (response) => {
                    resolve(response);
                });
            }));
        });

        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);

        Promise.all(promises).then((responses) => {
            _.each(responses, (response) => {
                this.rankingData[response.msg.name] = response.msg;
                this.setupRanking(this.rankingData[response.msg.name]);
            });

            this.$(".rankings_leaderboard-ranks-scroll").append(this.ranksDom[this.currentRanking]);
            this.add();
        });
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.to(_$.ui.screen.$el, 0.5, { opacity: 0 });
        tl.from(this.$(".rankings_main"), 0.5, { opacity : 0, scale: 1.25, clearProps: "all" });
        tl.from(this.$(".rankings_leaderboard-logo"), 0.5, { opacity : 0, scale: 0.85, clearProps: "all" }, 0);
        tl.from(this.$(".rankings_leaderboard-ranks-scroll"), 0.5, { opacity : 0, clearProps: "all" }, 0.25);
        tl.call(() => {
            _$.events.trigger("startUserEvents");
            _$.events.trigger("rankingsOpen");
        });

        return this;
    }

    function transitionOut (nextScreen) {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.to(this.$(".rankings_leaderboard-logo"), 0.5, { opacity : 0, scale: 0.85 });
        tl.to(this.$(".rankings_main"), 0.5, { opacity : 0, scale: 1.25 }, 0.25);
        tl.to(_$.ui.screen.$el, 0.5, { opacity: 1, clearProps: "opacity" });
        tl.call(onTransitionComplete.bind(this));

        function onTransitionComplete () {
            _$.utils.addDomObserver(this.$el, () => {
                _$.events.trigger("startUserEvents");
                _$.events.trigger("rankingsClosed");

                if (nextScreen && nextScreen !== _$.ui.screen.id.replace("screen_", "")) {
                    _$.ui.screen.transitionOut(nextScreen, { fromMenu: true });
                }
            }, true, "remove");
            this.remove();
        }

        return this;
    }

    function showRanking (rankingName) {
        _$.app.track("send", "event", {
            eventCategory : "rankingEvent",
            eventAction   : rankingName
        });

         _$.events.trigger("stopUserEvents");
        var tl = new TimelineMax();

        tl.call(() => {
            console.log(rankingName, this.currentRanking);
            this.$(".ranking-" + this.currentRanking + ", .ranking-" + rankingName).toggleClass("is--selected");
        });
        tl.to(this.$(".rankings_leaderboard-ranks-scroll"), 0.5, { opacity : 0 });
        tl.call(() => {
            this.$(".rankings_leaderboard-ranks-scroll").html(this.ranksDom[rankingName]);
        });
        tl.to(this.$(".rankings_leaderboard-ranks-scroll"), 0.5, { opacity : 1, clearProps: "all" });
        tl.call(() => {
            _$.events.trigger("startUserEvents");
            this.currentRanking = rankingName;
        });
    }

    function close () {
        _$.ui.footer.toggleRankings();
    }

    function setupRanking (rankingData) {
        var leader        = rankingData.ranks[0];
        var defaultAvatar = _$.assets.get("img.avatars.user_default").src;

        // We add the ranking to the list of rankings
        var rankingListDom = $(this.rankingListTmpl).addClass("ranking-" + rankingData.name);
        var leaderAvatar   = rankingListDom.find(".rankings_rankinglist-element-ranking-avatar-img");
        var leaderLabel    = rankingListDom.find(".rankings_rankinglist-element-ranking-label-leader");

        rankingListDom.find(".rankings_rankinglist-element-ranking-label-name").text(rankingData.title);

        if (rankingData.name === this.defaultRanking) {
            rankingListDom.addClass("is--selected");
            this.currentRanking = rankingData.name;
        }

        if (leader.filler) {
            leaderAvatar.css("backgroundImage", "url(" + defaultAvatar + ")");
        } else {
            leaderAvatar.css("backgroundImage", "url(" + leader.avatar + ")");
            leaderLabel.find("span").eq(0).text(leader.name);
            leaderLabel.find(".weight-bold").text(leader[rankingData.sortBy]);
        }

        this.$(".rankings_rankinglist-scroll").append(rankingListDom);

        // We create the ranking's table
        var ranksDom    = $(this.ranksTmpl).addClass("ranks-" + rankingData.name);
        var rankInfoDom = ranksDom.find(".rankings_leaderboard-ranks-rank-info");

        var dateDom     = rankInfoDom.find(".rank-date");
        dateDom.find("span").eq(0).text(_$.utils.getFormattedDate(rankingData.date.from).date);
        dateDom.find("span").eq(1).text(_$.utils.getFormattedDate(rankingData.date.to).date);
        dateDom.find("span").eq(2).text(_$.utils.getFormattedDate(rankingData.date.from).time);

        var statsLabel, rateLabel;
        if (rankingData.name === "aceOfCards") {
            statsLabel = "Wins / Total";
            rateLabel  = "Win rate";
        } else if (rankingData.name === "theCollector") {
            statsLabel = "Total cards";
            rateLabel  = "Unique";
        }

        rankInfoDom.find(".rank-stats").text(statsLabel);
        rankInfoDom.find(".rank-rate").text(rateLabel);
        rankInfoDom.find(".rank-points").text("Points");

        var prevRank      = { sortBy: +Infinity, rankNb: 1 };
        var rankNb        = 0;
        var rankRankerDom;

        _.each(rankingData.ranks, (rank, index) => {
            if (rank[rankingData.sortBy] === prevRank.sortBy && !rank.filler) {
                rankNb = prevRank.rankNb;
            } else {
                rankNb = index + 1;
            }

            prevRank.sortBy = rank[rankingData.sortBy];
            prevRank.rankNb = rankNb;

            rankRankerDom = $(this.rankerTmpl);
            rankRankerDom.find(".rank-number").text(rankNb);

            if (rank.filler) {
                rankRankerDom.find(".rankings_leaderboard-ranks-rank-ranker-avatar-img").css("backgroundImage", "url(" + defaultAvatar + ")");
            } else {
                rankRankerDom.find(".rankings_leaderboard-ranks-rank-ranker-avatar-img").css("backgroundImage", "url(" + rank.avatar + ")");
                rankRankerDom.find(".rank-rankerInfo-name").text(rank.name);

                rankRankerDom.find(".rank-stats").text(rank.stats);
                rankRankerDom.find(".rank-rate").text(rank.rate);
                rankRankerDom.find(".rank-points").text(rank.points);

                if (rankNb === 1) {
                    rankRankerDom.addClass("firstPlace");
                    rankRankerDom.find(".rank-rankerInfo-title").text(rankingData.title);
                    rankRankerDom.find(".rank-insigna").append($("<div>").addClass("insigna insigna-gold"));
                } else if (rankNb === 2) {
                    rankRankerDom.find(".rank-insigna").append($("<div>").addClass("insigna insigna-silver"));
                } else if (rankNb === 3) {
                    rankRankerDom.find(".rank-insigna").append($("<div>").addClass("insigna insigna-bronze"));
                }

                if (rank.country) {
                    rankRankerDom.find(".rank-flag").append($("<div>").addClass("flag-icon flag-icon-" + _.lowerCase(rank.country)));
                }
            }

            ranksDom.append(rankRankerDom);
        });

        this.ranksDom[rankingData.name] = ranksDom;
    }
});
