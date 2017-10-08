import { random } from 'lodash';

class Firefly {
    constructor (canvas, timer = 0, drawAreaWidth = canvas.width, drawAreaHeight = canvas.height, options = {}) {
        this.ctx            = canvas.getContext("2d");
        this.options        = {
            FPS             : 60,
            maxLifeTime     : 200,
            minLifeTime     : 20,
            maxSize         : 100,
            minSize         : 40,
            maxSpeed        : 15,
            minSpeed        : 6,
            maxVarianceX    : 20,
            minOpacity      : 0.25,
            maxOpacity      : 0.75,
            firefliesColors : ["255, 255, 255"],
            ...options
        };

        this.x;
        this.varianceX;
        this.y;

        this.size;
        this.speed;
        this.opacity;
        this.color;

        this.lifeTime;
        this.startTime;

        this.drawAreaWidth;
        this.drawAreaHeight;

        this.onResize({ drawAreaWidth: drawAreaWidth, drawAreaHeight: drawAreaHeight });
        this.init(timer);
    }

    init (timer) {
        this.size      = parseFloat(random(this.options.minSize, this.options.maxSize, true).toFixed(2));
        this.speed     = parseFloat(random(this.options.minSpeed, this.options.maxSpeed, true).toFixed(2));
        this.opacity   = parseFloat(random(this.options.minOpacity, this.options.maxOpacity, true).toFixed(2));
        this.color     = this.options.firefliesColors[Math.floor(Math.random() * this.options.firefliesColors.length)];

        this.x         = parseFloat((Math.random() * this.drawAreaWidth).toFixed(2));
        this.varianceX = parseFloat(random(0, this.options.maxVarianceX, true).toFixed(2)) * (this.speed / this.options.maxSpeed);
        this.y         = this.drawAreaHeight + parseFloat(random(this.size, this.size, true).toFixed(2));

        this.lifeTime  = random(this.options.minLifeTime, this.options.maxLifeTime);
        this.startTime = timer / 60;
    }

    draw (timer) {
        var timePercentage;
        var gradient;

        this.x += Math.cos(timer / this.options.FPS) * this.varianceX / this.options.FPS;
        this.y -= this.speed / this.options.FPS;

        this.currentTime = (timer / this.options.FPS) - this.startTime;
        timePercentage   = this.currentTime * 100 / this.lifeTime;
        this.opacity     = this.options.maxOpacity - (timePercentage / 100) * this.options.maxOpacity;

        if (this.currentTime >= this.lifeTime) { this.init(timer); }

        gradient = this.ctx.createRadialGradient(
            this.x + this.size / 2,
            this.y + this.size / 2,
            0,
            this.x + this.size / 2,
            this.y + this.size / 2,
            this.size / 2
        );
        gradient.addColorStop(0, "rgba(" + this.color + ", " + this.opacity + ")");
        gradient.addColorStop(0.75, "rgba(" + this.color + ", " + this.opacity * 0.75 + ")");
        gradient.addColorStop(1, "rgba(" + this.color + ", 0)");

        this.ctx.save();
        this.ctx.globalCompositeOperation = "overlay";
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(this.x, this.y, this.size, this.size);
        this.ctx.restore();
    }

    onResize (options = {}) {
        this.drawAreaWidth  = options.drawAreaWidth;
        this.drawAreaHeight = options.drawAreaHeight;
    }
}

export default Firefly;
