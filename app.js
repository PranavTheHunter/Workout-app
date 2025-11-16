document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DEFINE YOUR DATA ---
    const exercises = {
        'Chest': ['Bench Press', 'Dumbbell Press', 'Incline Bench Press', 'Push-ups', 'Dips'],
        'Back': ['Pull-ups', 'Deadlift', 'Bent-Over Row', 'Lat Pulldown', 'T-Bar Row'],
        'Legs': ['Squat', 'Leg Press', 'Lunges', 'Romanian Deadlift', 'Leg Curls'],
        'Shoulders': ['Overhead Press', 'Lateral Raises', 'Front Raises', 'Face Pulls'],
        'Biceps': ['Bicep Curls', 'Hammer Curls', 'Preacher Curls'],
        'Triceps': ['Tricep Pushdown', 'Skullcrushers', 'Close-Grip Bench Press'],
        'Abs': ['Crunches', 'Leg Raises', 'Plank', 'Russian Twist', 'Cable Crunches']
    };

    // --- 2. GET ELEMENT REFERENCES ---
    const pages = document.querySelectorAll('.page');
    const authPage = document.getElementById('page-auth');
    const mainDashboardPage = document.getElementById('page-main-dashboard');
    const logoutBtn = document.getElementById('logout-btn');

    // Auth page
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');

    // Main Dashboard Page
    const dashboardContainer = document.getElementById('dashboard-container');
    const logFlowContainer = document.getElementById('log-flow-container');
    const logSteps = document.querySelectorAll('.log-step');
    const backBtns = document.querySelectorAll('.back-btn');

    // Chart elements
    const chartMuscleSelect = document.getElementById('chart-muscle-select');
    const lineChartCanvas = document.getElementById('progress-chart');
    const doughnutChartCanvas = document.getElementById('muscle-doughnut-chart');

    // Log flow elements
    const muscleList = document.getElementById('muscle-list');
    const exerciseList = document.getElementById('exercise-list');
    const exerciseListTitle = document.getElementById('exercise-list-title');
    const logEntryTitle = document.getElementById('log-entry-title');
    const logForm = document.getElementById('log-form');
    const setEntries = document.getElementById('set-entries');
    const addSetBtn = document.getElementById('add-set-btn');

    // --- 3. APP STATE ---
    let currentUser = null;
    let currentMuscle = '';
    let currentExercise = '';
    let workoutLogs = []; // Local cache of user's workouts
    let lineChartInstance = null;
    let doughnutChartInstance = null;

    // --- 4. AUTHENTICATION LOGIC ---

    // Main auth state listener
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            logoutBtn.style.display = 'block';
            showMainPage('page-main-dashboard');
            // Fetch data and draw charts *after* showing the page
            fetchWorkoutsAndDrawCharts();
        } else {
            currentUser = null;
            logoutBtn.style.display = 'none';
            showMainPage('page-auth');
        }
    });
    
    // Auth form flipping
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        authPage.classList.add('show-register');
    });
    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        authPage.classList.remove('show-register');
    });

    // Handle Registration
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = registerForm['register-email'].value;
        const password = registerForm['register-password'].value;
        auth.createUserWithEmailAndPassword(email, password)
            .catch(error => alert(error.message));
    });

    // Handle Login
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => alert(error.message));
    });

    // Handle Logout
    logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });

    // --- 5. PAGE NAVIGATION LOGIC ---

    // Show a top-level page (Auth or Main)
    function showMainPage(pageId) {
        pages.forEach(page => {
            page.classList.toggle('active', page.id === pageId);
        });
    }

    // Show a step within the logging flow
    function showLogStep(stepId) {
        logSteps.forEach(step => {
            step.classList.toggle('active', step.id === stepId);
        });
        // Scroll to the logging section
        logFlowContainer.scrollIntoView({ behavior: 'smooth' });
    }

    // Back buttons in log flow
    backBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetStep = btn.getAttribute('data-target');
            showLogStep(targetStep);
        });
    });

    // --- 6. WORKOUT LOGGING FLOW ---

    // Populate Muscle List (Step 1)
    function populateMuscleList() {
        muscleList.innerHTML = '';
        Object.keys(exercises).forEach(muscle => {
            const btn = document.createElement('button');
            btn.className = 'muscle-btn';
            btn.textContent = muscle;
            btn.addEventListener('click', () => {
                currentMuscle = muscle;
                populateExerciseList(muscle);
                showLogStep('log-step-exercises');
            });
            muscleList.appendChild(btn);
        });
    }

    // Populate Exercise List (Step 2)
    function populateExerciseList(muscle) {
        exerciseList.innerHTML = '';
        exerciseListTitle.textContent = `Step 2: Select ${muscle} Exercise`;
        
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

    // Setup Log Form (Step 3)
    function setupLogForm() {
        logEntryTitle.textContent = `Step 3: Log ${currentExercise}`;
        setEntries.innerHTML = ''; 
        addSet(); // Add first set
    }

    // Add a set row to the form
    function addSet() {
        const setNumber = setEntries.children.length + 1;
        const setRow = document.createElement('div');
        setRow.className = 'set-row';
        setRow.innerHTML = `
            <label>Set ${setNumber}</label>
            <input type="number" class="reps-input" placeholder="Reps" required>
            <input type="number" class="weight-input" placeholder="Weight (kg)" required>
            <button type="button" class="remove-set-btn">&times;</button>
        `;
        setRow.querySelector('.remove-set-btn').addEventListener('click', (e) => {
            e.target.closest('.set-row').remove();
            // Re-number sets
            setEntries.querySelectorAll('.set-row label').forEach((label, index) => {
                label.textContent = `Set ${index + 1}`;
            });
        });
        setEntries.appendChild(setRow);
    }
    addSetBtn.addEventListener('click', addSet);

    // Handle Form Submission (Save Workout)
    logForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const sets = [];
        const setRows = setEntries.querySelectorAll('.set-row');
        
        setRows.forEach(row => {
            const reps = row.querySelector('.reps-input').value;
            const weight = row.querySelector('.weight-input').value;
            if (reps && weight) {
                sets.push({ reps: parseInt(reps), weight: parseFloat(weight) });
            }
        });

        if (sets.length === 0) {
            alert("Please enter at least one set.");
            return;
        }

        const logEntry = {
            userId: currentUser.uid,
            date: new Date().toISOString().split('T')[0], // 'YYYY-MM-DD'
            muscle: currentMuscle,
            exercise: currentExercise,
            sets: sets,
            totalVolume: sets.reduce((total, set) => total + (set.reps * set.weight), 0)
        };

        // Save to Firestore
        db.collection("workouts").add(logEntry)
            .then(() => {
                alert(`${currentExercise} saved!`);
                // RE-FETCH all data and update charts
                fetchWorkoutsAndDrawCharts();
                // Go back to step 1
                showLogStep('log-step-muscles');
            })
            .catch(error => {
                console.error("Error saving workout: ", error);
            });
    });

    // --- 7. DASHBOARD & CHART LOGIC ---

    // Main data fetch function
    async function fetchWorkoutsAndDrawCharts() {
        if (!currentUser) return;

        try {
            const querySnapshot = await db.collection("workouts")
                .where("userId", "==", currentUser.uid)
                .orderBy("date", "desc") // Get newest first
                .get();
            
            workoutLogs = []; // Clear local cache
            querySnapshot.forEach(doc => {
                workoutLogs.push(doc.data());
            });

            // Now that data is fresh, draw both charts
            populateChartFilter();
            drawProgressChart();
            drawMuscleDoughnutChart();

        } catch (error) {
            console.error("Error fetching workouts: ", error);
            if (error.code === 'failed-precondition') {
                alert("Error: Missing database index. Please check the browser console, click the link to create the Firebase index, and then refresh.");
            } else {
                alert("Could not load workout data.");
            }
        }
    }

    // Populate the dropdown filter for the line chart
    function populateChartFilter() {
        const loggedMuscles = [...new Set(workoutLogs.map(log => log.muscle))];
        chartMuscleSelect.innerHTML = '<option value="all">Overall Progress</option>';
        loggedMuscles.forEach(muscle => {
            const option = document.createElement('option');
            option.value = muscle;
            option.textContent = muscle;
            chartMuscleSelect.appendChild(option);
        });
    }

    // Redraw the line chart when the filter changes
    chartMuscleSelect.addEventListener('change', drawProgressChart);

    // Draw Line Chart (More Appealing)
    function drawProgressChart() {
        const ctx = lineChartCanvas.getContext('2d');
        const selectedMuscle = chartMuscleSelect.value;

        const chartLogs = workoutLogs.filter(log => {
            return selectedMuscle === 'all' || log.muscle === selectedMuscle;
        }).reverse(); // Reverse back to chronological order for chart

        const dataByDate = {};
        chartLogs.forEach(log => {
            const date = log.date;
            if (!dataByDate[date]) dataByDate[date] = 0;
            dataByDate[date] += log.totalVolume;
        });

        const sortedDates = Object.keys(dataByDate).sort();
        const chartLabels = sortedDates;
        const chartData = sortedDates.map(date => dataByDate[date]);

        if (lineChartInstance) {
            lineChartInstance.destroy();
        }

        // --- Create Gradient ---
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(0, 123, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 123, 255, 0)');
        // -------------------------

        lineChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: `Total Daily Volume (${selectedMuscle})`,
                    data: chartData,
                    backgroundColor: gradient, // Use gradient
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 2,
                    tension: 0.3, // Smoother curve
                    fill: true, // Fill the area
                    pointBackgroundColor: 'rgba(0, 123, 255, 1)'
                }]
            },
            options: {
                scales: { y: { beginAtZero: true }, x: { title: { display: true, text: 'Date' } } },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    // Draw Doughnut Chart (NEW)
    function drawMuscleDoughnutChart() {
        const ctx = doughnutChartCanvas.getContext('2d');
        
        // Get logs from the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const last30DaysLogs = workoutLogs.filter(log => new Date(log.date) > thirtyDaysAgo);

        // Sum volume by muscle
        const volumeByMuscle = {};
        last30DaysLogs.forEach(log => {
            if (!volumeByMuscle[log.muscle]) {
                volumeByMuscle[log.muscle] = 0;
            }
            volumeByMuscle[log.muscle] += log.totalVolume;
        });

        const chartLabels = Object.keys(volumeByMuscle);
        const chartData = Object.values(volumeByMuscle);

        if (doughnutChartInstance) {
            doughnutChartInstance.destroy();
        }

        doughnutChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Volume by Muscle',
                    data: chartData,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)',
                        'rgba(255, 159, 64, 0.8)',
                        'rgba(22, 7, 232, 0.8)'

                    ],
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }

    // --- 8. INITIALIZE APP ---
    populateMuscleList(); // Build the muscle buttons
    // Auth listener (onAuthStateChanged) will handle which page to show
});