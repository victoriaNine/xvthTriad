import { isString, isFunction, isFinite, clamp, get, omit, isNil } from 'lodash';
import { TweenMax, Circ, Ease, Power2, TimelineMax } from 'gsap';

import _$ from 'utils';

const ALIASES     = {
  bgm   : {
    menus       : "inDreams",
    game        : "starlitWaltz",
    lounge      : "safeHaven",
    loungeMenus : "impendingPeril",
    loungeGame  : "huntOrBeHunted",
    win         : "daysEndFanfare",
    postWin     : "relaxReflect",
    lose        : "relaxReflectPensive"
  },
  sfx   : {}
};

//===============================
// VOLUME MIXINS
//===============================
class VolumeMixins {
  constructor (audioEngine) {
    this.audioEngine   = audioEngine;
    this.audioCtx      = this.audioEngine.audioCtx;
    this.volume        = 1;
    this.defaultVolume = this.volume;
    this.savedVolume   = this.volume;
    this.gainNode      = this.audioCtx.createGain();
    this.isMuted       = false;
    this.mutedByUser   = false;

    this.fade = {
      options : null,
      tween   : null
    };
  }

  resetVolume () {
    this.setVolume(this.defaultVolume);
  }

  setVolume (gain) {
    this.volume = this.parseVolume(gain);

    if (this.isMuted) {
      this.savedVolume = this.volume;
    } else {
      this.gainNode.gain.value = this.volume;
    }
  }

  rampToVolume (options = {}) {
    options = {
      from      : this.volume,
      to        : this.volume,
      type      : "ramp",
      duration  : 2,
      delay     : 0,
      clearGain : false,
      ...options
    };

    options.from = this.parseVolume(options.from);
    options.to   = this.parseVolume(options.to);

    options.ease = options.type.match("^fadeIn$|^fadeOut$") ? Circ.easeIn : options.ease ? Ease.map[options.ease] : Power2.easeOut;

    this.fade.options = options;
    this.fade.tween   = new TimelineMax();
    TweenMax.lagSmoothing(0);

    this.fade.tween.fromTo(this, options.duration, { volume: options.from }, { volume: options.to, ease: options.ease, delay: options.delay,
      onUpdate   : () => {
        if ((options.type === "fadeIn" && this.isMuted) || (options.type.match("^fadeOut$|^ramp$") && !this.isMuted)) {
          this.gainNode.gain.value = this.volume;
        }
      },
      onComplete : () => {
        if (options.clearGain) {
          this.setVolume(this.defaultVolume);
        }

        if (options.callback) {
          if (isString(options.callback)) {
            // Event
            _$.events.trigger(options.callback, this, this.fade);
          } else {
            // Callback
            options.callback(this, this.fade);
          }
        }

        TweenMax.lagSmoothing(1000, 16);
        this.fade.options = null;
        this.fade.tween   = null;
      }
    });

    return this.fade;
  }

  mute (fade = false, fadeOptions = {}, fromUser = false) {
    if (this.isMuted) {
      return;
    }

    this.savedVolume = this.volume;

    if (fade) {
      this.fadeOut({
        ...fadeOptions,
        callback: () => {
          this.isMuted = true;
          this.mutedByUser = fromUser;

          isFunction(fadeOptions.callback) && fadeOptions.callback();
        }
      });
    } else {
      this.setVolume(0);
      this.isMuted = true;
      this.mutedByUser = fromUser;
    }
  }

  unmute (fade = false, fadeOptions = {}, fromUser = false) {
    if ((this.mutedByUser && !fromUser) || !this.isMuted) {
      return;
    }

    if (fade) {
      this.fadeIn({
        ...fadeOptions,
        to: this.savedVolume,
        callback: () => {
          this.isMuted = false;
          this.mutedByUser = false;

          isFunction(fadeOptions.callback) && fadeOptions.callback();
        }
      });
    } else {
      this.isMuted = false;
      this.mutedByUser = false;
      this.setVolume(this.savedVolume);
    }
  }

  toggleMute (state, fade = false, fadeOptions = {}) {
    if (state) {
      this.mute(fade, fadeOptions);
    } else {
      this.unmute(fade, fadeOptions);
    }
  }

