const PatternedBackground = () => (
  <div className="absolute inset-0 h-full w-full">
    <canvas
      ref={(canvas) => {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const waves = [
          {
            amplitude: 18,
            frequency: 0.008,
            speed: 0.000003,
            offset: 0,
            color: "rgba(6, 182, 212, 0.07)",
          },
          {
            amplitude: 14,
            frequency: 0.01,
            speed: 0.000002,
            offset: 2.1,
            color: "rgba(6, 182, 212, 0.05)",
          },
          {
            amplitude: 10,
            frequency: 0.013,
            speed: 0.000004,
            offset: 4.3,
            color: "rgba(6, 182, 212, 0.04)",
          },
        ];

        let t = 0;
        let animId: number;

        function draw() {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);
          const startY = h * 0.75;

          waves.forEach((wave) => {
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x++) {
              const y =
                startY +
                Math.sin(
                  x * wave.frequency + t * wave.speed * 1000 + wave.offset,
                ) *
                  wave.amplitude;
              ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fillStyle = wave.color;
            ctx.fill();
          });

          t += 1;
          animId = requestAnimationFrame(draw);
        }

        draw();
        return () => cancelAnimationFrame(animId);
      }}
      className="h-full w-full"
    />
  </div>
);

export default PatternedBackground;
