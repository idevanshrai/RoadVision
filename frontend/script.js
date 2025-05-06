// ============== CONFIGURATION ==============
const API_BASE = 'http://localhost:5001'; // Using port 5001
let speedChart = null;
let timeChart = null;

// ============== SPLASH SCREEN ==============
document.addEventListener('DOMContentLoaded', () => {
    // Hide splash screen after animation completes
    setTimeout(() => {
        const splashScreen = document.querySelector('.splash-screen');
        gsap.to(splashScreen, {
            opacity: 0,
            duration: 0.8,
            ease: "power2.out",
            onComplete: () => {
                splashScreen.style.display = 'none';
                loadInitialData();
            }
        });
    }, 2500);
});

// ============== THEME MANAGEMENT ==============
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

function initTheme() {
    const savedTheme = localStorage.getItem('theme') ||
                      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    html.setAttribute('data-theme', savedTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const isDark = html.getAttribute('data-theme') === 'dark';
    themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    gsap.to(themeToggle, {
        rotation: isDark ? 30 : -30,
        duration: 0.3,
        ease: "power2.out"
    });
}

themeToggle.addEventListener('click', () => {
    const newTheme = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon();
    gsap.to('body', {
        '--primary': newTheme === 'dark' ? '#3b82f6' : '#2563eb',
        '--primary-light': newTheme === 'dark' ? '#60a5fa' : '#3b82f6',
        '--bg': newTheme === 'dark' ? '#0f172a' : '#f8fafc',
        duration: 0.5,
        ease: "power2.out"
    });
});

// ============== PARTICLES BACKGROUND ==============
function initParticles() {
    particlesJS('particles-js', {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: "#3b82f6" },
            shape: { type: "circle" },
            opacity: { value: 0.3, random: true },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 150, color: "#3b82f6", opacity: 0.2, width: 1 },
            move: { enable: true, speed: 2, direction: "none", random: true, straight: false, out_mode: "out" }
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: { enable: true, mode: "repulse" },
                onclick: { enable: true, mode: "push" }
            }
        }
    });
}

// ============== CUSTOM CURSOR ==============
function initCustomCursor() {
    const cursor = document.querySelector('.cursor');
    document.addEventListener('mousemove', (e) => {
        gsap.to(cursor, {
            x: e.clientX,
            y: e.clientY,
            duration: 0.1,
            ease: "power2.out"
        });
    });

    const interactiveElements = document.querySelectorAll(
        'button, input, .preview, .camera-upload, a, .log-entry'
    );
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            gsap.to(cursor, {
                scale: 2,
                opacity: 0.7,
                duration: 0.3,
                ease: "power2.out"
            });
        });
        el.addEventListener('mouseleave', () => {
            gsap.to(cursor, {
                scale: 1,
                opacity: 1,
                duration: 0.3,
                ease: "power2.out"
            });
        });
    });
}

// ============== FILE UPLOAD HANDLING ==============
function setupFileUploads() {
    const setupUpload = (inputId, previewId) => {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);

        preview.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                preview.classList.add('has-image');
                preview.innerHTML = '';
                const img = document.createElement('img');
                img.src = URL.createObjectURL(e.target.files[0]);
                img.classList.add('preview-image');
                preview.appendChild(img);
                gsap.from(img, {
                    opacity: 0,
                    scale: 0.8,
                    duration: 0.5,
                    ease: "back.out(1.7)"
                });
            }
        });

        ['dragover', 'dragleave', 'drop'].forEach(event => {
            preview.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        preview.addEventListener('dragover', () => {
            preview.style.borderColor = 'var(--primary)';
            preview.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        });

        preview.addEventListener('dragleave', () => {
            preview.style.borderColor = 'var(--border)';
            preview.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });

        preview.addEventListener('drop', (e) => {
            preview.style.borderColor = 'var(--border)';
            preview.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                input.dispatchEvent(new Event('change'));
            }
        });
    };

    setupUpload('uploadA', 'previewA');
    setupUpload('uploadB', 'previewB');
}

// Update the DETECTION SYSTEM section only - rest remains the same

// ============== DETECTION SYSTEM ==============
function initDetectionSystem() {
    const processBtn = document.getElementById('processBtn');
    processBtn.addEventListener('click', processImages);
}

