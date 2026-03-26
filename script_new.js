document.addEventListener('DOMContentLoaded', function () {
            // Check authentication
            const token = localStorage.getItem('token');
            if (!token && !window.location.href.includes('login.html') &&
                !window.location.href.includes('signup.html')) {
                window.location.href = 'login.html';
                return;
            }

            // Load user data
            loadUserData();
            setupLogout();
        });

        function loadUserData() {
            try {
                const userData = JSON.parse(localStorage.getItem('user'));

                if (userData) {
                    // Update all user name elements
                    document.querySelectorAll('.user-name').forEach(el => {
                        el.textContent = userData.fullName || userData.email || 'User';
                    });

                    // Update all user role elements
                    document.querySelectorAll('.user-role').forEach(el => {
                        const roleDisplay = {
                            'admin': 'Administrator',
                            'cashier': 'Cashier',
                            'manager': 'Manager'
                        };
                        el.textContent = roleDisplay[userData.role] || userData.role || 'User';
                    });

                    // Update avatar initials
                    document.querySelectorAll('.avatar').forEach(el => {
                        if (userData.fullName) {
                            el.textContent = userData.fullName.charAt(0).toUpperCase();
                        } else if (userData.email) {
                            el.textContent = userData.email.charAt(0).toUpperCase();
                        }
                    });

                    // Update business name in title if available
                    if (userData.business && userData.business.name) {
                        document.title = `${userData.business.name} - Orion POS`;
                    }
                }
            } catch (error) {
                console.error('Error loading user data:', error);
            }
        }

        function setupLogout() {
            document.querySelectorAll('.logout-btn').forEach(btn => {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();

                    // Clear user data from localStorage
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');

                    // Redirect to login page
                    window.location.href = 'login.html';
                });
            });
        }