  fadeIn (options = {}) {
    return this.rampToVolume({ ...options, from: 0, type: "fadeIn" });
  }

  fadeOut (options = {}) {
    return this.rampToVolume({ ...options, to: 0, type: "fadeOut" });
  }

  parseVolume (volume) {
    const relativeValue = isString(volume) ? volume.match(/(\+|\-)=(\d+(?:.\d+)?)/) : false; // eslint-disable-line no-useless-escape
    let result;

    if (relativeValue) {
      const operation = relativeValue[1];
      const value     = relativeValue[2];
      result        = this.volume;

      switch (operation) {
        case "+":
          result += parseFloat(value);
          break;
        case "-":
          result -= parseFloat(value);
          break;
      }
    } else {
      result = isFinite(parseFloat(volume)) ? parseFloat(volume) : this.volume;
    }

    return clamp(result, 0, 1);
  }
}


//===============================
// CHANNEL CLASS
//===============================
class Channel extends VolumeMixins {
  constructor (audioEngine, channelName, volume) {
    super(audioEngine);
    this.name = channelName;
    this.volume        = volume || 1;
    this.defaultVolume = this.volume;
    this.resetVolume();
  }
}


//===============================
// AUDIOINSTANCE CLASS
//===============================
class AudioInstance extends VolumeMixins {
  constructor (audioEngine, fileInfo, audioBuffer) {
    super(audioEngine);
    this.name          = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
    this.type          = fileInfo.type.slice(fileInfo.type.indexOf(".") + 1);
    this.meta          = fileInfo.meta || {};
    this.buffer        = audioBuffer;
    this.duration      = this.buffer.duration;
    this.volume        = this.meta.volume || 1;
    this.defaultVolume = this.volume;

    this.source        = null;
    this.gainNode      = null;

    this._eventNameBase = "audio:" + this.type + ":" + this.name + ":";
    this.events         = fileInfo.events || {};
  }

  createSource () {
    this.gainNode      = this.audioCtx.createGain();
    this.source        = this.audioCtx.createBufferSource();
    this.source.buffer = this.buffer;
    this.resetVolume();

    this.source.connect(this.gainNode);
  }

  triggerMute (state) {
    if (state === "toggle") {
      state = !this.muted;
    }

    this.muted = state;

    if (this.muted) {
      this.gainNode.gain.value = 0;
    } else {
      this.gainNode.gain.value = this.volume;
    }
  }

  mute () {
    this.triggerMute(true);
  }
  unMute () {
    this.triggerMute(false);
  }

  toggleMute () {
    this.triggerMute("toggle");
  }
}


//===============================
// BGM CLASS
//===============================
class BGM extends AudioInstance {
  constructor (audioEngine, fileInfo, audioBuffer) {
    super(audioEngine, fileInfo, audioBuffer);

    this.startPoint  = this.meta.start ? _$.utils.timecodeToSecs(this.meta.start) : 0;
    this.endPoint    = (this.meta.loop || !this.meta.end) ? null : _$.utils.timecodeToSecs(this.meta.end);

    // Time stamps (relative to the audio context's time)
    this.startTime   = null;
    this.endTime     = null;
    this.pauseTime   = null;

    // Time positions (relative to duration)
    this.startedAt   = null;
    this.endedAt     = null;
    this.pausedAt    = null;

    this.isPlaying   = false;
    this.hasEnded    = false;
    this.isPaused    = false;

    // Events
    this.events = {
      ...this.events,
      ended: this._eventNameBase + "ended"
    };

    this.createSource();
  }

  createSource () {
    super.createSource();
    this.gainNode.connect(this.audioEngine.channels.bgm.gainNode);
    this.source.loop = this.meta.loop;

    if (this.source.loop) {
      this.source.loopStart = _$.utils.timecodeToSecs(this.meta.loopStart);
      this.source.loopEnd   = _$.utils.timecodeToSecs(this.meta.loopEnd);
    }

    this.source.addEventListener("ended", (e) => { // eslint-disable-line no-unused-vars
      this.endTime   = this.audioCtx.currentTime;
      this.endedAt   = (this.endTime - this.startTime) + this.startedAt;
      this.hasEnded  = true;
      this.isPlaying = false;

      _$.events.trigger(this.events.ended, this);
      this.createSource(); // Regenerate a source
    });
  }

