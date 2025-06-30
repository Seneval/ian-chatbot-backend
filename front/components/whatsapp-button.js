// WhatsApp floating button component
document.addEventListener('DOMContentLoaded', function() {
    const whatsappButton = document.querySelector('.whatsapp-float');
    
    if (!whatsappButton) return;

    // Track scroll position
    let lastScrollTop = 0;
    let isScrolling = false;

    window.addEventListener('scroll', () => {
        isScrolling = true;
        
        // Hide button while scrolling
        whatsappButton.style.transform = 'scale(0.8)';
        whatsappButton.style.opacity = '0.7';
        
        // Clear timeout
        clearTimeout(window.scrollTimeout);
        
        // Set timeout to show button again
        window.scrollTimeout = setTimeout(() => {
            isScrolling = false;
            whatsappButton.style.transform = 'scale(1)';
            whatsappButton.style.opacity = '1';
            
            // Add attention animation
            whatsappButton.classList.add('bounce');
            setTimeout(() => {
                whatsappButton.classList.remove('bounce');
            }, 1000);
        }, 200);
        
        lastScrollTop = window.pageYOffset;
    });

    // Dynamic message based on page section
    const updateWhatsAppLink = () => {
        const sections = {
            'precios': 'Hola, me interesa conocer los precios de los chatbots IA',
            'demo': 'Hola, quiero ver una demo del chatbot para mi negocio',
            'benefits': 'Hola, quiero saber más sobre los beneficios del chatbot',
            'contacto': 'Hola, quiero implementar un chatbot en mi sitio web',
            'servicios': 'Hola, me interesan sus servicios de IA'
        };
        
        // Find current section
        let currentSection = 'inicio';
        for (const [sectionId, message] of Object.entries(sections)) {
            const section = document.getElementById(sectionId);
            if (section) {
                const rect = section.getBoundingClientRect();
                if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
                    currentSection = sectionId;
                    break;
                }
            }
        }
        
        // Update WhatsApp link
        const baseUrl = 'https://wa.me/528112500801?text=';
        const message = sections[currentSection] || 'Hola, quiero un chatbot que aumente mis ventas';
        whatsappButton.href = baseUrl + encodeURIComponent(message);
    };

    // Update on scroll
    window.addEventListener('scroll', updateWhatsAppLink);
    updateWhatsAppLink();

    // Pulse animation when user is idle
    let idleTimer;
    const startIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            whatsappButton.classList.add('pulse-animation');
            setTimeout(() => {
                whatsappButton.classList.remove('pulse-animation');
            }, 3000);
        }, 5000);
    };

    // Reset idle timer on user interaction
    ['mousemove', 'keypress', 'scroll', 'click'].forEach(event => {
        document.addEventListener(event, startIdleTimer);
    });
    
    startIdleTimer();

    // Click tracking
    whatsappButton.addEventListener('click', () => {
        // Here you would normally track this conversion
        console.log('WhatsApp button clicked');
        
        // Visual feedback
        whatsappButton.style.transform = 'scale(0.9)';
        setTimeout(() => {
            whatsappButton.style.transform = 'scale(1)';
        }, 200);
    });

    // Show tooltip on hover
    const tooltip = document.createElement('div');
    tooltip.className = 'whatsapp-tooltip';
    tooltip.style.cssText = `
        position: absolute;
        bottom: 70px;
        right: 0;
        background: var(--dark-navy);
        color: white;
        padding: 10px 15px;
        border-radius: 10px;
        font-size: 14px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    `;
    tooltip.textContent = '¿Listo para vender más? 🚀';
    whatsappButton.appendChild(tooltip);

    let hoverCount = 0;
    whatsappButton.addEventListener('mouseenter', () => {
        hoverCount++;
        
        // Change tooltip message based on hover count
        const messages = [
            '¿Listo para vender más? 🚀',
            'Respuesta en minutos ⚡',
            'Demos gratis disponibles 🎁',
            'Aumenta tus ventas 87% 📈'
        ];
        
        tooltip.textContent = messages[hoverCount % messages.length];
        tooltip.style.opacity = '1';
    });

    whatsappButton.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
    });

    // Special animation on CTA section
    const ctaSection = document.getElementById('contacto');
    if (ctaSection) {
        const ctaObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Make button more prominent
                    whatsappButton.style.transform = 'scale(1.2)';
                    whatsappButton.classList.add('glow');
                    
                    // Show special message
                    const specialTooltip = document.createElement('div');
                    specialTooltip.style.cssText = `
                        position: absolute;
                        bottom: 70px;
                        right: 0;
                        background: var(--primary-yellow);
                        color: var(--dark-navy);
                        padding: 12px 20px;
                        border-radius: 25px;
                        font-size: 14px;
                        font-weight: 600;
                        white-space: nowrap;
                        animation: slideInRight 0.5s ease;
                        box-shadow: 0 5px 20px rgba(255,186,8,0.4);
                    `;
                    specialTooltip.textContent = '¡Oferta especial! Escríbenos ahora';
                    whatsappButton.appendChild(specialTooltip);
                    
                    setTimeout(() => {
                        specialTooltip.remove();
                    }, 5000);
                } else {
                    whatsappButton.style.transform = 'scale(1)';
                    whatsappButton.classList.remove('glow');
                }
            });
        }, { threshold: 0.5 });
        
        ctaObserver.observe(ctaSection);
    }
});