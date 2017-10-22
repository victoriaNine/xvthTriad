import $ from 'jquery';
import { each, find, template } from 'lodash';
import Backbone from 'backbone';
import { TweenMax, TimelineMax } from 'gsap';

import _$ from 'utils';
import Comp_Card from 'Components/Card';
import Templ_AlbumCard from './template.ejs';

export default Backbone.View.extend({
  tagName   : "div",
  template  : template(Templ_AlbumCard),
  events    : {
    /* eslint-disable object-shorthand */
    "mousedown .card"  : function (e) { dragCardStart.call(this, e, this.activeCopy); },
    "touchstart .card" : function (e) { dragCardStart.call(this, e, this.activeCopy); }
    /* eslint-enable */
  },

  initialize,
  render,
  moveToDeck,
  moveToOrigin,
  onResize
});

function initialize (options) {
  this.screen           = options.screen;
  this.screenName       = this.screen.id.replace("screen_", "");
  this.cardView         = new Comp_Card({ model: options.card });
  this.totalCopies      = options.copiesCount;
  this.copiesCount      = this.totalCopies;
  this.cardDOM          = this.cardView.$el;
  this.originalPosition = null;
  this.deckHolders      = this.screenName === "cardSelect" ? this.screen.$(".cardSelect_header-rightCol") : null;
  this.holder           = null;
  this.isDraggingCard   = false;
  this.cardCopies       = [];
  this.activeCopy       = null;

  this.$el.html(this.template({
    name        : this.cardView.model.get("name"),
    copiesCount : this.copiesCount,
    screenName  : this.screenName
  }));

  this.$el.addClass(this.screenName + "_content-album-card");
  this.$("." + this.screenName + "_content-album-card-visual").append(this.cardView.$el);

  // We create as many card copies available for drag-and-drop as the user owns
  for (let i = 0; i < this.copiesCount; i++) {
    this.cardCopies.push({
      cardView : this.cardView.$el.clone().addClass("cardCopy"),
      holder   : null
    });
  }

  if (this.screenName === "cardAlbum") {
    this.events = {};
  }

  this.render();
}

function render () {
  // The next active copy for that card will be the one that doesn't have a holder yet
  // Or none at all (if they all have been added to the deck)
  this.activeCopy = find(this.cardCopies, { holder: null }) || null;

  this.$("." + this.screenName + "_content-album-card-copiesCount").text("x" + ((this.copiesCount < 10) ? "0" + this.copiesCount : this.copiesCount));

  if (!this.copiesCount && !this.$el.hasClass("is--disabled")) {
    this.$el.addClass("is--disabled");
  } else if (this.copiesCount && this.$el.hasClass("is--disabled")) {
    this.$el.removeClass("is--disabled");
  }

  return this;
}

function dragCardStart (e, cardCopy) {
  if (this.isDraggingCard || !cardCopy) { return; }
  else if (!this.isDraggingCard) { this.isDraggingCard = true; }

  const that = this;
  let prevX = (e.type === "touchstart") ? e.originalEvent.touches[0].pageX : e.pageX;
  let prevY = (e.type === "touchstart") ? e.originalEvent.touches[0].pageY : e.pageY;

  if (!cardCopy.holder) {
    this.deckHolders.append(cardCopy.cardView);
    cardCopy.cardView.on("mousedown touchstart", (e) => {
      dragCardStart.call(this, e, cardCopy);
    });
  }

  // We add a glowing effect to the remaining card holders
  each(_$.ui.cardSelect.holders, (holder) => {
    if (!holder.cardView) {
      $(holder.dom).addClass("glowing");
    }
  });

  this.originalPosition = _$.utils.getAbsoluteOffset(this.cardDOM);

  if (cardCopy.holder) {
    TweenMax.set(cardCopy.cardView, { zIndex: 1000 });
  } else {
    TweenMax.set(cardCopy.cardView, {
      position : "fixed",
      left     : 0,
      top      : 0,
      x        : this.originalPosition.left,
      y        : this.originalPosition.top
    });

    const tl = new TimelineMax();
    tl.set(cardCopy.cardView, { zIndex: 1000 });
    tl.from(cardCopy.cardView, 0.2, { opacity: 0, clearProps: "opacity" });
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
    const pageX  = (e.type === "touchmove") ? e.originalEvent.touches[0].pageX : e.pageX;
    const pageY  = (e.type === "touchmove") ? e.originalEvent.touches[0].pageY : e.pageY;
    const deltaX = pageX - prevX;
    const deltaY = pageY - prevY;

    TweenMax.set(cardCopy.cardView, {
      x: cardCopy.cardView[0]._gsTransform.x + deltaX * _$.utils.getDragSpeed(),
      y: cardCopy.cardView[0]._gsTransform.y + deltaY * _$.utils.getDragSpeed()
    });

    prevX = pageX;
    prevY = pageY;
  }

  function dragCardStop (e) {
    $(window).off("mousemove touchmove", dragCard);
    $(window).off("mouseup touchend", dragCardStart);
    that.isDraggingCard = false;

    const pageX       = (e.type === "touchend") ? e.originalEvent.changedTouches[0].pageX : e.pageX;
    const pageY       = (e.type === "touchend") ? e.originalEvent.changedTouches[0].pageY : e.pageY;
    const scaledPageX = pageX * _$.ui.window.devicePixelRatio / _$.state.appScalar;
    const scaledPageY = pageY * _$.ui.window.devicePixelRatio / _$.state.appScalar;

    const deckOffset   = _$.utils.getAbsoluteOffset($(".cardSelect_header-deck"));
    const deckPosition = {
      x1: deckOffset.left,
      x2: deckOffset.left + $(".cardSelect_header-deck").outerWidth(),
      y1: deckOffset.top,
      y2: deckOffset.top + $(".cardSelect_header-deck").outerHeight()
    };

    const nearestHolder = $.nearest({ x: scaledPageX, y: scaledPageY }, $(".cardSelect_header-deck-holder"))[0];

    if (scaledPageX >= deckPosition.x1 &&
      scaledPageX <= deckPosition.x2 &&
      scaledPageY >= deckPosition.y1 &&
      scaledPageY <= deckPosition.y2
    ) {
      that.moveToDeck(nearestHolder, cardCopy);
    } else {
      that.moveToOrigin(cardCopy);
    }

    each(_$.ui.cardSelect.holders, (holder) => {
      $(holder.dom).removeClass("glowing");
    });
  }
}

