document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DATA ---
    const exercises = {
        'Chest': ['Bench Press', 'Incline Press', 'Push-ups', 'Flyes'],
        'Back': ['Pull-ups', 'Lat Pulldown', 'Rows', 'Deadlift'],
        'Legs': ['Squat', 'Leg Press', 'Lunges', 'Extensions'],
        'Shoulders': ['Overhead Press', 'Lateral Raise', 'Front Raise'],
        'Arms': ['Bicep Curl', 'Tricep Extension', 'Hammer Curl', 'Dips']
    };

    // --- 2. STATE ---
    let currentUser = null;
    let userRole = 'client'; // 'client' or 'trainer'
    let viewTargetId = null; // If trainer is viewing a client
    
    // Tracker State
    let currentMuscle = '';
    let currentExercise = '';

    // --- 3. DOM ELEMENTS ---
    const appLayout = document.getElementById('app-layout');
    const authPage = document.getElementById('page-auth');
    const clientNav = document.getElementById('client-nav');
    const userBadge = document.getElementById('user-badge');
    
    // Auth Forms
    const roleOptions = document.querySelectorAll('.role-option');
    const trainerCodeGroup = document.getElementById('trainer-code-group');
    
    // Sections
    const sections = document.querySelectorAll('.page-section');
    
    // --- 4. AUTH LOGIC ---

    // Toggle Role in Register Form
    roleOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            roleOptions.forEach(r => r.classList.remove('active'));
            opt.classList.add('active');
            const role = opt.getAttribute('data-role');
            // Show/Hide Trainer Code input based on role
            trainerCodeGroup.style.display = role === 'client' ? 'block' : 'none';
        });
    });

    // REGISTER
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const role = document.querySelector('.role-option.active').getAttribute('data-role');
        const trainerEmail = document.getElementById('trainer-code').value;

        auth.createUserWithEmailAndPassword(email, password).then(cred => {
            // Create User Profile in Firestore
            return db.collection('users').doc(cred.user.uid).set({
                email: email,
                role: role,
                trainerEmail: role === 'client' ? trainerEmail : null
            });
        }).then(() => {
            alert("Account Created! Logging in...");
        }).catch(err => alert(err.message));
    });

    // LOGIN
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, password).catch(err => alert(err.message));
    });

    // LOGOUT
    document.getElementById('logout-btn').addEventListener('click', () => {
        auth.signOut();
        window.location.reload();
    });

    // AUTH STATE CHANGED (The Main Router)
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            // Fetch User Role
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    userRole = data.role;
                    userBadge.textContent = userRole; // Update Badge
                    
                    authPage.style.display = 'none';
                    appLayout.style.display = 'block';

                    if (userRole === 'trainer') {
                        setupTrainerView(user.email);
                    } else {
                        setupClientView(user.uid);
                    }
                } else {
                    // Fallback if no doc (legacy users)
                    setupClientView(user.uid);
                }
            });
        } else {
            appLayout.style.display = 'none';
            authPage.style.display = 'flex';
        }
    });

    // --- 5. TRAINER LOGIC ---

    function setupTrainerView(trainerEmail) {
        clientNav.style.display = 'none'; // Hide bottom nav
        showSection('page-trainer-dashboard');

        const container = document.getElementById('client-list-container');
        container.innerHTML = '<p>Loading clients...</p>';

        // Find users who listed this trainer's email
        db.collection('users').where('trainerEmail', '==', trainerEmail).get().then(snap => {
            container.innerHTML = '';
            if (snap.empty) {
                container.innerHTML = '<p>No clients linked yet. Tell them to enter your email when registering.</p>';
                return;
            }
            snap.forEach(doc => {
                const client = doc.data();
                const card = document.createElement('div');
                card.className = 'client-card';
                card.innerHTML = `
                    <div class="client-email">${client.email}</div>
                    <i class="fas fa-chevron-right client-arrow"></i>
                `;
                card.addEventListener('click', () => {
                    loadClientStats(doc.id, client.email);
                });
                container.appendChild(card);
            });
        });
    }

    function loadClientStats(clientId, clientEmail) {
        // Trainer viewing a client
        showSection('page-dashboard');
        document.getElementById('dashboard-title').textContent = `${clientEmail.split('@')[0]}'s Progress`;
        
        // Show Back Button
        const backBtn = document.getElementById('trainer-back-btn');
        backBtn.style.display = 'inline-block';
        backBtn.onclick = () => showSection('page-trainer-dashboard');

        fetchStats(clientId);
    }

    // --- 6. CLIENT LOGIC ---

    function setupClientView(uid) {
        clientNav.style.display = 'flex';
        document.getElementById('trainer-back-btn').style.display = 'none';
        document.getElementById('dashboard-title').textContent = "My Progress";
        showSection('page-dashboard');
        fetchStats(uid);
    }

    // --- 7. FETCH & CALCULATE PROGRESS (The Core Logic) ---

    async function fetchStats(targetUid) {
        // Fetch all workouts for target
        const snap = await db.collection('workouts')
                             .where('userId', '==', targetUid)
                             .orderBy('date', 'desc') // Newest first
                             .get();
        
        const workouts = [];
        snap.forEach(doc => workouts.push(doc.data()));

        calculateGains(workouts);
        renderHistory(workouts);
        renderVolumeChart(workouts);
    }

    function calculateGains(workouts) {
        const container = document.getElementById('progress-cards-container');
        container.innerHTML = '';

        if (workouts.length < 2) {
            container.innerHTML = '<p class="empty-state">Log at least 2 workouts to see comparison.</p>';
            return;
        }

        // Group by Exercise
        const history = {};
        // Workouts are desc (Newest index 0, Oldest index N)
        workouts.forEach(w => {
            if (!history[w.exercise]) history[w.exercise] = [];
            history[w.exercise].push(w);
        });

        // Compare latest vs previous for each exercise
        Object.keys(history).forEach(exName => {
            const sessions = history[exName];
            if (sessions.length >= 2) {
                const latest = sessions[0];
                const previous = sessions[1];

                // Simple Logic: Compare Max Weight lifted in first set (or avg)
                // Let's compare "Best Set" (Weight * Reps)
                const getBestSet = (sets) => {
                    let max = 0;
                    let display = {w:0, r:0};
                    sets.forEach(s => {
                        let vol = s.weight * s.reps;
                        if (vol > max) { max = vol; display = {w:s.weight, r:s.reps}; }
                    });
                    return display;
                };

                const curr = getBestSet(latest.sets);
                const prev = getBestSet(previous.sets);

                let diffText = '';
                let type = 'neutral';

                if (curr.w > prev.w) {
                    diffText = `+${curr.w - prev.w}kg`;
                    type = 'gain';
                } else if (curr.w === prev.w && curr.r > prev.r) {
                    diffText = `+${curr.r - prev.r} reps`;
                    type = 'gain';
                } else if (curr.w < prev.w) {
                    diffText = `${curr.w - prev.w}kg`;
                    type = 'loss';
                } else {
                    diffText = "No Change";
                }

                // Only show if there is a gain/loss or recent activity
                const card = document.createElement('div');
                card.className = 'prog-card';
                card.innerHTML = `
                    <div class="prog-exercise">${exName}</div>
                    <div class="prog-val ${type}">
                        ${type === 'gain' ? '▲' : (type === 'loss' ? '▼' : '-')} ${diffText}
                    </div>
                    <div class="prog-detail">vs Last Session</div>
                `;
                container.appendChild(card);
            }
        });
    }

    // --- 8. RENDERERS ---

    function renderHistory(logs) {
        const container = document.getElementById('log-table-container');
        if(logs.length === 0) { container.innerHTML = '<p>No history found.</p>'; return;}
        
        let html = `<table><tr><th>Date</th><th>Exercise</th><th>Top Set</th></tr>`;
        logs.forEach(l => {
            // Find heaviest set
            let maxW = 0; let maxR = 0;
            l.sets.forEach(s => { if(s.weight > maxW) { maxW = s.weight; maxR = s.reps; } });

            html += `<tr>
                <td>${l.date.substring(5)}</td>
                <td style="color:white">${l.exercise}</td>
                <td>${maxR}x${maxW}kg</td>
            </tr>`;
        });
        html += '</table>';
        container.innerHTML = html;
    }

    function renderVolumeChart(logs) {
        const ctx = document.getElementById('progress-chart').getContext('2d');
        // Aggregate by date
        const volMap = {};
        // Reverse logs to show oldest to newest on chart
        [...logs].reverse().forEach(l => {
            volMap[l.date] = (volMap[l.date] || 0) + l.totalVolume;
        });
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(volMap),
                datasets: [{
                    label: 'Volume',
                    data: Object.values(volMap),
                    borderColor: '#66fcf1',
                    backgroundColor: 'rgba(102, 252, 241, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: {display: false} },
                scales: { x: { ticks: { color: '#888'} }, y: { ticks: { color: '#888'} } }
            }
        });
    }

    // --- 9. NAVIGATION & UTILS ---

    function showSection(id) {
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    // Bottom Nav (Clients only)
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            if (userRole === 'client') {
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                showSection(btn.dataset.target);
            }
        });
    });

    // Tracker Flow (Same as before, minimal updates)
    populateMuscleList();
    function populateMuscleList() {
        const list = document.getElementById('muscle-list');
        list.innerHTML = '';
        Object.keys(exercises).forEach(m => {
            const btn = document.createElement('button');
            btn.className = 'muscle-btn';
            btn.textContent = m;
            btn.onclick = () => { currentMuscle = m; populateExercises(m); showLogStep('log-step-exercises'); };
            list.appendChild(btn);
        });
    }
    function populateExercises(m) {
        const list = document.getElementById('exercise-list');
        list.innerHTML = '';
        exercises[m].forEach(ex => {
            const btn = document.createElement('button');
            btn.className = 'exercise-btn';
            btn.textContent = ex;
            btn.onclick = () => { currentExercise = ex; setupForm(); showLogStep('log-step-entry'); };
            list.appendChild(btn);
        });
    }
    function setupForm() {
        document.getElementById('log-entry-title').textContent = currentExercise;
        document.getElementById('set-entries').innerHTML = '';
        addSet();
    }
    function addSet() {
        const row = document.createElement('div');
        row.className = 'input-group'; // Reuse existing style
        row.innerHTML = `<input type="number" placeholder="Reps" class="reps-in" style="width:45%; display:inline-block"> <input type="number" placeholder="Kg" class="weight-in" style="width:45%; display:inline-block">`;
        document.getElementById('set-entries').appendChild(row);
    }
    document.getElementById('add-set-btn').onclick = addSet;
    document.querySelector('.back-link').onclick = () => showLogStep('log-step-muscles'); // Simplification
    
    function showLogStep(id) {
        document.querySelectorAll('.log-step').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    document.getElementById('log-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const sets = [];
        document.querySelectorAll('#set-entries div').forEach(row => {
            const r = row.querySelector('.reps-in').value;
            const w = row.querySelector('.weight-in').value;
            if (r && w) sets.push({reps: Number(r), weight: Number(w)});
        });
        
        db.collection('workouts').add({
            userId: currentUser.uid,
            date: new Date().toISOString().split('T')[0],
            muscle: currentMuscle,
            exercise: currentExercise,
            sets: sets,
            totalVolume: sets.reduce((a,b)=>a+(b.reps*b.weight),0)
        }).then(() => {
            alert("Saved!");
            fetchStats(currentUser.uid); // Refresh
            if(userRole === 'client') showSection('page-dashboard');
        });
    });

    // Forms Toggles
    document.getElementById('show-register').onclick = () => {
        document.getElementById('page-auth').classList.add('show-register');
    };
    document.getElementById('show-login').onclick = () => {
        document.getElementById('page-auth').classList.remove('show-register');
    };
});