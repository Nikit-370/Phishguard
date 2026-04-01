// Main JavaScript for PhishGuard

document.addEventListener('DOMContentLoaded', function () {
    // Initialize the application
    initApp();

    // Initialize URL scanner
    initScanner();

    // Initialize stats
    updateStats();

    // Check authentication status
    checkAuthStatus();
});

function initApp() {
    // Mobile menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                navLinks.classList.toggle('mobile-active');
            }
        });

        // Close menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Update active nav link on scroll
    window.addEventListener('scroll', () => {
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('.nav-link');

        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (scrollY >= (sectionTop - 150)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // Show/hide password functionality
    setupPasswordToggles();

    // Password strength indicator
    setupPasswordStrength();

    // Form switching between login and register
    setupFormSwitching();
}

function initScanner() {
    const scanBtn = document.getElementById('scan-btn');
    const urlInput = document.getElementById('url-input');
    const resultsContainer = document.getElementById('results-container');
    const saveResultBtn = document.getElementById('save-result-btn');
    const newScanBtn = document.getElementById('new-scan-btn');

    if (scanBtn) {
        scanBtn.addEventListener('click', scanURL);
    }

    if (urlInput) {
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                scanURL();
            }
        });
    }

    if (saveResultBtn) {
        saveResultBtn.addEventListener('click', saveResult);
    }

    if (newScanBtn) {
        newScanBtn.addEventListener('click', resetScanner);
    }
}

async function scanURL() {
    const urlInput = document.getElementById('url-input');
    const url = urlInput.value.trim();

    if (!url) {
        showToast('Please enter a URL to scan', 'error');
        urlInput.focus();
        return;
    }

    // Validate URL format
    if (!isValidUrl(url)) {
        showToast('Please enter a valid URL (include http:// or https://)', 'error');
        urlInput.focus();
        return;
    }

    const scanBtn = document.getElementById('scan-btn');
    const originalText = scanBtn.innerHTML;
    scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
    scanBtn.disabled = true;

    // If user is authenticated, call server ML model
    const creds = localStorage.getItem('system_auth');
    if (creds) {
        try {
            const res = await fetch('/api/detect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + creds
                },
                body: JSON.stringify({ url: url })
            });

            const data = await res.json();
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    showToast('Please login to use the ML scanner', 'warning');
                    window.location.href = '/login';
                } else {
                    showToast(data.message || 'Scan failed', 'error');
                }
                // fallback to local simulation
                const result = simulatePhishingCheck(url);
                displayResults(result);
            } else {
                // Map the /api/detect response to displayResults format
                const isSafe = data.prediction === 0;
                const confidence = data.confidence || 85;
                const result = {
                    url: data.url || url,
                    isSafe: isSafe,
                    riskScore: isSafe ? Math.round(100 - confidence) : Math.round(confidence),
                    riskLevel: isSafe ? 'Low' : (confidence >= 90 ? 'Critical' : 'High'),
                    analysisTime: 0,
                    server: true,
                    label: data.prediction_label || (isSafe ? 'Legitimate' : 'Phishing'),
                    confidence: confidence,
                    features: data.features || {},
                    domain_info: data.domain_info || {},
                    resolved_ip: data.resolved_ip || null
                };
                displayResults(result);
                showToast(data.prediction_label || (isSafe ? 'Safe URL ✅' : 'Phishing Detected 🚨'), isSafe ? 'success' : 'warning');
            }
        } catch (err) {
            console.error(err);
            showToast('Error calling server model, using local scanner', 'error');
            const result = simulatePhishingCheck(url);
            displayResults(result);
        } finally {
            scanBtn.innerHTML = originalText;
            scanBtn.disabled = false;
            updateStats();
        }
        return;
    }

    // No token -> use local simulation
    setTimeout(() => {
        const result = simulatePhishingCheck(url);
        displayResults(result);
        scanBtn.innerHTML = originalText;
        scanBtn.disabled = false;
        updateStats();
        const status = result.isSafe ? 'safe' : 'dangerous';
        showToast(`URL scanned: ${status}`, result.isSafe ? 'success' : 'warning');
    }, 800);
}