function moveToDeck (holder, cardCopy, reorderingDeck) {
  const holderOffset  = _$.utils.getAbsoluteOffset(holder);

  const tl = new TimelineMax();
  tl.to(cardCopy.cardView, 0.2, { x: holderOffset.left, y: holderOffset.top });
  tl.call(() => {
    _$.audio.audioEngine.playSFX("cardDrop");
  });
  tl.set(cardCopy.cardView, { scale: "1", zIndex:999 }, "+=.1");

  // If we are moving the card to into the deck as a direct result from the user's drag-and-drop
  // (As opposed to a card moving to another slot because it has been replaced by a new one)
  // We notify the screen's view to update the deck: a card has been added
  // The view will take card of reordering the deck if necessary (cards having swapped places, etc.)
  if (!reorderingDeck) {
    this.screen.updateDeck({
      action        : "add",
      albumCardView : this,
      cardCopy,
      moveFrom      : cardCopy.holder,
      moveTo        : holder
    });
  }

  // If the card hadn't been placed in a holder previously (if it's not just swapping places with another card)
  // We decrement the number of copies available for that card
  if (!cardCopy.holder) {
    this.copiesCount--;
  }

  // And we update the card's holder
  cardCopy.holder = holder;
  this.render();
}

function moveToOrigin (cardCopy, reorderingDeck) {
  const tl = new TimelineMax();
  tl.to(cardCopy.cardView, 0.2, { x: this.originalPosition.left, y: this.originalPosition.top });
  tl.to(cardCopy.cardView, 0.2, { opacity: 0 }, "-=.1");
  tl.call(() => { cardCopy.cardView.remove(); });
  tl.set(cardCopy.cardView, { clearProps: "all" }, "+=.1");

  // If we are moving back the card to its original place as a direct result from the user's drag-and-drop
  // (As opposed to a card moving back to its place because it has been replaced by a new one)
  // We notify the screen's view to update the deck: a card has been removed
  // The view will take card of reordering the deck if necessary (cards having swapped places, etc.)
  if (!reorderingDeck) {
    this.screen.updateDeck({
      action        : "remove",
      albumCardView : this,
      cardCopy,
      moveFrom      : cardCopy.holder,
      moveTo        : null
    });
  }

  // If the card had been placed in a holder previously (if the user isn't cancelling their selection mid-drag-and-drop)
  // We increment the number of copies available for that card
  // And we set back the card's previous holder to an empty state
  if (cardCopy.holder) {
    this.copiesCount++;
    cardCopy.holder = null;
  }

  this.render();
}

function onResize () {
  let holderOffset;

  each(this.cardCopies, (cardCopy) => {
    if (cardCopy.holder) {
      holderOffset = _$.utils.getAbsoluteOffset(cardCopy.holder);
      TweenMax.set(cardCopy.cardView, { x: holderOffset.left, y: holderOffset.top });
    }
  });
}
