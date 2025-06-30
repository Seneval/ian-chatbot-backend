// Web Development Page Animations
document.addEventListener('DOMContentLoaded', function() {
    // Simple fade in animation for preview
    const websitePreview = document.querySelector('.website-preview');
    if (websitePreview) {
        websitePreview.style.opacity = '0';
        websitePreview.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            websitePreview.style.transition = 'all 1s ease';
            websitePreview.style.opacity = '1';
            websitePreview.style.transform = 'translateY(0)';
        }, 500);
    }
    
    // Typewriter effect for browser URL
    const browserUrl = document.querySelector('.browser-url');
    const urlExamples = ['tusitio.com', 'tutienda.com', 'tuservicio.com', 'tunegocio.com'];
    let urlIndex = 0;
    
    if (browserUrl) {
        // Initial typing
        typewriterEffect(browserUrl, urlExamples[0]);
        
        // Change URL every 5 seconds
        setInterval(() => {
            urlIndex = (urlIndex + 1) % urlExamples.length;
            
            // First erase current text
            eraseText(browserUrl, () => {
                // Then type new text
                typewriterEffect(browserUrl, urlExamples[urlIndex]);
            });
        }, 5000);
    }
    
    // Typewriter function
    function typewriterEffect(element, text) {
        element.textContent = '';
        let charIndex = 0;
        
        const typeInterval = setInterval(() => {
            if (charIndex < text.length) {
                element.textContent += text.charAt(charIndex);
                charIndex++;
            } else {
                clearInterval(typeInterval);
            }
        }, 100); // Speed of typing
    }
    
    // Erase text function
    function eraseText(element, callback) {
        let text = element.textContent;
        let charIndex = text.length;
        
        const eraseInterval = setInterval(() => {
            if (charIndex > 0) {
                element.textContent = text.substring(0, charIndex - 1);
                charIndex--;
            } else {
                clearInterval(eraseInterval);
                if (callback) callback();
            }
        }, 50); // Speed of erasing (faster than typing)
    }
    
    // Parallax effect for hero elements
    const heroVisual = document.querySelector('.hero-visual');
    
    window.addEventListener('scroll', () => {
        if (heroVisual) {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;
            heroVisual.style.transform = `translateY(${rate}px)`;
        }
    });
    
    // Animate feature cards on hover
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            const icon = this.querySelector('.feature-icon');
            icon.style.transform = 'scale(1.1) rotate(5deg)';
        });
        
        card.addEventListener('mouseleave', function() {
            const icon = this.querySelector('.feature-icon');
            icon.style.transform = 'scale(1) rotate(0deg)';
        });
    });
    
    // Animate process timeline on scroll
    const processSteps = document.querySelectorAll('.process-step');
    const processObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 200);
            }
        });
    }, { threshold: 0.5 });
    
    processSteps.forEach(step => {
        step.style.opacity = '0';
        step.style.transform = 'translateY(30px)';
        step.style.transition = 'all 0.6s ease';
        processObserver.observe(step);
    });
    
    // Animate metrics in example cards
    const metricValues = document.querySelectorAll('.metric-value');
    const metricsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const value = target.textContent;
                
                // Check if it's a percentage
                if (value.includes('%')) {
                    const num = parseInt(value);
                    animateValue(target, 0, num, 2000, '%');
                }
                // Check if it's a multiplier
                else if (value.includes('x')) {
                    const num = parseFloat(value);
                    animateDecimal(target, 0, num, 2000, 'x');
                }
                // Check if it's a decimal rating
                else if (value.includes('.')) {
                    const num = parseFloat(value);
                    animateDecimal(target, 0, num, 2000);
                }
                
                metricsObserver.unobserve(target);
            }
        });
    }, { threshold: 0.5 });
    
    metricValues.forEach(metric => {
        metricsObserver.observe(metric);
    });
    
    // Animate counter
    function animateValue(element, start, end, duration, suffix = '') {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= end) {
                element.textContent = end + suffix;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current) + suffix;
            }
        }, 16);
    }
    
    // Animate decimal counter
    function animateDecimal(element, start, end, duration, suffix = '') {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= end) {
                element.textContent = end.toFixed(1) + suffix;
                clearInterval(timer);
            } else {
                element.textContent = current.toFixed(1) + suffix;
            }
        }, 16);
    }
    
    // Hover effect for pricing cards
    const pricingCards = document.querySelectorAll('.web-pricing-card');
    pricingCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            if (!this.classList.contains('featured')) {
                this.style.transform = 'translateY(-10px) scale(1.02)';
            }
        });
        
        card.addEventListener('mouseleave', function() {
            if (!this.classList.contains('featured')) {
                this.style.transform = 'translateY(0) scale(1)';
            }
        });
    });
    
    // Add floating animation to badges
    const badges = document.querySelectorAll('.badge-new, .badge-ai');
    badges.forEach((badge, index) => {
        badge.style.animation = `float ${3 + index}s ease-in-out infinite`;
        badge.style.animationDelay = `${index * 0.5}s`;
    });
    
    // Add CSS for float animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
    
    // Form handling for web dev page
    const webForm = document.querySelector('#contacto form');
    if (webForm) {
        webForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const button = this.querySelector('.submit-button');
            const originalText = button.innerHTML;
            
            // Show loading state
            button.innerHTML = '<span>Enviando consulta...</span>';
            button.disabled = true;
            
            // Get form data
            const formData = new FormData(this);
            
            try {
                const response = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    button.innerHTML = '<span>¡Consulta Enviada! ✓</span>';
                    button.style.background = 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)';
                    this.reset();
                    
                    // Show success message
                    setTimeout(() => {
                        alert('¡Gracias por tu interés! Te contactaremos en menos de 2 horas para agendar tu consultoría gratuita.');
                    }, 500);
                } else {
                    throw new Error('Error al enviar');
                }
            } catch (error) {
                button.innerHTML = '<span>Error - Intentar de nuevo</span>';
                button.style.background = '#DC2626';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.background = '';
                    button.disabled = false;
                }, 3000);
            }
        });
    }
});