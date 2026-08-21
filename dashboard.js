class TestDashboard {
    constructor() {
        // Auto-detect: resolved properly in initializeDashboard() once the
        // current page URL is known (handles cPanel sub-path deployments).
        this.serverUrl = '';
        this.socket = null;
        this.loadTestActive = false;
        this.monitoringActive = false;
        this.monitoringInterval = null;
        this.loadTestStats = {
            completed: 0,
            errors: 0,
            totalTime: 0,
            startTime: null
        };
        this.messagesSent = 0;
        this.messagesReceived = 0;
        
        this.initializeDashboard();
    }

    initializeDashboard() {
        this.log('info', '🚀 Dashboard initialized successfully');
        
        // Auto-detect the server URL based on where this page is being served from.
        // When cPanel hosts the app under a sub-path (e.g. /test/dashboard.html),
        // window.location.origin alone points to the root domain which returns HTML,
        // not our API. We strip the filename and trailing slash from the current
        // URL path so that API calls go to the same base path as this page.
        const pagePath = window.location.pathname; // e.g. /test/dashboard.html
        const basePath = pagePath.substring(0, pagePath.lastIndexOf('/')); // e.g. /test
        this.serverUrl = window.location.origin + basePath; // e.g. https://ficertech.com/test

        // Populate the URL input with the auto-detected origin
        const urlInput = document.getElementById('server-url');
        if (!urlInput.value) {
            urlInput.value = this.serverUrl;
        } else {
            // User has a value pre-filled – respect it
            this.serverUrl = urlInput.value.replace(/\/$/, '');
        }
        document.getElementById('current-server').textContent = this.serverUrl;
    }

    log(type, message) {
        const logsContainer = document.getElementById('logs');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        logsContainer.appendChild(logEntry);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    async makeRequest(endpoint, options = {}) {
        try {
            const url = `${this.serverUrl}${endpoint}`;
            const startTime = Date.now();
            
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: options.body ? JSON.stringify(options.body) : undefined
            });
            
            const duration = Date.now() - startTime;
            const data = await response.json();
            
            return { success: response.ok, data, duration, status: response.status };
        } catch (error) {
            return { success: false, error: error.message, duration: 0 };
        }
    }

    updateMetric(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    // Configuration Methods
    setServerUrl() {
        const urlInput = document.getElementById('server-url');
        this.serverUrl = urlInput.value.replace(/\/$/, ''); // Remove trailing slash
        document.getElementById('current-server').textContent = this.serverUrl;
        this.log('info', `Server URL set to: ${this.serverUrl}`);
        
        // Disconnect socket if connected to different server
        if (this.socket && this.socket.connected) {
            this.disconnectSocket();
        }
    }

    async testConnection() {
        this.log('info', '🔄 Testing connection to server...');
        const result = await this.makeRequest('/');
        
        if (result.success) {
            this.log('success', `✅ Connection successful (${result.duration}ms)`);
            document.getElementById('connection-status').className = 'status success';
            document.getElementById('connection-status').textContent = 'Connected';
        } else {
            this.log('error', `❌ Connection failed: ${result.error}`);
            document.getElementById('connection-status').className = 'status error';
            document.getElementById('connection-status').textContent = 'Failed';
        }
    }

    // API Testing Methods
    async runTest(endpoint) {
        const testName = endpoint.replace('/', '').replace('-test', '');
        this.log('info', `🧪 Running ${testName} test...`);
        
        const result = await this.makeRequest(endpoint === '/health' ? '/' : endpoint);
        
        if (result.success) {
            this.log('success', `✅ ${testName} test passed (${result.duration}ms)`);
            this.log('info', `📄 Response: ${JSON.stringify(result.data).substring(0, 100)}...`);
        } else {
            this.log('error', `❌ ${testName} test failed: ${result.error || result.data?.error}`);
        }
    }

    // Load Testing Methods
    async runLoadTest() {
        if (this.loadTestActive) {
            this.log('warning', '⚠️ Load test already running');
            return;
        }

        const concurrency = parseInt(document.getElementById('concurrency').value);
        const totalRequests = parseInt(document.getElementById('total-requests').value);
        
        this.loadTestActive = true;
        this.loadTestStats = {
            completed: 0,
            errors: 0,
            totalTime: 0,
            startTime: Date.now(),
            firstError: null
        };

        this.log('info', `🚀 Starting load test: ${totalRequests} requests, ${concurrency} concurrent`);
        
        document.getElementById('load-test-btn').disabled = true;
        
        // Run requests in batches to maintain concurrency
        const promises = [];
        let requestsStarted = 0;
        
        const runBatch = async () => {
            while (requestsStarted < totalRequests && this.loadTestActive) {
                if (promises.length < concurrency) {
                    const requestPromise = this.runSingleLoadRequest();
                    promises.push(requestPromise);
                    requestsStarted++;
                    
                    // Remove completed promises
                    requestPromise.finally(() => {
                        const index = promises.indexOf(requestPromise);
                        if (index > -1) promises.splice(index, 1);
                    });
                }
                
                // Wait a bit before checking again
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        };

        await runBatch();
        
        // Wait for all remaining requests to complete
        await Promise.all(promises);
        
        this.finishLoadTest();
    }

    async runSingleLoadRequest() {
        const result = await this.makeRequest('/pos-test');
        
        this.loadTestStats.completed++;
        if (result.success) {
            this.loadTestStats.totalTime += result.duration;
        } else {
            this.loadTestStats.errors++;
            // Surface a useful first-error message so users know why requests fail
            if (!this.loadTestStats.firstError) {
                const reason = result.data?.message || result.error || `HTTP ${result.status}`;
                this.loadTestStats.firstError = reason;
            }
        }
        
        this.updateLoadTestUI();
    }

    updateLoadTestUI() {
        const { completed, errors, totalTime, startTime } = this.loadTestStats;
        const totalRequests = parseInt(document.getElementById('total-requests').value);
        
        this.updateMetric('completed-requests', completed);
        this.updateMetric('error-count', errors);
        
        const successfulRequests = completed - errors;
        const avgLatency = successfulRequests > 0 ? Math.round(totalTime / successfulRequests) : 0;
        this.updateMetric('avg-latency', successfulRequests > 0 ? avgLatency + 'ms' : 'N/A');
        
        const elapsedTime = (Date.now() - startTime) / 1000;
        const rps = Math.round(completed / elapsedTime);
        this.updateMetric('requests-per-sec', rps);
        
        const progress = (completed / totalRequests) * 100;
        document.getElementById('load-progress').style.width = `${progress}%`;
    }

    stopLoadTest() {
        if (!this.loadTestActive) return;
        
        this.loadTestActive = false;
        this.log('warning', '⏹️ Load test stopped by user');
        this.finishLoadTest();
    }

    finishLoadTest() {
        this.loadTestActive = false;
        document.getElementById('load-test-btn').disabled = false;
        
        const { completed, errors, totalTime, startTime, firstError } = this.loadTestStats;
        const elapsedTime = (Date.now() - startTime) / 1000;
        const successfulRequests = completed - errors;
        const avgLatency = successfulRequests > 0 ? Math.round(totalTime / successfulRequests) : 0;
        const avgDisplay = successfulRequests > 0 ? `${avgLatency}ms` : 'N/A';
        const successRate = completed > 0 ? Math.round((successfulRequests / completed) * 100) : 0;
        
        this.log('success', `✅ Load test completed: ${completed} requests in ${elapsedTime.toFixed(2)}s`);
        this.log('info', `📊 Results: ${successfulRequests} succeeded, ${errors} errors (${successRate}% success rate), ${avgDisplay} avg latency`);
        if (errors > 0 && firstError) {
            this.log('error', `⚠️ Failure reason: ${firstError}`);
        }
    }

    // Socket.IO Methods
    connectSocket() {
        if (this.socket && this.socket.connected) {
            this.log('warning', '⚠️ Socket already connected');
            return;
        }

        this.log('info', '🔌 Connecting to Socket.IO...');
        
        this.socket = io(this.serverUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 3
        });

        this.socket.on('connect', () => {
            this.log('success', `✅ Socket.IO connected: ${this.socket.id}`);
            this.updateMetric('socket-connection', '✅');
            document.getElementById('socket-test-btn').disabled = false;
        });

        this.socket.on('disconnect', () => {
            this.log('warning', '🔌 Socket.IO disconnected');
            this.updateMetric('socket-connection', '❌');
            document.getElementById('socket-test-btn').disabled = true;
        });

        this.socket.on('server-message', (data) => {
            this.messagesReceived++;
            this.updateMetric('messages-received', this.messagesReceived);
            this.log('info', `📨 Server message: ${JSON.stringify(data)}`);
        });

        this.socket.on('test-response', (data) => {
            this.messagesReceived++;
            this.updateMetric('messages-received', this.messagesReceived);
            this.log('success', `📨 Test response: ${JSON.stringify(data).substring(0, 100)}...`);
        });

        this.socket.on('connect_error', (error) => {
            this.log('error', `❌ Socket connection error: ${error.message}`);
            this.updateMetric('socket-connection', '❌');
        });
    }

    disconnectSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.log('info', '🔌 Socket disconnected');
            this.updateMetric('socket-connection', '❌');
            document.getElementById('socket-test-btn').disabled = true;
        }
    }

    sendTestMessage() {
        if (!this.socket || !this.socket.connected) {
            this.log('error', '❌ Socket not connected');
            return;
        }

        const message = {
            text: 'Test message from dashboard',
            timestamp: new Date().toISOString(),
            messageId: Math.random().toString(36).substr(2, 9)
        };

        this.socket.emit('test-message', message);
        this.messagesSent++;
        this.updateMetric('messages-sent', this.messagesSent);
        this.log('info', `📤 Sent test message: ${message.messageId}`);
    }

    // Monitoring Methods
    startMonitoring() {
        if (this.monitoringActive) {
            this.log('warning', '⚠️ Monitoring already active');
            return;
        }

        this.monitoringActive = true;
        this.log('info', '📈 Starting performance monitoring...');
        
        document.getElementById('monitor-btn').disabled = true;
        
        this.monitoringInterval = setInterval(async () => {
            await this.performMonitoringCheck();
        }, 5000); // Check every 5 seconds
        
        // Initial check
        this.performMonitoringCheck();
    }

    async performMonitoringCheck() {
        const result = await this.makeRequest('/');
        
        if (result.success) {
            this.updateMetric('response-time', `${result.duration}ms`);
            this.updateMetric('success-rate', '100%');
            
            // Calculate uptime (simplified)
            const uptime = Math.floor((Date.now() - (this.loadTestStats.startTime || Date.now())) / 1000);
            this.updateMetric('uptime', `${uptime}s`);
        } else {
            this.updateMetric('response-time', 'Failed');
            this.updateMetric('success-rate', '0%');
            this.log('error', `❌ Monitoring check failed: ${result.error}`);
        }
    }

    stopMonitoring() {
        if (!this.monitoringActive) return;
        
        this.monitoringActive = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        document.getElementById('monitor-btn').disabled = false;
        this.log('info', '📈 Performance monitoring stopped');
    }

    clearLogs() {
        document.getElementById('logs').innerHTML = '';
        this.log('info', '📋 Logs cleared');
    }
}

// Global functions for HTML onclick events
let dashboard;

function initDashboard() {
    dashboard = new TestDashboard();
}

function setServerUrl() { dashboard.setServerUrl(); }
function testConnection() { dashboard.testConnection(); }
function runTest(endpoint) { dashboard.runTest(endpoint); }
function runLoadTest() { dashboard.runLoadTest(); }
function stopLoadTest() { dashboard.stopLoadTest(); }
function connectSocket() { dashboard.connectSocket(); }
function disconnectSocket() { dashboard.disconnectSocket(); }
function sendTestMessage() { dashboard.sendTestMessage(); }
function startMonitoring() { dashboard.startMonitoring(); }
function stopMonitoring() { dashboard.stopMonitoring(); }
function clearLogs() { dashboard.clearLogs(); }

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);