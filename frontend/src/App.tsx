import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { NavBar } from './components/NavBar';
import { AddUserPage } from './pages/AddUserPage';
import { EditUserPage } from './pages/EditUserPage';
import { LoginPage } from './pages/LoginPage';
import { UserListPage } from './pages/UserListPage';

export function App() {
  return (
    <>
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/users"
            element={
              <RequireAuth>
                <UserListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/users/new"
            element={
              <RequireAuth>
                <AddUserPage />
              </RequireAuth>
            }
          />
          <Route
            path="/users/:id/edit"
            element={
              <RequireAuth>
                <EditUserPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/users" replace />} />
        </Routes>
      </main>
    </>
  );
}
