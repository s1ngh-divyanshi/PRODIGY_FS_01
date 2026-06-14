import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import axiosInstance from 'axios';
import './App.css';

axiosInstance.defaults.withCredentials = true;

// ROUTE GUARD
const ProtectedRoute = ({ children, loadingSession, isLoggedIn }) => {
  if (loadingSession) {
    return <div className="app-layout"><div className="loading-spinner">Verifying secure session...</div></div>;
  }
  return isLoggedIn ? children : <Navigate to="/login" />;
};

// LOGIN/REGISTER FORM
const AuthForm = ({ isRegister, setIsLoggedIn, setUserRole, isLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false); // State to track warning contexts
  const [loading, setLoading] = useState(false);

  if (isLoggedIn) return <Navigate to="/dashboard" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isRegister ? 'register' : 'login';
    setLoading(true);
    setMessage('');
    setIsError(false); // Reset on submission
    
    try {
      const response = await axiosInstance.post(`http://localhost:8000/api/auth/${endpoint}`, { email, password });
      setMessage(response.data.message);
      setIsError(false); // Success case
      
      if (!isRegister && response.data.message === "Login successful!") {
        localStorage.setItem('isLoggedIn', 'true');
  
        const profile = await axiosInstance.get('http://localhost:8000/api/auth/me');
        setUserRole(profile.data.user.role);
        setIsLoggedIn(true);
      }
    } catch (error) {
      setIsError(true); // Flag as warning/error
      setMessage(error.response?.data?.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>{isRegister ? "Create Account" : "Secure Log In"}</h2>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email Address" onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
        <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
        <button type="submit" disabled={loading} className={loading ? "btn-disabled" : ""}>
          {loading ? "Processing..." : isRegister ? "Register" : "Log In"}
        </button>
      </form>
      
      {/* Dynamically switch classes based on error state */}
      {message && (
        <p className={`status-msg ${isError ? 'error' : 'success'}`}>
          {message}
        </p>
      )}
      
      <p>
        {isRegister ? "Already have an account? " : "New user? "}
        <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Login here" : "Register here"}</Link>
      </p>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ setIsLoggedIn, userRole }) => {
  const [userData, setUserData] = useState(null);
  const [adminData, setAdminData] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchProtectedData = async () => {
    setLoading(true);
    setErr('');
    try {
      const personalResponse = await axiosInstance.get('http://localhost:8000/api/protected/dashboard');
      setUserData(personalResponse.data.user);

      if (userRole === 'admin' || userRole === 'superadmin') {
        const adminResponse = await axiosInstance.get('http://localhost:8000/api/protected/admin-panel');
        setAdminData(adminResponse.data.totalUsers);
      }
    } catch (error) {
      setErr("Session expired or access denied.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Are you absolutely sure you want to permanently execute this account deletion sequence?")) return;
    try {
      const response = await axiosInstance.delete(`http://localhost:8000/api/protected/delete-user/${id}`);
      alert(response.data.message);

      // Clean execution state synchronization without breaking page loops
      if (response.data.selfDeleted) {
        localStorage.removeItem('isLoggedIn');
        setUserData(null);
        setAdminData([]);
        setIsLoggedIn(false); // Instantly triggers Route Guard to push user to /login
        return;
      }

      setAdminData(adminData.filter(user => user._id !== id));
    } catch (error) {
        alert(error.response?.data?.message || "An authentication boundary violation error occurred.");
    }
  };

  const handleLogout = async () => {
    try {
      await axiosInstance.post('http://localhost:8000/api/auth/logout');
      localStorage.removeItem('isLoggedIn');
      setUserData(null);
      setAdminData([]);
      setIsLoggedIn(false); // Triggers safe immediate clean reroute
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <div className="dashboard-grid-container">
      
      <div className="dashboard-header">
        <h2>🔒 SentinelAuth Platform <span className="role-badge">{userRole.toUpperCase()}</span></h2>
        <button onClick={handleLogout} className="logout-btn-header">Sign Out</button>
      </div>

      <div className="dashboard-layout-body">
        
        {/* LEFT COLUMN: CONTROL & ACCOUNT METRICS */}
        <div className="panel-card main-controls">
          <h3>👤 User Session Context</h3>
          <p style={{color: '#94a3b8', fontSize: '13px'}}>Ping the backend database node to verify active secure HTTP-Only cookie authenticity tokens.</p>
          
          <button onClick={fetchProtectedData} disabled={loading} className="fetch-btn">
            {loading ? "Synchronizing Matrix..." : "Sync Secure Database Context"}
          </button>
          
          {userData && (
            <div className="data-box animated-fade">
              <p><strong>Verification Status:</strong> Passed ✔</p>
              <p><strong>System ID:</strong> <code style={{color: '#38bdf8'}}>{userData._id}</code></p>
              <p><strong>Session Principal:</strong> {userData.email}</p>
              
              {userRole === 'user' && (
                <button 
                  onClick={() => handleDeleteUser(userData._id)} 
                  className="action-delete-btn" 
                  style={{ marginTop: '12px', width: '100%', background: 'rgba(239, 68, 68, 0.1)' }}
                >
                  ⚠️ Permanently Delete My Account
                </button>
              )}
            </div>
          )}
          {err && <p className="error-text">{err}</p>}
        </div>

        {/* RIGHT COLUMN: DYNAMIC SOFTWARE DOCUMENTATION */}
        <div className="panel-card software-info">
          <h3>ℹ️ Core Architecture Overview</h3>
          <p style={{fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5'}}>
            This infrastructure runs on a decoupled architecture utilizing <strong>HTTP-Only Cookie Sessions</strong> paired with short-lived <strong>JSON Web Tokens (JWT)</strong>.
          </p>
          <div className="tech-stack-tags">
            <span className="tag spec-sec">Bcryptjs Hashing</span>
            <span className="tag spec-rate">Rate Limited (429 Protection)</span>
            <span className="tag spec-cors">CORS Origin Hardened</span>
            <span className="tag spec-db">MongoDB Mongoose</span>
          </div>
          <p style={{fontSize: '12px', color: '#6c788aff', marginTop: '10px', borderTop: '1px solid #334155', paddingTop: '8px'}}>
            🔒 <strong>Security Node Status:</strong> Rate limits are monitored actively by client IP. Cross-site script injections (XSS) are structurally blocked via token compilation design.
          </p>
        </div>

      </div>

      {/* LOWER FULL-WIDTH ROW: MANAGEMENT GRID (ADMIN & SUPERADMIN ONLY) */}
      {(userRole === 'admin' || userRole === 'superadmin') && adminData.length > 0 && (
        <div className="panel-card admin-full-panel animated-fade">
          <div className="admin-title-row">
            <h3>🛡️ Administrative Management Dashboard</h3>
            <span className="count-pill">Database Records: {adminData.length}</span>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Unique User System ID</th>
                <th>Registered Email Address</th>
                <th>System Authority Level</th>
                <th style={{ textAlign: 'right' }}>Management Action</th>
              </tr>
            </thead>
            <tbody>
              {adminData.map((u) => {
                let isAllowedToDelete = false;

                if (userRole === 'superadmin') {
                  // Superadmins can delete themselves (if another superadmin exists) OR any lower tiers
                  // They cannot delete ANOTHER superadmin from this table interface
                  isAllowedToDelete = (u._id === userData?._id) || (u.role !== 'superadmin');
                } 
                else if (userRole === 'admin') {
                  // Admins can delete themselves (if another admin exists) OR a standard row marked 'user'
                  isAllowedToDelete = (u._id === userData?._id) || (u.role === 'user');
                }

                return (
                  <tr key={u._id}>
                  <td><code>{u._id}</code></td>
                  <td>{u.email}</td>
                  <td><span className={`role-tag ${u.role}`}>{u.role}</span></td>

                  {/* RECTIFIED ACTION COLUMN CELL */}
                  <td style={{ textAlign: 'right' }}>
                    {isAllowedToDelete ? (
                      <button 
                        onClick={() => handleDeleteUser(u._id)} 
                        className="action-delete-btn"
                        style={{
                          backgroundColor: u._id === userData?._id ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                          borderColor: '#ef4444'
                        }}
                      >
                        {u._id === userData?._id ? "Delete Myself" : "Delete Account"}
                      </button>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic', letterSpacing: '0.3px' }}>
                        🔒 Restricted Access
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// MAIN WRAPPER
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('user'); // Tracks role context globally
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const checkSessionStatus = async () => {
      try {
        const response = await axiosInstance.get('http://localhost:8000/api/auth/me');
        if (response.data.isAuthenticated) {
          setIsLoggedIn(true);
          setUserRole(response.data.user.role); // to save role context on fresh load or reload
          localStorage.setItem('isLoggedIn', 'true');
        }
      } catch (error) {
        setIsLoggedIn(false);
        localStorage.removeItem('isLoggedIn');
      } finally {
        setLoadingSession(false);
      }
    };
    checkSessionStatus();
  }, []);

  return (
    <Router>
      <div className="app-layout">
        <Routes>
          <Route path="/register" element={<AuthForm isRegister={true} setIsLoggedIn={setIsLoggedIn} setUserRole={setUserRole} isLoggedIn={isLoggedIn} />} />
          <Route path="/login" element={<AuthForm isRegister={false} setIsLoggedIn={setIsLoggedIn} setUserRole={setUserRole} isLoggedIn={isLoggedIn} />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute loadingSession={loadingSession} isLoggedIn={isLoggedIn}>
              <Dashboard setIsLoggedIn={setIsLoggedIn} userRole={userRole} />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;