/*var canvas = document.getElementById('canvas'),
    ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.onresize = resize;

function noise(ctx) {
    
    var w = ctx.canvas.width,
        h = ctx.canvas.height,
        idata = ctx.createImageData(w, h),
        buffer = idata.data,
        len = buffer.length,
        i = 0,
        color;

    for(; i < len;) {
      color = (255 * Math.random()) | 0;
        buffer[i++] = color;
      buffer[i++] = color;
      buffer[i++] = color;
      buffer[i++] = 255 * 0.15
    }
    
    ctx.putImageData(idata, 0, 0);
}

var toggle = true;

// added toggle to get 30 FPS instead of 60 FPS
(function loop() {
    toggle = !toggle;
    if (toggle) {
        requestAnimationFrame(loop);
        return;
    }
    noise(ctx);
    requestAnimationFrame(loop);
})();*/

/*
    function randomNoise (ctx, alpha) {
        var imageData = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
        var pixels    = imageData.data;
        var n         = pixels.length;
        var i         = 0;
        var color;

        while (i < n) {
            color = (255 * Math.random()) | 0;
            pixels[i++] = color;
            pixels[i++] = color;
            pixels[i++] = color;
            pixels[i++] = alpha || 255;
        }

        //ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function perlinNoise (canvas, noise, newCanvas) {
        canvas  = newCanvas ? createCanvas(canvas.width, canvas.height) : canvas;
        noise   = noise || randomNoise({ canvas: createCanvas(canvas.width, canvas.height) });
        var ctx = canvas.getContext("2d");
        ctx.save();
        
        // Scale random iterations onto the canvas to generate Perlin noise.
        for (var size = 4; size <= noise.width; size *= 2) {
            var x = (Math.random() * (noise.width - size)) | 0,
                y = (Math.random() * (noise.height - size)) | 0;
            ctx.globalAlpha = 4 / size;
            ctx.drawImage(noise, x, y, size, size, 0, 0, canvas.width, canvas.height);
        }

        ctx.restore();
        return canvas;
    }

    function noise (ctx) {
        var w = ctx.canvas.width,
            h = ctx.canvas.height,
            idata = ctx.createImageData(w, h),
            buffer = idata.data,
            len = buffer.length,
            i = 0,
            color;

        for(; i < len;) {
          color = (255 * Math.random()) | 0;
            buffer[i++] = color;
          buffer[i++] = color;
          buffer[i++] = color;
          buffer[i++] = 255 * 0.15;
        }
        
        ctx.putImageData(idata, 0, 0);
    }
*/

self.onmessage = function (event) {
    self.postMessage(noise(event.data));
};

function noise (imageData) {
    var pixelBuffer = imageData.data;
    var len = pixelBuffer.length;
    var i = 0;
    var color;

    for(; i < len;) {
        color = (255 * Math.random()) | 0;
        pixelBuffer[i++] = color;
        pixelBuffer[i++] = color;
        pixelBuffer[i++] = color;
        pixelBuffer[i++] = 255 * 0.15;
    }
    
    return imageData;
}
