// Main JavaScript file
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu functionality
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    const body = document.body;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'mobile-menu-overlay';
    body.appendChild(overlay);
    
    // Toggle mobile menu
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            mobileMenu?.classList.toggle('active');
            overlay.classList.toggle('active');
            body.style.overflow = mobileMenu?.classList.contains('active') ? 'hidden' : '';
            this.classList.toggle('active');
        });
    }
    
    // Close menu on overlay click
    overlay.addEventListener('click', function() {
        mobileMenu?.classList.remove('active');
        overlay.classList.remove('active');
        body.style.overflow = '';
        mobileMenuToggle?.classList.remove('active');
    });
    
    // Mobile dropdown functionality
    const mobileDropdowns = document.querySelectorAll('.mobile-dropdown .dropdown-toggle');
    mobileDropdowns.forEach(dropdown => {
        dropdown.addEventListener('click', function(e) {
            e.preventDefault();
            const parent = this.closest('.mobile-dropdown');
            parent?.classList.toggle('active');
        });
    });
    
    // Close mobile menu on link click
    const mobileLinks = document.querySelectorAll('.mobile-link:not(.dropdown-toggle)');
    mobileLinks.forEach(link => {
        link.addEventListener('click', function() {
            mobileMenu?.classList.remove('active');
            overlay.classList.remove('active');
            body.style.overflow = '';
            mobileMenuToggle?.classList.remove('active');
        });
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                // Close mobile menu if open
                navMenu?.classList.remove('active');
                mobileMenu?.classList.remove('active');
                overlay?.classList.remove('active');
                body.style.overflow = '';
                mobileMenuToggle?.classList.remove('active');
            }
        });
    });

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
        
        lastScroll = currentScroll;
    });

    // Stats counter animation
    const stats = document.querySelectorAll('.stat-number[data-target]');
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px'
    };

    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const stat = entry.target;
                const target = parseInt(stat.getAttribute('data-target'));
                const duration = 2000;
                const increment = target / (duration / 16);
                let current = 0;

                const updateCounter = () => {
                    current += increment;
                    if (current < target) {
                        stat.textContent = Math.floor(current);
                        requestAnimationFrame(updateCounter);
                    } else {
                        stat.textContent = target;
                    }
                };

                updateCounter();
                statsObserver.unobserve(stat);
            }
        });
    }, observerOptions);

    stats.forEach(stat => {
        statsObserver.observe(stat);
    });

    // Intersection Observer for animations
    const animatedElements = document.querySelectorAll('.animate-on-scroll, .stagger-animation');
    
    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                animationObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.01,
        rootMargin: '50px'
    });
    
    // Fallback: ensure all elements are visible after page load
    setTimeout(() => {
        document.querySelectorAll('.animate-on-scroll, .stagger-animation').forEach(el => {
            if (!el.classList.contains('visible')) {
                el.classList.add('visible');
            }
        });
    }, 1500);

    animatedElements.forEach(element => {
        animationObserver.observe(element);
    });

    // Add animation classes to elements - but keep them subtle
    document.querySelectorAll('.section-title').forEach(el => {
        el.classList.add('animate-on-scroll');
    });

    document.querySelectorAll('.stat-card, .benefit-card, .use-case-card, .service-card').forEach(el => {
        el.classList.add('animate-on-scroll');
    });

    document.querySelectorAll('.pricing-card').forEach(el => {
        el.classList.add('scale-in');
    });

    // Form submission
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const button = this.querySelector('.submit-button');
            const originalText = button.innerHTML;
            const messageDiv = document.getElementById('form-message');
            
            // Show loading state
            button.innerHTML = '<span>Enviando...</span>';
            button.disabled = true;
            button.style.opacity = '0.7';
            
            // Get form data
            const formData = new FormData(this);
            
            try {
                // Send to Web3Forms
                const response = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Show success message
                    messageDiv.style.display = 'block';
                    messageDiv.style.background = 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)';
                    messageDiv.style.color = 'white';
                    messageDiv.innerHTML = '¡Gracias! Tu mensaje ha sido enviado. Te contactaremos pronto.';
                    
                    button.innerHTML = '<span>¡Enviado! ✓</span>';
                    button.style.background = 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)';
                    button.disabled = false;
                    button.style.opacity = '1';
                    
                    // Reset form
                    this.reset();
                    
                    // Keep message and button state visible until page reload
                    return; // Exit early to prevent button reset
                } else {
                    throw new Error('Error al enviar el formulario');
                }
            } catch (error) {
                // Show error message
                messageDiv.style.display = 'block';
                messageDiv.style.background = '#FEE2E2';
                messageDiv.style.color = '#DC2626';
                messageDiv.innerHTML = 'Hubo un error al enviar tu mensaje. Por favor intenta de nuevo o contáctanos al 811 250 0801.';
                
                button.innerHTML = '<span>Error - Intentar de nuevo</span>';
                button.style.background = '#DC2626';
                
                // Only reset button for errors
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.background = '';
                    button.disabled = false;
                    button.style.opacity = '1';
                }, 3000);
            }
        });
    }

    // Parallax effect
    const parallaxElements = document.querySelectorAll('.parallax-slow, .parallax-medium, .parallax-fast');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        parallaxElements.forEach(element => {
            const speed = element.classList.contains('parallax-slow') ? 0.5 :
                          element.classList.contains('parallax-medium') ? 0.8 : 1.2;
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    });

    // Add hover effects
    document.querySelectorAll('.primary-button, .secondary-button').forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Add ripple effect to buttons
    document.querySelectorAll('button, .primary-button, .secondary-button').forEach(button => {
        button.classList.add('ripple');
    });

    // WhatsApp button hover effect
    const whatsappFloat = document.querySelector('.whatsapp-float');
    if (whatsappFloat) {
        whatsappFloat.addEventListener('mouseenter', function() {
            this.style.width = 'auto';
            this.style.borderRadius = '50px';
            this.style.padding = '0 20px';
        });
        
        whatsappFloat.addEventListener('mouseleave', function() {
            this.style.width = '60px';
            this.style.borderRadius = '50%';
            this.style.padding = '0';
        });
    }

    // Add stagger animation to grid items
    const gridContainers = document.querySelectorAll('.stats-grid, .benefits-grid, .use-cases-grid, .services-grid');
    gridContainers.forEach(container => {
        container.classList.add('stagger-animation');
    });

    // Lazy load images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => {
        imageObserver.observe(img);
    });

    // Add dynamic year to footer
    const yearElement = document.querySelector('.footer-bottom p');
    if (yearElement) {
        const currentYear = new Date().getFullYear();
        yearElement.innerHTML = yearElement.innerHTML.replace('2024', currentYear);
    }

    // Performance optimization: Debounce scroll events
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) {
            window.cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = window.requestAnimationFrame(() => {
            // Scroll-based animations here
        });
    });
});