  getState () {
    if (this.hasEnded) {
      return "ended";
    } else if (this.isPaused) {
      return "paused";
    } else if (this.isPlaying) {
      return "playing";
    }

    return "idle";
  }
}


//===============================
// SFX CLASS
//===============================
class SFX extends AudioInstance {
  constructor (audioEngine, fileInfo, audioBuffer) {
    super(audioEngine, fileInfo, audioBuffer);
    this.createSource();
  }

  createSource (channel = "sfx") {
    super.createSource();
    this.gainNode.connect(this.audioEngine.channels[channel].gainNode);

    this.source.addEventListener("ended", (e) => { // eslint-disable-line no-unused-vars
      if (this.events.ended) {
        _$.events.trigger(this.events.ended, this);
      }

      this.createSource(); // Regenerate a source
    });
  }
}


//===============================
// AUDIOENGINE CLASS
//===============================
class AudioEngine {
  constructor () {
    this.audioCtx   = this.getContext();
    this.BGMs       = {};
    this.SFXs       = {};
    this.channels   = {};
    this.currentBGM = null;
    this.crossfade  = {
      from    : null,
      to      : null,
      tween   : null,
      options : null
    };

    if (!this.audioCtx) {
      return;
    }

    this.createChannel("master");
    this.createChannel("bgm");
    this.createChannel("sfx", 0.5);
    this.createChannel("notif", 0.5);
  }

  getContext () {
    if (typeof AudioContext !== "undefined") {
      return new window.AudioContext();
    } else if (typeof webkitAudioContext !== "undefined") {
      return new window.webkitAudioContext();
    } else if (typeof mozAudioContext !== "undefined") {
      return new window.mozAudioContext();
    }

    _$.debug.error("No AudioContext available");
  }

  decode (arrayBuffer, onDecode, onError) {
    this.audioCtx.decodeAudioData(arrayBuffer, onDecode, onError);
  }

  createAudioInstance (fileInfo, arrayBuffer, onSuccess, onError) {
    this.decode(arrayBuffer, onDecode.bind(this), onError);

    function onDecode (audioBuffer) {
      let audioType = fileInfo.type.slice(fileInfo.type.indexOf(".") + 1);

      if (audioType === "bgm") {
        this.createBGM(fileInfo, audioBuffer);
      } else if (audioType === "sfx") {
        this.createSFX(fileInfo, audioBuffer);
      }

      onSuccess(audioBuffer);
    }
  }

  createChannel (channelName, volume) {
    const channel = new Channel(this, channelName, volume);

    if (channel.name === "master") {
      channel.gainNode.connect(this.audioCtx.destination);
    } else {
      channel.gainNode.connect(this.channels.master.gainNode);
    }

    this.channels[channelName] = channel;
  }

  createBGM (fileInfo, audioBuffer) {
    const name = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
    this.BGMs[name] = new BGM(this, fileInfo, audioBuffer);
  }

  createSFX (fileInfo, audioBuffer) {
    const name = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
    this.SFXs[name] = new SFX(this, fileInfo, audioBuffer);
  }

  triggerMute (state, channelName = "master") {
    if (state === "toggle") {
      state = !this.muted;
    }

    this.muted = state;

    if (this.muted) {
      this.channels[channelName].gainNode.gain.value = 0;
    } else {
      this.channels[channelName].gainNode.gain.value = this.channels[channelName].volume;
    }
  }

  mute (channelName) {
    this.triggerMute(true, channelName);
  }
  unMute (channelName) {
    this.triggerMute(false, channelName);
  }

  toggleMute (channelName) {
    this.triggerMute("toggle", channelName);
  }

  getInstanceAlias (name) {
    // Returns the original string if no corresponding alias was found
    return get(ALIASES, name) || name;
  }

