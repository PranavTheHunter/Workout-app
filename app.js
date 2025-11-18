document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DATA & CONFIG ---
    const exercises = {
        'Chest': ['Bench Press', 'Dumbbell Press', 'Incline Bench Press', 'Push-ups', 'Dips', 'Chest Flys'],
        'Back': ['Pull-ups', 'Deadlift', 'Bent-Over Row', 'Lat Pulldown', 'Seated Row', 'T-Bar Row'],
        'Legs': ['Squat', 'Leg Press', 'Lunges', 'Romanian Deadlift', 'Leg Extension', 'Calf Raises'],
        'Shoulders': ['Overhead Press', 'Lateral Raises', 'Front Raises', 'Face Pulls', 'Shrugs'],
        'Biceps': ['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl'],
        'Triceps': ['Tricep Pushdown', 'Skullcrushers', 'Dips', 'Overhead Extension'],
        'Abs': ['Crunches', 'Leg Raises', 'Plank', 'Russian Twist', 'Cable Crunches']
    };

    const quotes = [
        "The only bad workout is the one that didn't happen.",
        "Sore today, strong tomorrow.",
        "Don't stop when you're tired. Stop when you're done.",
        "Your body can stand almost anything. It’s your mind that you have to convince.",
        "Fitness is not about being better than someone else. It’s about being better than you were yesterday."
    ];

    // --- 2. ELEMENT REFERENCES ---
    // Auth
    const authPage = document.getElementById('page-auth');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const appLayout = document.getElementById('app-layout');
    const logoutBtn = document.getElementById('logout-btn');

    // Navigation & Views
    const navItems = document.querySelectorAll('.nav-item');
    const pageViews = document.querySelectorAll('.page-view');
    const motivationText = document.getElementById('daily-quote');

    // Tracker Flow
    const logSteps = document.querySelectorAll('.log-step');
    const muscleList = document.getElementById('muscle-list');
    const exerciseList = document.getElementById('exercise-list');
    const exerciseListTitle = document.getElementById('exercise-list-title');
    const logEntryTitle = document.getElementById('log-entry-title');
    const logForm = document.getElementById('log-form');
    const setEntries = document.getElementById('set-entries');
    const addSetBtn = document.getElementById('add-set-btn');
    const backLinks = document.querySelectorAll('.back-link');

    // Charts & History
    const chartMuscleSelect = document.getElementById('chart-muscle-select');
    const lineChartCanvas = document.getElementById('progress-chart');
    const doughnutChartCanvas = document.getElementById('muscle-doughnut-chart');
    const logTableContainer = document.getElementById('log-table-container');
    const logFilterDate = document.getElementById('log-filter-date');
    const logFilterClear = document.getElementById('log-filter-clear');

    // State
    let currentUser = null;
    let currentMuscle = '';
    let currentExercise = '';
    let workoutLogs = [];
    let lineChartInstance = null;
    let doughnutChartInstance = null;


    // --- 3. INITIALIZATION ---
    
    // Set random quote
    motivationText.textContent = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;

    // Auth Listener
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            authPage.classList.remove('active');
            appLayout.style.display = 'block'; // Show main app
            fetchWorkoutsAndDrawCharts();
            switchTab('page-dashboard'); // Default to dashboard
        } else {
            currentUser = null;
            appLayout.style.display = 'none';
            authPage.classList.add('active');
        }
    });

    // --- 4. NAVIGATION LOGIC ---

    // Tab Switching
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            switchTab(targetId);
        });
    });

    function switchTab(pageId) {
        // Update Bottom Nav UI
        navItems.forEach(nav => {
            nav.classList.toggle('active', nav.getAttribute('data-target') === pageId);
        });

        // Show Section
        pageViews.forEach(view => {
            view.classList.toggle('active', view.id === pageId);
        });
    }

    // Auth Flipping
    showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); authPage.classList.add('show-register'); });
    showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); authPage.classList.remove('show-register'); });
    
    // Auth Forms
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        auth.createUserWithEmailAndPassword(email, password).catch(err => alert(err.message));
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, password).catch(err => alert(err.message));
    });

    logoutBtn.addEventListener('click', () => auth.signOut());


    // --- 5. TRACKER LOGIC (The Wizard) ---

    // Step 1: Muscles
    function populateMuscleList() {
        muscleList.innerHTML = '';
        Object.keys(exercises).forEach(muscle => {
            const btn = document.createElement('button');
            btn.className = 'muscle-btn';
            btn.innerHTML = `<i class="fas fa-dumbbell"></i> ${muscle}`;
            btn.addEventListener('click', () => {
                currentMuscle = muscle;
                populateExerciseList(muscle);
                showLogStep('log-step-exercises');
            });
            muscleList.appendChild(btn);
        });
    }

    // Step 2: Exercises
    function populateExerciseList(muscle) {
        exerciseList.innerHTML = '';
        exerciseListTitle.textContent = `Select ${muscle} Exercise`;
        exercises[muscle].forEach(exercise => {
            const btn = document.createElement('button');
            btn.className = 'exercise-btn';
            btn.textContent = exercise;
            btn.addEventListener('click', () => {
                currentExercise = exercise;
                setupLogForm();
                showLogStep('log-step-entry');
            });
            exerciseList.appendChild(btn);
        });
    }

    // Step 3: Form
    function setupLogForm() {
        logEntryTitle.textContent = `Log: ${currentExercise}`;
        setEntries.innerHTML = '';
        addSet();
    }

    function addSet() {
        const setNumber = setEntries.children.length + 1;
        const row = document.createElement('div');
        row.className = 'set-row';
        row.innerHTML = `
            <span class="set-label">#${setNumber}</span>
            <input type="number" class="reps-input" placeholder="Reps" required>
            <input type="number" class="weight-input" placeholder="Kg" required>
            <button type="button" class="remove-set-btn">&times;</button>
        `;
        
        row.querySelector('.remove-set-btn').addEventListener('click', (e) => {
            e.target.closest('.set-row').remove();
            renumberSets();
        });
        setEntries.appendChild(row);
    }

    function renumberSets() {
        const rows = setEntries.querySelectorAll('.set-row');
        rows.forEach((row, index) => {
            row.querySelector('.set-label').textContent = `#${index + 1}`;
        });
    }

    // Navigation helpers for the tracker flow
    function showLogStep(stepId) {
        logSteps.forEach(step => step.classList.toggle('active', step.id === stepId));
    }
    backLinks.forEach(btn => {
        btn.addEventListener('click', () => showLogStep(btn.getAttribute('data-target')));
    });
    addSetBtn.addEventListener('click', addSet);

    // Save Workout
    logForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const sets = [];
        setEntries.querySelectorAll('.set-row').forEach(row => {
            const reps = row.querySelector('.reps-input').value;
            const weight = row.querySelector('.weight-input').value;
            if(reps && weight) sets.push({ reps: Number(reps), weight: Number(weight) });
        });

        if (sets.length === 0) return alert("Add at least one set!");

        const totalVolume = sets.reduce((sum, s) => sum + (s.reps * s.weight), 0);
        
        const logEntry = {
            userId: currentUser.uid,
            date: new Date().toISOString().split('T')[0],
            muscle: currentMuscle,
            exercise: currentExercise,
            sets: sets,
            totalVolume: totalVolume
        };

        db.collection("workouts").add(logEntry).then(() => {
            alert("Workout Saved! Great job!");
            fetchWorkoutsAndDrawCharts(); // Refresh data
            showLogStep('log-step-muscles'); // Reset tracker
            switchTab('page-history'); // Show the user their new log
        }).catch(err => console.error(err));
    });


    // --- 6. DATA & CHARTS ---

    async function fetchWorkoutsAndDrawCharts() {
        if (!currentUser) return;
        try {
            const snapshot = await db.collection("workouts")
                .where("userId", "==", currentUser.uid)
                .orderBy("date", "desc")
                .get();
            
            workoutLogs = [];
            snapshot.forEach(doc => workoutLogs.push(doc.data()));

            populateChartFilter();
            drawProgressChart();
            drawMuscleDoughnutChart();
            renderHistoryTable(workoutLogs);

        } catch (error) {
            console.error("Data Error:", error);
            if (error.code === 'failed-precondition') {
                 alert("Console Error: Index needed. Check console for link.");
            }
        }
    }

    // History Table Rendering
    function renderHistoryTable(logs) {
        if (!logs.length) {
            logTableContainer.innerHTML = '<p style="text-align:center; padding:20px;">No workouts logged yet. Go track one!</p>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Exercise</th>
                        <th>Sets Details</th>
                        <th>Vol</th>
                    </tr>
                </thead>
                <tbody>
        `;

        logs.forEach(log => {
            // Create visual tags for sets: "10x50kg"
            const setsHtml = log.sets.map(s => 
                `<span class="set-tag">${s.reps}x${s.weight}</span>`
            ).join(' ');

            html += `
                <tr>
                    <td style="white-space:nowrap;">${log.date}</td>
                    <td>
                        <div style="color:white; font-weight:bold;">${log.exercise}</div>
                        <div style="font-size:0.8em; color:#e94560;">${log.muscle}</div>
                    </td>
                    <td>${setsHtml}</td>
                    <td style="font-weight:bold;">${log.totalVolume}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        logTableContainer.innerHTML = html;
    }

    // Filter Logic
    logFilterDate.addEventListener('change', () => {
        const date = logFilterDate.value;
        if (date) {
            const filtered = workoutLogs.filter(l => l.date === date);
            renderHistoryTable(filtered);
        }
    });
    logFilterClear.addEventListener('click', () => {
        logFilterDate.value = '';
        renderHistoryTable(workoutLogs);
    });

    // Chart 1: Progress Line
    function populateChartFilter() {
        const muscles = [...new Set(workoutLogs.map(l => l.muscle))];
        chartMuscleSelect.innerHTML = '<option value="all">Overall Volume</option>';
        muscles.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            chartMuscleSelect.appendChild(opt);
        });
    }
    
    chartMuscleSelect.addEventListener('change', drawProgressChart);

    function drawProgressChart() {
        const ctx = lineChartCanvas.getContext('2d');
        const selection = chartMuscleSelect.value;

        // Filter and Sort for Chart (Oldest first)
        const relevantLogs = workoutLogs.filter(l => 
            selection === 'all' || l.muscle === selection
        ).reverse(); 

        // Aggregate by Date
        const dataMap = {};
        relevantLogs.forEach(l => {
            dataMap[l.date] = (dataMap[l.date] || 0) + l.totalVolume;
        });

        const labels = Object.keys(dataMap);
        const data = Object.values(dataMap);

        if (lineChartInstance) lineChartInstance.destroy();

        // Create Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(233, 69, 96, 0.6)'); // Sporty Red
        gradient.addColorStop(1, 'rgba(233, 69, 96, 0.0)');

        lineChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Volume (kg)',
                    data: data,
                    borderColor: '#e94560',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#aeb8c3' } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#aeb8c3' } }
                }
            }
        });
    }

    // Chart 2: Muscle Doughnut
    function drawMuscleDoughnutChart() {
        const ctx = doughnutChartCanvas.getContext('2d');
        // Last 30 days
        const limit = new Date(); limit.setDate(limit.getDate() - 30);
        const recentLogs = workoutLogs.filter(l => new Date(l.date) >= limit);

        const counts = {};
        recentLogs.forEach(l => counts[l.muscle] = (counts[l.muscle] || 0) + 1);

        if (doughnutChartInstance) doughnutChartInstance.destroy();

        doughnutChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(counts),
                datasets: [{
                    data: Object.values(counts),
                    backgroundColor: [
                        '#e94560', '#0f3460', '#533483', '#16213e', '#e9456088', '#ffffff'
                    ],
                    borderColor: '#1a1a2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#fff' } } }
            }
        });
    }

    // Start
    populateMuscleList();
});