// Courses page animations
document.addEventListener('DOMContentLoaded', function() {
    // Typing effect for AI interface
    const typingText = document.querySelector('.typing-effect');
    if (typingText) {
        const text = typingText.textContent;
        typingText.textContent = '';
        let index = 0;
        
        function type() {
            if (index < text.length) {
                typingText.textContent += text.charAt(index);
                index++;
                setTimeout(type, 50);
            }
        }
        
        setTimeout(type, 1000);
    }

    // Animate stats on scroll
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px'
    };

    const statsObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statValues = entry.target.querySelectorAll('.stat-value');
                statValues.forEach(stat => {
                    const value = stat.textContent;
                    stat.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        stat.style.transform = 'scale(1)';
                    }, 300);
                });
            }
        });
    }, observerOptions);

    const learningStats = document.querySelector('.learning-stats');
    if (learningStats) {
        statsObserver.observe(learningStats);
    }

    // Animate course cards on hover
    const courseCards = document.querySelectorAll('.course-card');
    courseCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Form handling
    const contactForm = document.getElementById('contact-form');
    const formMessage = document.getElementById('form-message');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitButton = this.querySelector('.submit-button');
            const originalText = submitButton.innerHTML;
            
            // Show loading state
            submitButton.innerHTML = '<span>Enviando...</span>';
            submitButton.disabled = true;
            
            // Create form data
            const formData = new FormData(this);
            
            // Submit form
            fetch(this.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            })
            .then(response => {
                if (response.ok) {
                    // Success
                    formMessage.style.display = 'block';
                    formMessage.style.backgroundColor = '#10B981';
                    formMessage.style.color = 'white';
                    formMessage.textContent = '¡Mensaje enviado! Te contactaremos pronto para agendar tu curso.';
                    
                    // Reset form
                    contactForm.reset();
                    
                    // Scroll to message
                    formMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    throw new Error('Error en el envío');
                }
            })
            .catch(error => {
                // Error
                formMessage.style.display = 'block';
                formMessage.style.backgroundColor = '#EF4444';
                formMessage.style.color = 'white';
                formMessage.textContent = 'Hubo un error al enviar el mensaje. Por favor intenta de nuevo.';
            })
            .finally(() => {
                // Restore button
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
                
                // Hide message after 5 seconds
                setTimeout(() => {
                    formMessage.style.display = 'none';
                }, 5000);
            });
        });
    }

    // Animate typing dots
    const typingDots = document.querySelector('.typing-dots');
    if (typingDots) {
        setInterval(() => {
            typingDots.classList.toggle('active');
        }, 1500);
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});