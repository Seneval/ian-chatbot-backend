// Advanced animations using GSAP (if available) or fallback to CSS animations
document.addEventListener('DOMContentLoaded', function() {
    // Check if GSAP is available
    const hasGSAP = typeof gsap !== 'undefined';

    // Neural particles animation
    function createNeuralParticles() {
        const container = document.querySelector('.neural-particles');
        if (!container) return;

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                position: absolute;
                width: ${Math.random() * 6 + 2}px;
                height: ${Math.random() * 6 + 2}px;
                background: radial-gradient(circle, rgba(107, 70, 193, 0.8) 0%, transparent 70%);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                opacity: ${Math.random() * 0.5 + 0.3};
            `;
            container.appendChild(particle);

            // Animate particle
            animateParticle(particle);
        }
    }

    function animateParticle(particle) {
        const duration = Math.random() * 20 + 10;
        const startX = parseFloat(particle.style.left);
        const startY = parseFloat(particle.style.top);
        
        particle.animate([
            { 
                transform: 'translate(0, 0) scale(1)',
                opacity: parseFloat(particle.style.opacity)
            },
            { 
                transform: `translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px) scale(${Math.random() * 1.5 + 0.5})`,
                opacity: Math.random() * 0.5
            },
            { 
                transform: 'translate(0, 0) scale(1)',
                opacity: parseFloat(particle.style.opacity)
            }
        ], {
            duration: duration * 1000,
            iterations: Infinity,
            easing: 'ease-in-out'
        });
    }

    createNeuralParticles();

    // Animated chat messages
    function animateChatDemo() {
        const chatMessages = document.querySelector('#chat-messages');
        if (!chatMessages) return;

        const demoMessages = [
            { type: 'user', text: '¿Cuánto cuesta el envío a Monterrey?' },
            { type: 'bot', text: 'El envío a Monterrey tiene un costo de $99 MXN y llega en 2-3 días hábiles. ¿Te gustaría conocer nuestras opciones de envío express?' },
            { type: 'user', text: 'Sí, me interesa el envío express' },
            { type: 'bot', text: 'Perfecto! El envío express a Monterrey cuesta $149 MXN y llega al siguiente día hábil. También tenemos envío gratis en compras mayores a $999. ¿Qué productos te interesan?' }
        ];

        let messageIndex = 0;
        
        function addMessage() {
            if (messageIndex >= demoMessages.length) {
                messageIndex = 0;
                // Clear old messages except the first one
                const messages = chatMessages.querySelectorAll('.message:not(:first-child)');
                messages.forEach(msg => msg.remove());
            }

            const message = demoMessages[messageIndex];
            const messageEl = document.createElement('div');
            messageEl.className = `message ${message.type}`;
            
            if (message.type === 'bot') {
                // Show typing indicator first
                messageEl.innerHTML = `
                    <div class="message-content typing">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                `;
                chatMessages.appendChild(messageEl);
                chatMessages.scrollTop = chatMessages.scrollHeight;

                // Replace with actual message after delay
                setTimeout(() => {
                    messageEl.innerHTML = `
                        <div class="message-content">
                            ${message.text}
                        </div>
                    `;
                    messageEl.classList.add('fade-in');
                }, 1500);
            } else {
                messageEl.innerHTML = `
                    <div class="message-content">
                        ${message.text}
                    </div>
                `;
                messageEl.classList.add('fade-in');
                chatMessages.appendChild(messageEl);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            messageIndex++;
        }

        // Start demo after 2 seconds
        setTimeout(() => {
            setInterval(addMessage, 4000);
        }, 2000);
    }

    // animateChatDemo(); // Disabled to prevent interference with interactive chat

    // Hero visual animation
    function animateHeroVisual() {
        const chatPreview = document.querySelector('.chatbot-preview');
        if (!chatPreview) return;

        // Mouse move effect
        let mouseX = 0, mouseY = 0;
        let targetX = 0, targetY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 20;
            mouseY = (e.clientY / window.innerHeight - 0.5) * 20;
        });

        function updatePosition() {
            targetX += (mouseX - targetX) * 0.1;
            targetY += (mouseY - targetY) * 0.1;
            
            chatPreview.style.transform = `perspective(1000px) rotateY(${-15 + targetX}deg) rotateX(${targetY}deg)`;
            
            requestAnimationFrame(updatePosition);
        }

        updatePosition();
    }

    animateHeroVisual();

    // Animated gradient backgrounds
    function animateGradients() {
        const gradientElements = document.querySelectorAll('.gradient-text, .gradient-primary, .gradient-secondary');
        
        gradientElements.forEach(element => {
            let hue = 0;
            
            setInterval(() => {
                hue = (hue + 1) % 360;
                // Subtle hue shift for dynamic feel
                element.style.filter = `hue-rotate(${hue * 0.1}deg)`;
            }, 50);
        });
    }

    animateGradients();

    // Timeline animation
    function animateTimeline() {
        const timelineItems = document.querySelectorAll('.timeline-item');
        
        const timelineObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('scale-in');
                        entry.target.style.opacity = '1';
                    }, index * 200);
                }
            });
        }, { threshold: 0.5 });

        timelineItems.forEach(item => {
            item.style.opacity = '0';
            timelineObserver.observe(item);
        });
    }

    animateTimeline();

    // Pricing cards 3D effect
    function add3DEffect() {
        const cards = document.querySelectorAll('.pricing-card, .benefit-card, .use-case-card');
        
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = (y - centerY) / 10;
                const rotateY = (centerX - x) / 10;
                
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
            });
        });
    }

    add3DEffect();

    // Smooth number transitions
    function animateNumbers() {
        const numbers = document.querySelectorAll('.stat-number');
        
        numbers.forEach(number => {
            const target = parseInt(number.textContent);
            if (!isNaN(target)) {
                number.addEventListener('mouseenter', () => {
                    const current = parseInt(number.textContent);
                    const increment = (target + 10 - current) / 20;
                    let value = current;
                    
                    const interval = setInterval(() => {
                        value += increment;
                        if (value >= target + 10) {
                            clearInterval(interval);
                            number.textContent = target;
                        } else {
                            number.textContent = Math.floor(value);
                        }
                    }, 50);
                });
            }
        });
    }

    animateNumbers();

    // Morph animation for buttons
    function addMorphEffect() {
        const buttons = document.querySelectorAll('.primary-button, .secondary-button');
        
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.borderRadius = '25px 50px 25px 50px';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.borderRadius = '50px';
            });
        });
    }

    addMorphEffect();

    // Sparkle effect on hover
    function addSparkleEffect() {
        const sparkleElements = document.querySelectorAll('.pricing-card.featured, .primary-button');
        
        sparkleElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                for (let i = 0; i < 3; i++) {
                    createSparkle(e.pageX, e.pageY, element);
                }
            });
        });
    }

    function createSparkle(x, y, parent) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle-particle';
        sparkle.style.cssText = `
            position: absolute;
            width: 4px;
            height: 4px;
            background: #FFBA08;
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
            left: ${x + Math.random() * 20 - 10}px;
            top: ${y + Math.random() * 20 - 10}px;
        `;
        
        document.body.appendChild(sparkle);
        
        sparkle.animate([
            { 
                transform: 'translate(0, 0) scale(0)',
                opacity: 1
            },
            { 
                transform: `translate(${Math.random() * 100 - 50}px, ${Math.random() * -100 - 50}px) scale(1)`,
                opacity: 0
            }
        ], {
            duration: 1000,
            easing: 'cubic-bezier(0, .9, .57, 1)'
        }).onfinish = () => sparkle.remove();
    }

    addSparkleEffect();

    // Typewriter effect for hero title
    function typewriterEffect() {
        const title = document.querySelector('.hero-title');
        if (!title) return;

        const text = title.textContent;
        // Don't clear the content to prevent blank spaces
        // title.textContent = '';
        title.style.opacity = '1';
        
        let index = 0;
        const interval = setInterval(() => {
            if (index < text.length) {
                // Skip typewriter to prevent content issues
                title.textContent = text;
                clearInterval(interval);
            }
        }, 50);
    }

    // Initialize typewriter after a short delay
    // setTimeout(typewriterEffect, 500); // Disabled to prevent content disappearing

    // Add floating animation to WhatsApp button
    const whatsappButton = document.querySelector('.whatsapp-float');
    if (whatsappButton) {
        whatsappButton.animate([
            { transform: 'translateY(0px)' },
            { transform: 'translateY(-10px)' },
            { transform: 'translateY(0px)' }
        ], {
            duration: 3000,
            iterations: Infinity,
            easing: 'ease-in-out'
        });
    }
});