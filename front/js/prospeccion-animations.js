// Prospección con IA Page Animations
document.addEventListener('DOMContentLoaded', function() {
    // Animate dashboard metrics
    const metricNumbers = document.querySelectorAll('.metric-number');
    
    metricNumbers.forEach((metric, index) => {
        const value = metric.textContent;
        metric.textContent = '0';
        
        setTimeout(() => {
            let current = 0;
            const target = parseInt(value.replace(/[^0-9]/g, ''));
            const suffix = value.replace(/[0-9]/g, '');
            const duration = 2000;
            const increment = target / (duration / 16);
            
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    metric.textContent = target.toLocaleString() + suffix;
                    clearInterval(timer);
                } else {
                    metric.textContent = Math.floor(current).toLocaleString() + suffix;
                }
            }, 16);
        }, 500 + (index * 200));
    });
    
    // Animate campaign items
    const campaignItems = document.querySelectorAll('.campaign-item');
    campaignItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            item.style.transition = 'all 0.6s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, 1000 + (index * 150));
    });
    
    // Live indicator pulse
    const liveIndicator = document.querySelector('.live-indicator');
    if (liveIndicator) {
        setInterval(() => {
            liveIndicator.style.opacity = '0.5';
            setTimeout(() => {
                liveIndicator.style.opacity = '1';
            }, 500);
        }, 2000);
    }
    
    // Performance percentages animation
    const performances = document.querySelectorAll('.performance');
    performances.forEach(perf => {
        const value = perf.textContent;
        const numValue = parseInt(value);
        perf.textContent = '+0%';
        
        setTimeout(() => {
            let current = 0;
            const timer = setInterval(() => {
                current += 5;
                if (current >= numValue) {
                    perf.textContent = value;
                    clearInterval(timer);
                } else {
                    perf.textContent = '+' + current + '%';
                }
            }, 30);
        }, 1500);
    });
    
    // Hover effect for metric cards
    const metricCards = document.querySelectorAll('.metric-card');
    metricCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05) translateY(-5px)';
            this.style.boxShadow = '0 10px 30px rgba(107, 70, 193, 0.15)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1) translateY(0)';
            this.style.boxShadow = '';
        });
    });
    
    // Form handling
    const prospeccionForm = document.querySelector('#contacto form');
    if (prospeccionForm) {
        prospeccionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const button = this.querySelector('.submit-button');
            const originalText = button.innerHTML;
            
            // Show loading state
            button.innerHTML = '<span>Enviando información...</span>';
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
                    button.innerHTML = '<span>¡Mensaje Enviado! ✓</span>';
                    button.style.background = 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)';
                    this.reset();
                    
                    // Show success message
                    setTimeout(() => {
                        alert('¡Gracias por tu interés! Te contactaremos pronto para mostrarte cómo multiplicar tus clientes.');
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
    
    // Parallax effect for hero
    const heroSection = document.querySelector('.prospeccion-hero');
    if (heroSection) {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.3;
            heroSection.style.backgroundPositionY = rate + 'px';
        });
    }
    
    // Animate feature cards on scroll
    const featureCards = document.querySelectorAll('.feature-card');
    const featuresObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0) scale(1)';
                }, index * 100);
                featuresObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    featureCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px) scale(0.95)';
        card.style.transition = 'all 0.6s ease';
        featuresObserver.observe(card);
    });
});