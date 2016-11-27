define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "text!templates/templ_albumCard.html",
    "views/elem_card",
    "tweenMax"
], function Elem_AlbumCard ($, _, Backbone, _$, Templ_AlbumCard, Elem_Card) {
    return Backbone.View.extend({
        tagName               : "li",
        className             : "cardSelect_content-album-card",

        template : _.template(Templ_AlbumCard),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "mousedown .card"  : dragCardStart
        },

        initialize,
        render,
        moveInDeck,
        moveToOrigin
    });

    function initialize (options) {
        this.cardView         = new Elem_Card({ model: options.card });
        this.copiesCount      = options.copiesCount;
        this.card             = null;
        this.holder           = null;
        this.originalPosition = null;

        this.$el.html(this.template({
            name: this.cardView.model.get("name"),
            copiesCount: this.copiesCount
        }));

        this.$(".cardSelect_content-album-card-visual").append(this.cardView.$el);
    }

    function render () {
        this.$(".cardSelect_content-album-card-copiesCount").text((this.copiesCount < 10) ? "0" + this.copiesCount : this.copiesCount);
        return this;
    }

    function dragCardStart (e) {
        var that  = this;
        var prevX = e.pageX;
        var prevY = e.pageY;

        if (!that.card) {
            that.card             = that.cardView.$el[0];
            that.originalPosition = _$.utils.getAbsoluteOffset(that.card);
        }

        if (this.holder) {
            TweenMax.set(that.card, { zIndex: 1000 });
        } else {
            TweenMax.set(that.card, {
                position:"fixed",
                left:0,
                top:0,
                x: that.originalPosition.left,
                y: that.originalPosition.top,
                zIndex: 1000
            });
        }

        $(window).on("mousemove", dragCard);
        $(window).on("mouseup", dragCardStop);

        function dragCard (e) {
            var deltaX = e.pageX - prevX;
            var deltaY = e.pageY - prevY;

            TweenMax.set(that.card, {
                x: that.card._gsTransform.x + deltaX * 1.5,
                y: that.card._gsTransform.y + deltaY * 1.5
            });

            prevX = e.pageX;
            prevY = e.pageY;
        }

        function dragCardStop (e) {
            $(window).off("mousemove", dragCard);
            $(window).off("mouseup", dragCardStop);

            var scaledPageX = e.pageX * window.devicePixelRatio;
            var scaledPageY = e.pageY * window.devicePixelRatio;

            var deckOffset   = _$.utils.getAbsoluteOffset($(".cardSelect_header-deck"));
            var deckPosition = {
                x1: deckOffset.left,
                x2: deckOffset.left + $(".cardSelect_header-deck").width(),
                y1: deckOffset.top,
                y2: deckOffset.top + $(".cardSelect_header-deck").height()
            };

            var nearestHolder = $.nearest({x: e.pageX, y: e.pageY}, $(".cardSelect_header-deck-holder"))[0];
            var holderOffset  = _$.utils.getAbsoluteOffset(nearestHolder);

            var tl = new TimelineMax();
            if (scaledPageX >= deckPosition.x1 && scaledPageX <= deckPosition.x2 && scaledPageY >= deckPosition.y1 && scaledPageY <= deckPosition.y2) {
                that.moveInDeck(nearestHolder);
            } else {
                that.moveToOrigin();
            }
        }
    }

    function moveInDeck (holder, reorderingDeck) {
        var holderOffset  = _$.utils.getAbsoluteOffset(holder);

        var tl = new TimelineMax();
        tl.to(this.card, 0.2, { x: holderOffset.left, y: holderOffset.top });
        tl.set(this.card, { scale: "1", zIndex:999 }, "+=.1");

        if (!reorderingDeck) {
            _$.events.trigger("updateDeck", {
                action   : "add",
                cardView : this,
                moveFrom : this.holder,
                moveTo   : holder
            });
        }

        if (!this.holder) {
            this.copiesCount--;
        }

        this.holder = holder;
        this.render();
    }

    function moveToOrigin (reorderingDeck) {
        var tl = new TimelineMax();
        tl.to(this.card, 0.2, { x: this.originalPosition.left, y: this.originalPosition.top });
        tl.set(this.card, { clearProps: "all" }, "+=.1");

        if (!reorderingDeck) {
            _$.events.trigger("updateDeck", {
                action   : "remove",
                cardView : this,
                moveFrom : this.holder,
                moveTo   : null
            });
        }

        if (this.holder) {
            this.copiesCount++;
        }

        this.holder = null;
        this.render();
    }
});