async function processImages() {
    const processBtn = document.getElementById('processBtn');
    const logContainer = document.getElementById('detectionLog');
    const fileA = document.getElementById('uploadA').files[0];
    const fileB = document.getElementById('uploadB').files[0];
    const distance = document.getElementById('distance').value;
    const speedLimit = document.getElementById('speedLimit').value;

    if (!fileA || !fileB) {
        showToast('Please upload both images', 'error');
        return;
    }

    processBtn.disabled = true;
    processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    logContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Analyzing images...</p>
        </div>
    `;

    try {
        const formData = new FormData();
        formData.append('fileA', fileA);
        formData.append('fileB', fileB);
        formData.append('distance', distance);
        formData.append('speedLimit', speedLimit);

        const response = await fetch(`${API_BASE}/api/detect`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.error === 'Plate mismatch') {
                throw new Error(`Plate mismatch: ${data.plateA} vs ${data.plateB}`);
            } else if (data.error === 'Duplicate detection') {
                throw new Error('Duplicate detection: This plate was already processed recently');
            }
            throw new Error(data.error || 'Detection failed');
        }

        addLogEntry(data.detection);
        updateSpeedDisplay(data.detection);
        loadDetectionsForCharts();

        if (data.detection.isOverSpeed) {
            showToast(`Overspeed detected: ${data.detection.speed} mph (Limit: ${data.detection.speedLimit} mph)`, 'error');
        } else if (data.warning) {
            showToast(`Detection successful! Warning: ${data.warning}`, 'warning');
        } else {
            showToast('Detection successful!', 'success');
        }
    } catch (error) {
        console.error('Detection error:', error);
        showToast(error.message, 'error');

        if (error.message.includes('Plate mismatch')) {
            const logContainer = document.getElementById('detectionLog');
            logContainer.innerHTML = `
                <div class="log-entry alert">
                    <div style="text-align: center; width: 100%;">
                        <i class="fas fa-exclamation-triangle"></i> ${error.message}
                    </div>
                </div>
            `;
        }
    } finally {
        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fas fa-play"></i> Analyze';
    }
}

function addLogEntry(entry) {
    const logContainer = document.getElementById('detectionLog');
    if (logContainer.querySelector('.empty-state')) {
        logContainer.innerHTML = '';
    }

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${entry.isOverSpeed ? 'alert' : ''}`;

    const entryTime = entry.entry_timestamp ? new Date(entry.entry_timestamp).toLocaleTimeString() : 'N/A';
    const exitTime = entry.exit_timestamp ? new Date(entry.exit_timestamp).toLocaleTimeString() : 'N/A';

    logEntry.innerHTML = `
        <div class="log-time">
            <i class="fas fa-clock"></i> ${new Date(entry.timestamp).toLocaleString()}
        </div>
        <div class="log-plate">
            <i class="fas fa-id-card"></i> ${entry.plate || 'Unknown'} ${entry.state ? `(${entry.state})` : ''}
        </div>
        <div class="log-speed">
            <i class="fas fa-tachometer-alt"></i> ${entry.speed.toFixed(1)} mph
            ${entry.isOverSpeed ? `<span class="speed-diff">+${Math.round(entry.speed - entry.speedLimit)}</span>` : ''}
        </div>
        <div class="log-details" style="grid-column: 1 / -1; font-size: 0.8rem; color: var(--text-light);">
            <i class="fas fa-ruler"></i> Distance: ${entry.distance} ft | 
            <i class="fas fa-sign-in-alt"></i> ${entryTime} | 
            <i class="fas fa-sign-out-alt"></i> ${exitTime}
            ${entry.previous_detection ? `<br><i class="fas fa-exclamation-triangle" style="color: var(--warning);"></i> Previously detected` : ''}
            ${entry.isOverSpeed ? '<br><span style="color: var(--alert);"><i class="fas fa-exclamation-circle"></i> OVERSPEED</span>' : ''}
        </div>
    `;

    // Make log entry persistent
    gsap.from(logEntry, {
        opacity: 0,
        x: 50,
        duration: 0.5,
        ease: "power2.out",
        onComplete: () => {
            logEntry.style.opacity = '1';
            logEntry.style.transition = 'none';
        }
    });

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function updateSpeedDisplay(entry) {
    const speedValue = document.querySelector('.speed-value');
    const gauge = document.getElementById('gauge');
    const plateNumber = document.querySelector('.plate-number');

    // Remove any animations that might cause fading
    speedValue.style.transition = 'none';
    gauge.style.transition = 'none';

    // Update values directly without animation
    speedValue.textContent = entry.speed.toFixed(1);

    // Adjust gauge rotation based on speed (0-100 mph scale)
    const rotation = (Math.min(entry.speed, 100) / 100) * 180;
    gauge.style.transform = `rotate(${rotation}deg)`;

    plateNumber.textContent = entry.plate || '—';

    // Highlight if overspeed
    if (entry.isOverSpeed) {
        speedValue.style.color = 'var(--alert)';
        gauge.style.background = 'conic-gradient(var(--alert) 0% 100%)';
    } else {
        speedValue.style.color = '';
        gauge.style.background = '';
    }
}
// ============== DATA VISUALIZATION ==============
function initCharts(detections = []) {
    const speedData = [0, 0, 0, 0, 0];
    const timeData = {};

    detections.forEach(detection => {
        const speed = detection.speed;
        if (speed <= 20) speedData[0]++;
        else if (speed <= 40) speedData[1]++;
        else if (speed <= 60) speedData[2]++;
        else if (speed <= 80) speedData[3]++;
        else speedData[4]++;

        const hour = new Date(detection.timestamp).getHours();
        timeData[hour] = timeData[hour] || { sum: 0, count: 0 };
        timeData[hour].sum += speed;
        timeData[hour].count++;
    });

    // Speed Chart
    const speedCtx = document.getElementById('speedChart');
    speedChart = new Chart(speedCtx, {
        type: 'bar',
        data: {
            labels: ['0-20', '21-40', '41-60', '61-80', '81+'],
            datasets: [{
                label: 'Speed Distribution',
                data: speedData,
                backgroundColor: [
                    '#10b981',
                    '#3b82f6',
                    '#f59e0b',
                    '#ef4444',
                    '#8b5cf6'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Time Chart
    const timeCtx = document.getElementById('timeChart');
    const timeLabels = [];
    const timeAverages = [];
    for (let hour = 0; hour < 24; hour++) {
        if (timeData[hour]) {
            timeLabels.push(`${hour}:00`);
            timeAverages.push(timeData[hour].sum / timeData[hour].count);
        }
    }

    timeChart = new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [{
                label: 'Average Speed',
                data: timeAverages,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: false }
            }
        }
    });
}

function updateCharts(detections = []) {
    if (!speedChart || !timeChart) {
        initCharts(detections);
        return;
    }

    const speedData = [0, 0, 0, 0, 0];
    const timeData = {};

    detections.forEach(detection => {
        const speed = detection.speed;
        if (speed <= 20) speedData[0]++;
        else if (speed <= 40) speedData[1]++;
        else if (speed <= 60) speedData[2]++;
        else if (speed <= 80) speedData[3]++;
        else speedData[4]++;

        const hour = new Date(detection.timestamp).getHours();
        timeData[hour] = timeData[hour] || { sum: 0, count: 0 };
        timeData[hour].sum += speed;
        timeData[hour].count++;
    });

    // Update speed chart
    speedChart.data.datasets[0].data = speedData;
    speedChart.update();

    // Update time chart
    const timeLabels = [];
    const timeAverages = [];
    for (let hour = 0; hour < 24; hour++) {
        if (timeData[hour]) {
            timeLabels.push(`${hour}:00`);
            timeAverages.push(timeData[hour].sum / timeData[hour].count);
        }
    }

    timeChart.data.labels = timeLabels;
    timeChart.data.datasets[0].data = timeAverages;
    timeChart.update();
}

// ============== UTILITY FUNCTIONS ==============
function initExportButton() {
    document.getElementById('exportBtn').addEventListener('click', async () => {
        try {
            const response = await fetch(`${API_BASE}/api/detections`);
            if (response.ok) {
                const detections = await response.json();
                let csvContent = "Timestamp,Plate,State,Speed (mph),Speed Limit,Over Speed,Entry Time,Exit Time,Distance (ft),Previous Detection\n";
                detections.forEach(detection => {
                    csvContent += `"${detection.timestamp}","${detection.plate || ''}","${detection.state || ''}",` +
                                 `${detection.speed},${detection.speedLimit},${detection.isOverSpeed},` +
                                 `"${detection.entry_timestamp}","${detection.exit_timestamp}",` +
                                 `${detection.distance},"${detection.previous_detection || ''}"\n`;
                });

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `luminplate_export_${new Date().toISOString().slice(0,10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                showToast('Report exported successfully', 'success');
            } else {
                showToast('Failed to load data for export', 'error');
            }
        } catch (error) {
            showToast('Export failed: ' + error.message, 'error');
        }
    });
}

function initClearButton() {
    document.getElementById('clearBtn').addEventListener('click', () => {
        document.getElementById('detectionLog').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No detections yet. Upload images to begin.</p>
            </div>
        `;

        gsap.to('.speed-value', { innerText: 0, duration: 0.5 });
        gsap.to('#gauge', { rotation: 0, duration: 0.5 });
        document.querySelector('.plate-number').textContent = '—';
        gsap.from('.speed-display', {
            scale: 0.9,
            duration: 0.5,
            ease: "back.out(1.7)"
        });
    });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(toast);

    gsap.from(toast, {
        y: 50,
        opacity: 0,
        duration: 0.3
    });

    setTimeout(() => {
        gsap.to(toast, {
            opacity: 0,
            y: -20,
            duration: 0.3,
            onComplete: () => toast.remove()
        });
    }, 3000);
}

// ============== INITIALIZE EVERYTHING ==============
function initApp() {
    initTheme();
    initParticles();
    initCustomCursor();
    setupFileUploads();
    initDetectionSystem();
    initExportButton();
    initClearButton();

    gsap.from('.hero-text h2', {
        y: 50,
        opacity: 0,
        duration: 0.8,
        delay: 2.6
    });

    gsap.from('.hero-text p', {
        y: 50,
        opacity: 0,
        duration: 0.8,
        delay: 2.8
    });

    gsap.from('.hero-image', {
        y: 50,
        opacity: 0,
        duration: 0.8,
        delay: 3.0
    });

    gsap.from('.upload-section', {
        y: 50,
        opacity: 0,
        duration: 0.8,
        delay: 3.2
    });
}

// Start the application
document.addEventListener('DOMContentLoaded', initApp);