import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function NavBar() {
  const auth = useAuth();

  return (
    <header className="topbar">
      <nav className="topbar-inner" aria-label="Main">
        <Link to="/users" className="brand">
          User Directory
        </Link>
        <div className="nav-links">
          <NavLink to="/users/new">Add</NavLink>
          <NavLink to="/users" end>
            List
          </NavLink>
        </div>
        <div className="nav-user">
          {auth.isAuthenticated ? (
            <>
              <span className="nav-username" title={auth.user?.email}>
                {auth.user?.name}
              </span>
              <button type="button" className="btn btn-ghost" onClick={auth.signOut}>
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login">Log in</NavLink>
          )}
        </div>
      </nav>
    </header>
  );
}
