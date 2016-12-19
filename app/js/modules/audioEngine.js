define(["underscore", "global"], function audioEngine (_, _$) {
    //===============================
    // AUDIOENGINE CLASS
    //===============================
    class AudioEngine {
        constructor () {
            this.audioCtx   = new window.AudioContext();
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

            this.createChannel("master");
            this.createChannel("bgm");
            this.createChannel("sfx");
        }

        decode (arrayBuffer, onDecode, onError) {
            this.audioCtx.decodeAudioData(arrayBuffer, onDecode, onError);
        }

        createAudioInstance (fileInfo, arrayBuffer, onSuccess, onError) {
            var that = this;
            this.decode(arrayBuffer, onDecode, onError);

            function onDecode (audioBuffer) {
                let audioType = fileInfo.type.slice(fileInfo.type.indexOf(".") + 1);

                if (audioType === "bgm") {
                    that.createBGM(fileInfo, audioBuffer);
                } else if (audioType === "sfx") {
                    that.createSFX(fileInfo, audioBuffer);
                }

                onSuccess(audioBuffer);
            }
        }

        createChannel (channelName) {
            var channel = {
                name     : channelName,
                volume   : 1,
                gainNode : this.audioCtx.createGain()
            };

            if (channel.name === "master") {
                channel.gainNode.connect(this.audioCtx.destination);
            } else {
                channel.gainNode.connect(this.channels.master.gainNode);
            }

            this.channels[channelName] = channel;
        }

        createBGM (fileInfo, audioBuffer) {
            var name = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
            this.BGMs[name] = new BGM(this, fileInfo, audioBuffer);
        }

        createSFX (fileInfo, audioBuffer) {
            var name = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
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

        setBGM (name) {
            if (name !== null) {
                this.currentBGM = this.BGMs[name];
                if (!this.currentBGM) {
                    console.error("BGM", name, "not found.");
                    return;
                }
            } else {
                this.currentBGM = null;
            }
        }

        playBGM (name, options = {}) {
            var bgm = name ? this.BGMs[name] : this.currentBGM;

            if (!bgm) {
                console.error("BGM", name, "not found.");
                return;
            }

            var from      = options.from || bgm.startPoint;
            var to        = options.to ? (to - from) : bgm.endPoint;
            var delay     = options.delay || 0;
            var startTime = this.audioCtx.currentTime + delay;

            if (bgm.isPlaying) {
                console.warn("BGM", bgm.name, "is already playing. Moving playhead to designated start point.");

                bgm.source.addEventListener("ended", (e) => {
                    this.playBGM(name, options);
                });

                this.stopBGM(name, options);
                return;
            } else if (bgm.hasEnded) {
                // If a playback had previously ended, reinitialize the values
                bgm.endTime   = null;
                bgm.pauseTime = null;
                bgm.endedAt   = null;
                bgm.pausedAt  = null;
            }

            bgm.startTime = startTime;
            bgm.startedAt = from;
            bgm.isPlaying = true;
            bgm.hasEnded  = false;
            bgm.isPaused  = false;

            if (to) {
                bgm.source.start(startTime, from, to);
            } else {
                bgm.source.start(startTime, from);
            }
        }

        stopBGM (name, options = {}) {
            var bgm = name ? this.BGMs[name] : this.currentBGM;

            if (!bgm) {
                console.error("BGM", name, "not found.");
                return;
            }

            var delay    = options.delay || 0;
            var stopTime = this.audioCtx.currentTime + delay;

            if (bgm.hasEnded) {
                console.warn("BGM", bgm.name, "has already ended.");
                return;
            }

            bgm.source.stop(stopTime);
            bgm.createSource(); // Regenerate a source for the BGM
        }

        triggerPauseBGM (state, name, options = {}) {
            var bgm = name ? this.BGMs[name] : this.currentBGM;

            if (!bgm) {
                console.error("BGM", name, "not found.");
                return;
            }

            var delay     = options.delay || 0;
            var pauseTime = this.audioCtx.currentTime + delay;

            if (state === "toggle") {
                state = !bgm.isPaused;
            }

            if (bgm.getState() === "idle" || bgm.getState() === "ended") {
                console.warn("BGM", bgm.name, "cannot be paused, it hasn't started yet. Starting playback.");
                this.playBGM(name, options);
                return;
            }

            if (state) {
                // Pause the BGM
                bgm.pauseTime = pauseTime;
                bgm.pausedAt  = (bgm.pauseTime - bgm.startTime) + bgm.startedAt;
                bgm.isPaused  = true;
                bgm.isPlaying = false;

                bgm.source.stop(pauseTime);
                bgm.createSource(); // Regenerate a source for the BGM
            } else {
                // Resume the BGM
                this.playBGM(name, _.extend(options, { from: bgm.pausedAt }));
            }
        }

        pauseBGM (name, options = {}) {
            this.triggerPauseBGM(true, name, options);
        }

        resumeBGM (name, options = {}) {
            this.triggerPauseBGM(false, name, options);
        }

        togglePauseBGM (name, options = {}) {
            this.triggerPauseBGM("toggle", name, options);
        }

        crossfadeBGM (from, to, options = {}) {
            var fromBGM = this.BGMs[from];
            var toBGM   = this.BGMs[to];

            if (!fromBGM) {
                console.error("BGM", from, "not found.");
                return;
            } else if (!toBGM) {
                console.error("BGM", to, "not found.");
                return;
            }

            this.crossfade.options = options;
            this.crossfade.from    = fromBGM;
            this.crossfade.to      = toBGM;

            TweenMax.lagSmoothing(0);
            this.crossfade.tween = new TimelineMax({
                onComplete: () => {
                    if (options.callback) {
                        if (_.isString(options.callback)) {
                            // Event
                            _$.events.trigger(options.callback, this.crossfade);
                        } else {
                            // Callback
                            options.callback(this.crossfade);
                        }
                    }

                    TweenMax.lagSmoothing(1000, 16);
                    this.crossfade.from    = null;
                    this.crossfade.to      = null;
                    this.crossfade.options = null;
                    this.crossfade.tween   = null;
                }
            });

            this.crossfade.tween.add(this.crossfade.from.fadeOut(_.omit(options, "callback")).tween, 0);
            this.crossfade.tween.add(this.crossfade.to.fadeIn(_.omit(options, "callback")).tween, 0);

            return this.crossfade;
        }

        playSFX (name, options = {}) {
            var sfx = this.SFXs[name];
            if (!sfx) {
                console.error("SFX", name, "not found.");
                return;
            }

            var delay     = options.delay || 0;
            var startTime = this.audioCtx.currentTime + delay;

            sfx.createSource(); // Regenerate a source for the SFX
            sfx.source.start(startTime);
        }
    }


    //===============================
    // AUDIOINSTANCE CLASS
    //===============================
    class AudioInstance {
        constructor (audioEngine, fileInfo, audioBuffer) {
            this.audioEngine = audioEngine;
            this.audioCtx    = this.audioEngine.audioCtx;
            this.name        = fileInfo.name.slice(0, fileInfo.name.indexOf("."));
            this.meta        = fileInfo.meta;
            this.buffer      = audioBuffer;
            this.duration    = this.buffer.duration;
            this.volume      = this.meta.volume || 1;

            this.source      = null;
            this.gainNode    = null;
        }

        createSource () {
            this.gainNode      = this.audioCtx.createGain();
            this.source        = this.audioCtx.createBufferSource();
            this.source.buffer = this.buffer;

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

            this.fade        = {
                options : null,
                tween   : null
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

            this.source.addEventListener("ended", (e) => {
                if (!this.isPaused) {
                    this.endTime   = this.audioCtx.currentTime;
                    this.endedAt   = (this.stopTime - this.startTime) + this.startedAt;
                    this.hasEnded  = true;
                    this.isPlaying = false;
                }
            });
        }

        getState () {
            if (this.hasEnded) {
                return "ended";
            } else if (this.isPaused) {
                return "paused";
            } else if (this.isPlaying) {
                return "playing";
            } else {
                return "idle";
            }
        }

        setVolume (gain) {
            this.volume = gain;
            this.gainNode.gain.value = this.volume;
        }

        rampToVolume (options = {}) {
            options = _.defaults(options, {
                from     : this.volume,
                to       : this.volume,
                type     : "ramp",
                duration : 3,
                delay    : 0,
                ease     : (options.type === "fadeIn") ? Circ.easeIn : (options.type === "fadeOut") ? Circ.easeIn : Power2.easeOut
            });

            this.fade.options = options;
            this.fade.tween   = new TimelineMax();
            TweenMax.lagSmoothing(0);

            this.fade.tween.fromTo(this, options.duration, { volume: options.from }, { volume: options.to, ease: options.ease, delay: options.delay,
                onUpdate   : () => {
                    this.gainNode.gain.value = this.volume;
                },
                onComplete : () => {
                    if (options.callback) {
                        if (_.isString(options.callback)) {
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

        fadeIn (options = {}) {
            return this.rampToVolume(_.extend(options, { from: 0, type: "fadeIn" }));
        }

        fadeOut (options = {}) {
            return this.rampToVolume(_.extend(options, { to: 0, type: "fadeOut" }));
        }
    }


    //===============================
    // SFX CLASS
    //===============================
    class SFX extends AudioInstance {
        constructor (audioEngine, fileInfo, audioBuffer) {
            super(audioEngine, fileInfo, audioBuffer);
        }

        createSource () {
            super.createSource();
            this.gainNode.connect(this.audioEngine.channels.sfx.gainNode);
        }
    }

    return AudioEngine;
});