function simulatePhishingCheck(url) {
    // This is a simulation - in a real app, this would call a phishing detection API
    const urlLower = url.toLowerCase();

    // Simple heuristic checks
    const checks = {
        hasHttps: urlLower.startsWith('https://'),
        hasSuspiciousKeywords: /(login|verify|account|secure|update|banking)/i.test(urlLower),
        hasIpAddress: /\d+\.\d+\.\d+\.\d+/.test(urlLower),
        isLongUrl: url.length > 75,
        hasSubdomainChain: (urlLower.match(/\./g) || []).length > 3,
        usesShortener: /(bit\.ly|goo\.gl|tinyurl|ow\.ly|is\.gd)/i.test(urlLower),
        hasPhishingTerms: /(paypal|ebay|amazon|microsoft|apple)/i.test(urlLower) &&
            !urlLower.includes('official') &&
            !urlLower.includes('verified')
    };

    // Calculate risk score (0-100, higher = more risky)
    let riskScore = 0;
    if (!checks.hasHttps) riskScore += 30;
    if (checks.hasSuspiciousKeywords) riskScore += 20;
    if (checks.hasIpAddress) riskScore += 25;
    if (checks.isLongUrl) riskScore += 15;
    if (checks.hasSubdomainChain) riskScore += 10;
    if (checks.usesShortener) riskScore += 25;
    if (checks.hasPhishingTerms) riskScore += 40;

    // Normalize score to 0-100
    riskScore = Math.min(100, riskScore);

    // Determine if safe
    const isSafe = riskScore < 40;

    // Get risk level
    let riskLevel = 'Low';
    if (riskScore >= 70) riskLevel = 'Critical';
    else if (riskScore >= 50) riskLevel = 'High';
    else if (riskScore >= 40) riskLevel = 'Medium';

    return {
        url: url,
        isSafe: isSafe,
        riskScore: riskScore,
        riskLevel: riskLevel,
        checks: checks,
        analysisTime: (Math.random() * 500 + 500).toFixed(0) // 500-1000ms
    };
}

function displayResults(result) {
    const resultsContainer = document.getElementById('results-container');
    const resultUrl = document.getElementById('result-url');
    const resultStatus = document.getElementById('result-status');
    const resultStatusText = document.getElementById('result-status-text');
    const resultRisk = document.getElementById('result-risk');
    const resultScore = document.getElementById('result-score');
    const resultTime = document.getElementById('result-time');

    // Update result elements
    resultUrl.textContent = result.url.length > 50 ? result.url.substring(0, 50) + '...' : result.url;
    resultStatusText.textContent = result.isSafe ? 'Safe URL' : 'Potential Phishing';
    resultRisk.textContent = result.riskLevel;
    resultScore.textContent = `${(100 - result.riskScore).toFixed(1)}%`;
    resultTime.textContent = `${result.analysisTime} ms`;

    // Update status display
    const statusIcon = resultStatus.querySelector('.status-icon');
    const statusText = resultStatus.querySelector('.status-text');

    if (result.isSafe) {
        resultStatus.style.color = 'var(--success-color)';
        statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
        statusText.textContent = 'Safe';
        resultsContainer.style.borderLeftColor = 'var(--success-color)';
    } else {
        resultStatus.style.color = 'var(--danger-color)';
        statusIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        statusText.textContent = 'Warning';
        resultsContainer.style.borderLeftColor = 'var(--danger-color)';
    }

    // Color code the risk level
    const riskColors = {
        'Low': 'var(--success-color)',
        'Medium': 'var(--warning-color)',
        'High': '#ff6b6b',
        'Critical': 'var(--danger-color)'
    };

    resultRisk.style.color = riskColors[result.riskLevel] || 'var(--dark-color)';

    // Show results
    resultsContainer.style.display = 'block';

    // Populate Domain Intelligence section if available
    const domainSection = document.getElementById('domainInfoSection');
    if (domainSection && result.domain_info) {
        const d = result.domain_info;
        const hasData = d.domain || d.registrar || d.created_at || d.age_days;
        if (hasData) {
            const setText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val || '—';
            };
            setText('domainName', d.domain);
            setText('domainRegistrar', d.registrar);
            setText('domainAge', d.age_days ? `${d.age_days} days` : null);
            setText('domainIP', result.resolved_ip || null);
            setText('domainCreated', d.created_at ? new Date(d.created_at).toLocaleDateString() : null);
            setText('domainExpires', d.expires_at ? new Date(d.expires_at).toLocaleDateString() : null);
            domainSection.style.display = 'block';
        } else {
            domainSection.style.display = 'none';
        }
    }

    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function saveResult() {
    // In a real app, this would save to a database
    // For now, just show a message
    showToast('Result saved to your history', 'success');

    // Update saved count in stats
    const savedCount = localStorage.getItem('system_saved_results') || 0;
    localStorage.setItem('system_saved_results', parseInt(savedCount) + 1);
    updateStats();
}

