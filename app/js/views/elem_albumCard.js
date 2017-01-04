define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "text!templates/templ_albumCard.html",
    "views/elem_card"
], function Elem_AlbumCard ($, _, Backbone, _$, Templ_AlbumCard, Elem_Card) {
    return Backbone.View.extend({
        tagName               : "li",
        className             : "cardSelect_content-album-card",

        template : _.template(Templ_AlbumCard),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "mousedown .card"   : function (e) { dragCardStart.call(this, e, this.activeCopy); },
            "touchstart .card"  : function (e) { dragCardStart.call(this, e, this.activeCopy); }
        },

        initialize,
        remove,
        render,
        moveToDeck,
        moveToOrigin,
        onResize
    });

    function initialize (options) {
        this.cardView         = new Elem_Card({ model: options.card });
        this.totalCopies      = options.copiesCount;
        this.copiesCount      = this.totalCopies;
        this.cardDOM          = null;
        this.holder           = null;
        this.originalPosition = null;
        this.deckHolders      = null;
        this.isDraggingCard   = false;
        this.cardCopies       = [];

        this.$el.html(this.template({
            name        : this.cardView.model.get("name"),
            copiesCount : this.copiesCount
        }));

        this.$(".cardSelect_content-album-card-visual").append(this.cardView.$el);

        for (let i = 0; i < this.copiesCount; i++) {
            this.cardCopies.push({
                card   : this.cardView.$el.clone().addClass("cardCopy"),
                holder : null
            });
        }

        _$.events.on("resize", this.onResize, this);
        this.render();
    }

    function remove () {
        _$.events.off("resize", this.onResize, this);
        Backbone.View.prototype.remove.call(this);
    }

    function render () {
        this.activeCopy = _.find(this.cardCopies, { holder: null }) || null;
        this.$(".cardSelect_content-album-card-copiesCount").text("x" + ((this.copiesCount < 10) ? "0" + this.copiesCount : this.copiesCount));

        if (!this.copiesCount && !this.$el.hasClass("is--disabled")) {
            this.$el.addClass("is--disabled");
        } else if (this.copiesCount && this.$el.hasClass("is--disabled")) {
            this.$el.removeClass("is--disabled");
        }

        return this;
    }

    function dragCardStart (e, cardCopy) {
        if (this.isDraggingCard) {
            return;
        } else {
            this.isDraggingCard = true;
        }

        var that  = this;
        var prevX = ("ontouchstart" in window) ? e.originalEvent.touches[0].pageX : e.pageX;
        var prevY = ("ontouchstart" in window) ? e.originalEvent.touches[0].pageY : e.pageY;

        if (e.delegateTarget === this.el) {
            if (!this.copiesCount) {
                return;
            } else {
                if (!this.cardDOM) {
                    this.cardDOM     = this.cardView.$el;
                    this.deckHolders = $(".cardSelect_header-rightCol");
                }

                this.deckHolders.append(cardCopy.card);
                cardCopy.card.on("mousedown touchstart", (e) => {
                    dragCardStart.call(this, e, cardCopy);
                });
            }
        }

        _.each(_$.ui.cardSelect.holders, function (holder) {
            if (!holder.card) {
                $(holder.dom).addClass("glowing");
            }
        });

        this.originalPosition = _$.utils.getAbsoluteOffset(this.cardDOM);

        if (cardCopy.holder) {
            TweenMax.set(cardCopy.card, { zIndex: 1000 });
        } else {
            TweenMax.set(cardCopy.card, {
                position : "fixed",
                left     : 0,
                top      : 0,
                x        : this.originalPosition.left,
                y        : this.originalPosition.top,
                zIndex   : 1000
            });
        }

        $(window).on("mousemove touchmove", dragCard);

        if (_$.state.user.get("placingMode") === "dragDrop") {
            $(window).one("mouseup touchend", dragCardStop);
        } else {
            $(window).one("mouseup touchend", () => {
                $(window).one("mouseup touchend", dragCardStop);
            });
        }

        _$.audio.audioEngine.playSFX("cardGrab");

        function dragCard (e) {
            var pageX  = ("ontouchstart" in window) ? e.originalEvent.touches[0].pageX : e.pageX;
            var pageY  = ("ontouchstart" in window) ? e.originalEvent.touches[0].pageY : e.pageY;
            var deltaX = pageX - prevX;
            var deltaY = pageY - prevY;

            TweenMax.set(cardCopy.card, {
                x: cardCopy.card[0]._gsTransform.x + deltaX * _$.utils.getDragSpeed(),
                y: cardCopy.card[0]._gsTransform.y + deltaY * _$.utils.getDragSpeed()
            });

            prevX = pageX;
            prevY = pageY;
        }

        function dragCardStop (e) {
            $(window).off("mousemove touchmove", dragCard);
            that.isDraggingCard = false;

            var pageX       = ("ontouchstart" in window) ? e.originalEvent.changedTouches[0].pageX : e.pageX;
            var pageY       = ("ontouchstart" in window) ? e.originalEvent.changedTouches[0].pageY : e.pageY;
            var scaledPageX = pageX * window.devicePixelRatio / _$.state.appScalar;
            var scaledPageY = pageY * window.devicePixelRatio / _$.state.appScalar;

            var deckOffset   = _$.utils.getAbsoluteOffset($(".cardSelect_header-deck"));
            var deckPosition = {
                x1: deckOffset.left,
                x2: deckOffset.left + $(".cardSelect_header-deck").outerWidth(),
                y1: deckOffset.top,
                y2: deckOffset.top + $(".cardSelect_header-deck").outerHeight()
            };

            var nearestHolder = $.nearest({ x: scaledPageX, y: scaledPageY }, $(".cardSelect_header-deck-holder"))[0];

            if (scaledPageX >= deckPosition.x1 &&
                scaledPageX <= deckPosition.x2 &&
                scaledPageY >= deckPosition.y1 &&
                scaledPageY <= deckPosition.y2) {
                that.moveToDeck(nearestHolder, cardCopy);
            } else {
                that.moveToOrigin(cardCopy);
            }

            _.each(_$.ui.cardSelect.holders, function (holder) {
                $(holder.dom).removeClass("glowing");
            });
        }
    }

    function moveToDeck (holder, cardCopy, reorderingDeck) {
        var holderOffset  = _$.utils.getAbsoluteOffset(holder);

        var tl = new TimelineMax();
        tl.to(cardCopy.card, 0.2, { x: holderOffset.left, y: holderOffset.top });
        tl.call(() => {
            _$.audio.audioEngine.playSFX("cardDrop");
        });
        tl.set(cardCopy.card, { scale: "1", zIndex:999 }, "+=.1");

        if (cardCopy.holder) {
            _$.ui.cardSelect.holders[cardCopy.holder.id].card = null;
        }

        if (!reorderingDeck) {
            _$.events.trigger("updateDeck", {
                action        : "add",
                albumCardView : this,
                moveFrom      : cardCopy.holder,
                moveTo        : holder
            });
        }

        if (!cardCopy.holder) {
            this.copiesCount--;
        }

        _$.ui.cardSelect.holders[holder.id].card = cardCopy;
        cardCopy.holder = holder;
        this.render();
    }

    function moveToOrigin (cardCopy, reorderingDeck) {
        var tl = new TimelineMax();
        if (_$.dom[0].contains(this.cardDOM[0])) {
            tl.to(cardCopy.card, 0.2, { x: this.originalPosition.left, y: this.originalPosition.top });
        } else {
            tl.to(cardCopy.card, 0.2, { opacity: 0 });
        }
        tl.call(() => { cardCopy.card.remove(); });
        tl.set(cardCopy.card, { clearProps: "all" }, "+=.1");

        if (!reorderingDeck) {
            _$.events.trigger("updateDeck", {
                action        : "remove",
                albumCardView : this,
                moveFrom      : cardCopy.holder,
                moveTo        : null
            });
        }

        if (cardCopy.holder) {
            this.copiesCount++;
            _$.ui.cardSelect.holders[cardCopy.holder.id].card = null;
        }
        
        cardCopy.holder = null;
        this.render();
    }

    function onResize () {
        var holderOffset;

        _.each(this.cardCopies, function (cardCopy) {
            if (cardCopy.holder) {
                holderOffset = _$.utils.getAbsoluteOffset(cardCopy.holder);
                TweenMax.to(cardCopy.card, 0.2, { x: holderOffset.left, y: holderOffset.top });
            }
        });
    }
});
