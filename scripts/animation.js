import { BACKEND_URL } from './config.js';

// ==========================================
// 碎片 (玻璃碎片) 动画
// ==========================================
const canvas = document.getElementById('sakura-canvas');
let ctx;
let width, height;
let sakuraCount = 50; 
const petals = [];

export class Shard {
    constructor() {
        this.reset();
        this.points = [];
        const type = Math.random() > 0.5 ? 3 : 4; 
        for(let i=0; i<type; i++) {
            const angle = (i / type) * Math.PI * 2 + (Math.random() * 0.5); // 更随机的角度抖动
            // 不规则半径以产生尖锐的碎片: 0.3 到 1.0 范围产生尖刺
            const r = (Math.random() * 0.7 + 0.3); 
            this.points.push({x: Math.cos(angle) * r, y: Math.sin(angle) * r});
        }
        // 为“爆炸”感添加一些更亮的颜色
        const colors = ['255, 255, 255', '162, 155, 254', '116, 185, 255', '0, 210, 211', '223, 228, 234'];
        this.baseColor = colors[Math.floor(Math.random() * colors.length)];
    }

    reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * -height;
        // 增加基础尺寸范围
        this.size = Math.random() * 30 + 10; 
        this.speedX = Math.random() * 1 - 0.5;
        this.speedY = Math.random() * 1.5 + 0.5;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 1 - 0.5;
        this.opacity = Math.random() * 0.4 + 0.1;
        this.flipX = Math.random() * Math.PI;
        this.flipY = Math.random() * Math.PI;
        this.flipSpeedX = Math.random() * 0.05;
        this.flipSpeedY = Math.random() * 0.05;
    }


    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        this.flipX += this.flipSpeedX;
        this.flipY += this.flipSpeedY;

        if (this.y > height + 50) {
            this.reset();
        }
    }

    draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        
        const scaleX = Math.cos(this.flipX);
        const scaleY = Math.cos(this.flipY);
        ctx.scale(scaleX, scaleY);

        ctx.beginPath();
        if(this.points.length > 0) {
            ctx.moveTo(this.points[0].x * this.size, this.points[0].y * this.size);
            for(let i=1; i<this.points.length; i++) {
                ctx.lineTo(this.points[i].x * this.size, this.points[i].y * this.size);
            }
        }
        ctx.closePath();

        ctx.fillStyle = `rgba(${this.baseColor}, ${this.opacity})`;
        ctx.fill();
        
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity * 1.5})`;
        ctx.stroke();

        ctx.restore();
    }
}

function initSakura() {
    petals.length = 0;
    for (let i = 0; i < sakuraCount; i++) {
        petals.push(new Shard());
    }
}

function animateSakura() {
    ctx.clearRect(0, 0, width, height);
    petals.forEach(p => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animateSakura);
}

export function initAnimation() {
    if (canvas) {
        ctx = canvas.getContext('2d');
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        window.addEventListener('resize', () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        });

        initSakura();
        animateSakura();
    }
}

// Wallpaper Engine 属性监听器接口
export function updateSakuraCount(count) {
    if (count) {
        sakuraCount = count;
        if (petals.length < sakuraCount) {
            while(petals.length < sakuraCount) petals.push(new Shard());
        } else {
            petals.length = sakuraCount;
        }
    }
}