  getBGM (name) {
    return this.BGMs[this.getInstanceAlias(name)];
  }

  setBGM (name) {
    if (name !== null) {
      this.currentBGM = this.getBGM(name);
      if (!this.currentBGM) {
        _$.debug.error("BGM", name, "not found.");
        return;
      }
    } else {
      this.currentBGM = null;
    }
  }

  playBGM (options = {}) {
    const bgm = options.name ? this.getBGM(options.name) : this.currentBGM;

    if (!bgm) {
      _$.debug.error("BGM", options.name, "not found.");
      return;
    } else if (bgm.isPlaying) {
      if (options.seeking) {
        bgm.source.addEventListener("ended", (e) => { // eslint-disable-line no-unused-vars
          if (bgm.fade.tween) {
            bgm.fade.tween.kill();
          }
          this.playBGM(options);
        });

        this.stopBGM(name, omit(options, "fadeDuration"));
      } else {
        _$.debug.warn("BGM", bgm.name, "is already playing.");
      }
      return;
    } else if (bgm.hasEnded) {
      // If a playback had previously ended, reinitialize the values
      bgm.endTime   = null;
      bgm.pauseTime = null;
      bgm.endedAt   = null;
      bgm.pausedAt  = null;
    }

    const from      = options.from || bgm.startPoint;
    const to        = options.to ? (to - from) : bgm.endPoint;
    const delay     = options.delay || 0;
    const startTime = this.audioCtx.currentTime + delay;

    bgm.startTime = startTime;
    bgm.startedAt = from;
    bgm.isPlaying = true;
    bgm.hasEnded  = false;
    bgm.isPaused  = false;

    if (options.fadeDuration) {
      if (bgm.fade.tween) {
        bgm.fade.tween.eventCallback("onComplete", null).eventCallback("onStart", null);
      }

      bgm.fadeIn({
        to       : options.fadeTo,
        duration : options.fadeDuration,
        delay,
        ease     : options.fadeEase,
        callback : options.callback
      }).tween.eventCallback("onStart", proceed.bind(this));
    } else {
      proceed.call(this);
    }

    function proceed () {
      if (to) {
        bgm.source.start(startTime, from, to);
      } else {
        bgm.source.start(startTime, from);
      }
    }
  }

  seekToBGM (options = {}) {
    this.playBGM({...options, seeking: true });
  }

  stopBGM (options = {}) {
    const bgm = options.name ? this.getBGM(options.name) : this.currentBGM;

    if (!bgm) {
      _$.debug.error("BGM", options.name, "not found.");
      return;
    } else if (bgm.getState() === "idle" || bgm.getState() === "ended") {
      _$.debug.warn("BGM", bgm.name, "cannot be stopped, it hasn't started yet.");
      return;
    }

    const delay = options.delay || 0;
    let endTime = this.audioCtx.currentTime + delay;

    if (options.fadeDuration) {
      endTime += options.fadeDuration;

      if (bgm.fade.tween) {
        bgm.fade.tween.eventCallback("onComplete", null).eventCallback("onStart", null);
      }

      bgm.fadeOut({
        from      : options.fadeFrom,
        duration  : options.fadeDuration,
        delay,
        ease      : options.fadeEase,
        callback  : options.callback,
        clearGain : isNil(options.clearGain) ? true : options.clearGain
      }).tween.eventCallback("onComplete", proceed.bind(this));
    } else {
      proceed.call(this);
    }

    function proceed () {
      bgm.source.stop(endTime);
    }
  }

