import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import { authAPI } from './services/api'
import { ProtectedRoute } from './components/layout/index'

// Auth
import Login    from './pages/auth/Login'
import Register from './pages/auth/Register'

// Student
import StudentDashboard   from './pages/student/Dashboard'
import SchemeList         from './pages/student/SchemeList'
import ApplicationDetail  from './pages/student/ApplicationDetail'
import StudentProfile     from './pages/student/Profile'
import VerifyIdentity     from './pages/student/VerifyIdentity'
import BankVerification   from './pages/student/BankVerification'

// Admin
import AdminDashboard     from './pages/admin/Dashboard'
//import AdminStudents      from './pages/admin/Students'
//import AdminStudentDetail from './pages/admin/StudentDetail'
//import AdminSchemes       from './pages/admin/Schemes'
//import AdminApplications  from './pages/admin/Applications'
//import AdminApplicationDetail from './pages/admin/ApplicationDetail'
//import AdminDisbursements from './pages/admin/Disbursements'
//import AdminAudit         from './pages/admin/AuditLog'

// Verifier
//import VerifierDashboard  from './pages/verifier/Dashboard'
//import VerifierStudent    from './pages/verifier/VerifyStudent'

export default function App() {
  const { login, logout, setReady, token } = useAuthStore()

  useEffect(() => {
    if (!token) { setReady(); return }
    authAPI.me()
      .then(res => {
        login(
          { access: token, refresh: localStorage.getItem('refresh_token') },
          res.data
        )
      })
      .catch(() => { logout() })
      .finally(() => setReady())
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/"         element={<Navigate to="/login" replace />} />

        {/* Student portal */}
        <Route path="/student" element={<ProtectedRoute allowedRoles={['student']} />}>
          <Route index                      element={<StudentDashboard />} />
          <Route path="schemes"             element={<SchemeList />} />
          <Route path="applications/:id"    element={<ApplicationDetail />} />
          <Route path="profile"             element={<StudentProfile />} />
          <Route path="verify"              element={<VerifyIdentity />} />
          <Route path="bank"                element={<BankVerification />} />
        </Route>

        {/* Admin portal */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin','superadmin']} />}>
          <Route index                       element={<AdminDashboard />} />
          <Route path="students"             element={<AdminStudents />} />
          <Route path="students/:id"         element={<AdminStudentDetail />} />
          <Route path="schemes"              element={<AdminSchemes />} />
          <Route path="applications"         element={<AdminApplications />} />
          <Route path="applications/:id"     element={<AdminApplicationDetail />} />
          <Route path="disbursements"        element={<AdminDisbursements />} />
          <Route path="audit"                element={<AdminAudit />} />
        </Route>

        {/* Verifier portal */}
        <Route path="/verifier" element={<ProtectedRoute allowedRoles={['verifier','admin','superadmin']} />}>
          <Route index             element={<VerifierDashboard />} />
          <Route path="students/:id" element={<VerifierStudent />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}