function resetScanner() {
    const urlInput = document.getElementById('url-input');
    const resultsContainer = document.getElementById('results-container');

    urlInput.value = '';
    resultsContainer.style.display = 'none';
    urlInput.focus();
}

function updateStats() {
    // Load stats from localStorage or use defaults
    const totalScans = parseInt(localStorage.getItem('system_total_scans')) || 1247;
    const safeUrls = parseInt(localStorage.getItem('system_safe_urls')) || 1024;
    const phishingUrls = parseInt(localStorage.getItem('system_phishing_urls')) || 223;

    // Update display
    document.getElementById('total-scans').textContent = totalScans.toLocaleString();
    document.getElementById('safe-urls').textContent = safeUrls.toLocaleString();
    document.getElementById('phishing-urls').textContent = phishingUrls.toLocaleString();
}

function setupPasswordToggles() {
    // Setup password visibility toggles
    const toggleButtons = [
        { buttonId: 'toggle-login-password', inputId: 'login-password' },
        { buttonId: 'toggle-register-password', inputId: 'register-password' },
        { buttonId: 'toggle-confirm-password', inputId: 'confirm-password' }
    ];

    toggleButtons.forEach(({ buttonId, inputId }) => {
        const button = document.getElementById(buttonId);
        const input = document.getElementById(inputId);

        if (button && input) {
            button.addEventListener('click', () => {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);

                // Toggle eye icon
                const icon = button.querySelector('i');
                icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
            });
        }
    });
}

function setupPasswordStrength() {
    const passwordInput = document.getElementById('register-password');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');

    if (passwordInput && strengthBar && strengthText) {
        passwordInput.addEventListener('input', function () {
            const password = this.value;
            const strength = calculatePasswordStrength(password);

            // Update strength bar
            strengthBar.style.width = `${strength.score}%`;

            // Update color based on strength
            let color = '#e0e0e0';
            let text = 'None';

            if (strength.score > 0) {
                if (strength.score < 40) {
                    color = 'var(--danger-color)';
                    text = 'Weak';
                } else if (strength.score < 70) {
                    color = 'var(--warning-color)';
                    text = 'Fair';
                } else if (strength.score < 90) {
                    color = '#4caf50';
                    text = 'Good';
                } else {
                    color = 'var(--success-color)';
                    text = 'Strong';
                }
            }

            strengthBar.style.backgroundColor = color;
            strengthText.textContent = `Password strength: ${text}`;
            strengthText.style.color = color;
        });
    }
}

function calculatePasswordStrength(password) {
    let score = 0;

    if (!password) return { score: 0 };

    // Length check
    if (password.length >= 8) score += 25;
    if (password.length >= 12) score += 15;

    // Character variety checks
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 15;
    if (/\d/.test(password)) score += 15;
    if (/[^a-zA-Z0-9]/.test(password)) score += 20;

    // Bonus for no consecutive characters
    if (!/(.)\1/.test(password)) score += 10;

    return { score: Math.min(100, score) };
}

function setupFormSwitching() {
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');

    if (switchToRegister) {
        switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            closeAllModals();
            showModal('register-modal');
        });
    }

    if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            closeAllModals();
            showModal('login-modal');
        });
    }
}

// Utility Functions
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    }[type] || 'fa-info-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Modal Functions (also used by auth.js)
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent scrolling

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modalId);
            }
        });

        // Close modal with X button
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.onclick = () => closeModal(modalId);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = 'auto';
}

// Export functions for use in other files
window.showModal = showModal;
window.closeModal = closeModal;
window.showToast = showToast;