  triggerPauseBGM (state, options = {}) {
    const bgm = options.name ? this.getBGM(options.name) : this.currentBGM;

    if (!bgm) {
      _$.debug.error("BGM", options.name, "not found.");
      return;
    }

    const delay   = options.delay || 0;
    let pauseTime = this.audioCtx.currentTime + delay;

    if (state === "toggle") {
      state = !bgm.isPaused;
    }

    if (bgm.getState() === "idle" || bgm.getState() === "ended") {
      _$.debug.warn("BGM", bgm.name, "cannot be paused or resumed, it hasn't started yet. Starting playback.");
      this.playBGM(options);
      return;
    } else if (state && bgm.getState() === "paused") {
      _$.debug.warn("BGM", bgm.name, "is already paused.");
      return;
    }

    if (state) {
      // Pause the BGM
      if (options.fadeDuration) {
        pauseTime += options.fadeDuration;

        if (bgm.fade.tween) {
          bgm.fade.tween.eventCallback("onComplete", null).eventCallback("onStart", null);
        }

        bgm.fadeOut({
          from     : options.fadeFrom,
          duration : options.fadeDuration,
          delay,
          ease     : options.fadeEase,
          callback : options.callback
        }).tween.eventCallback("onComplete", proceed.bind(this));
      } else {
        proceed.call(this);
      }
    } else {
      // Resume the BGM
      this.playBGM(name, { ...options, from: bgm.pausedAt });
    }

    function proceed () {
      bgm.pauseTime = pauseTime;
      bgm.pausedAt  = (bgm.pauseTime - bgm.startTime) + bgm.startedAt;
      bgm.isPaused  = true;
      bgm.isPlaying = false;

      bgm.source.stop(pauseTime);
    }
  }

  pauseBGM (options = {}) {
    this.triggerPauseBGM(true, options);
  }

  resumeBGM (options = {}) {
    this.triggerPauseBGM(false, options);
  }

  togglePauseBGM (options = {}) {
    this.triggerPauseBGM("toggle", options);
  }

  crossfadeBGM (options = {}) {
    const fromBGM = options.from ? this.getBGM(options.from) : this.currentBGM;
    const toBGM   = this.getBGM(options.to);

    if (!fromBGM) {
      _$.debug.error("BGM", options.from, "not found.");
      return;
    } else if (!toBGM) {
      _$.debug.error("BGM", options.to, "not found.");
      return;
    }

    this.crossfade.options = options;
    this.crossfade.from    = fromBGM;
    this.crossfade.to      = toBGM;

    TweenMax.lagSmoothing(0);
    this.crossfade.tween = new TimelineMax({
      onStart    : () => {
        if (options.onStart) {
          if (isString(options.onStart)) {
            // Event
            _$.events.trigger(options.onStart, this.crossfade);
          } else {
            // Callback
            options.onStart(this.crossfade);
          }
        }
      },
      onComplete : () => {
        if (options.onComplete) {
          if (isString(options.onComplete)) {
            // Event
            _$.events.trigger(options.onComplete, this.crossfade);
          } else {
            // Callback
            options.onComplete(this.crossfade);
          }
        }

        TweenMax.lagSmoothing(1000, 16);
        this.crossfade.from    = null;
        this.crossfade.to      = null;
        this.crossfade.options = null;
        this.crossfade.tween   = null;
      }
    });

    this.crossfade.tween.add(this.crossfade.from.fadeOut(omit(options, ["from", "to"])).tween, 0);
    this.crossfade.tween.add(this.crossfade.to.fadeIn(omit(options, ["from", "to"])).tween, 0);

    return this.crossfade;
  }

  getSFX (name) {
    return this.SFXs[this.getInstanceAlias(name)];
  }

  playSFX (name, options = {}) {
    const sfx = this.getSFX(name);
    if (!sfx) {
      _$.debug.error("SFX", name, "not found.");
      return;
    }

    const delay     = options.delay || 0;
    const startTime = this.audioCtx.currentTime + delay;

    sfx.createSource(); // Regenerate a source for the SFX
    if (options.volume) {
      sfx.setVolume(options.volume);
    }
    sfx.source.start(startTime);
  }

  getNotif (name) {
    return this.SFXs[this.getInstanceAlias(name)];
  }

  playNotif (name, options = {}) {
    const notif = this.getNotif(name);
    if (!notif) {
      _$.debug.error("Notif", name, "not found.");
      return;
    }

    const delay     = options.delay || 0;
    const startTime = this.audioCtx.currentTime + delay;

    notif.createSource("notif"); // Regenerate a source for the Notif
    if (options.volume) {
      notif.setVolume(options.volume);
    }
    notif.source.start(startTime);
  }
}

export default AudioEngine;
